import { Client } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { hash, Algorithm } from '@node-rs/argon2';
import * as dotenv from 'dotenv';

// Load .env.local if available
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

export const MIGRATION_ADVISORY_LOCK_ID = 742910;

/**
 * Robust SQL statement splitter that respects:
 * - Line comments (-- ...)
 * - Block comments (/* ... *\/ with nesting)
 * - Single-quoted strings ('...' with '' escapes)
 * - Double-quoted identifiers ("..." with "" escapes)
 * - Dollar-quoted blocks ($$...$$ or $tag$...$tag$)
 * - Semicolon statement terminators
 */
export function splitSqlStatements(content: string): string[] {
  const statements: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inDollarQuote: string | null = null;
  let inLineComment = false;
  let blockCommentDepth = 0;
  const len = content.length;

  for (let i = 0; i < len; i++) {
    const char = content[i];
    const next = i + 1 < len ? content[i + 1] : '';

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (blockCommentDepth > 0) {
      if (char === '/' && next === '*') {
        blockCommentDepth++;
        i++;
      } else if (char === '*' && next === '/') {
        blockCommentDepth--;
        i++;
      }
      continue;
    }

    if (inSingleQuote) {
      current += char;
      if (char === "'") {
        if (next === "'") {
          current += next;
          i++;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      current += char;
      if (char === '"') {
        if (next === '"') {
          current += next;
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (inDollarQuote !== null) {
      current += char;
      if (char === '$') {
        const tag = inDollarQuote;
        const sub = content.slice(i, i + tag.length);
        if (sub === tag) {
          current += tag.slice(1);
          i += tag.length - 1;
          inDollarQuote = null;
        }
      }
      continue;
    }

    if (char === '-' && next === '-') {
      inLineComment = true;
      i++;
      continue;
    }

    if (char === '/' && next === '*') {
      blockCommentDepth = 1;
      i++;
      continue;
    }

    if (char === "'") {
      inSingleQuote = true;
      current += char;
      continue;
    }

    if (char === '"') {
      inDoubleQuote = true;
      current += char;
      continue;
    }

    if (char === '$') {
      const match = content.slice(i).match(/^(\$[a-zA-Z0-9_]*\$)/);
      if (match) {
        inDollarQuote = match[1];
        current += inDollarQuote;
        i += inDollarQuote.length - 1;
        continue;
      }
    }

    if (char === ';') {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

export async function runMigrations(targetDatabaseUrl?: string) {
  const dbUrl = targetDatabaseUrl || process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not set and no target database URL was provided.');
  }

  // Use persistent connection client for transaction and advisory lock guarantees
  const client = new Client(dbUrl);
  await client.connect();

  console.log('--- Starting Hardened Migration Runner ---');

  try {
    // 1. Begin transaction
    await client.query('BEGIN;');

    // 2. Acquire transaction-scoped advisory lock
    const lockRes = await client.query(
      `SELECT pg_try_advisory_xact_lock(${MIGRATION_ADVISORY_LOCK_ID}) as locked;`
    );
    const locked = lockRes.rows[0]?.locked;
    if (!locked) {
      throw new Error(
        `CONCURRENT_MIGRATION_BLOCKED: Another migration process currently holds advisory lock ${MIGRATION_ADVISORY_LOCK_ID}. Aborting to prevent race condition.`
      );
    }
    console.log(`Acquired transaction-scoped advisory lock (${MIGRATION_ADVISORY_LOCK_ID}).`);

    // 3. Pre-migration check of ledger_collections row count
    let preCount = -1;
    try {
      const countRes = await client.query('SELECT count(*)::int as count FROM public.ledger_collections;');
      preCount = countRes.rows[0].count;
      console.log(`Pre-migration ledger_collections count: ${preCount}`);
    } catch (err: any) {
      console.log(`ledger_collections check: ${err.message}`);
    }

    // 4. Ensure schema_migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        execution_time_ms INTEGER NOT NULL
      );
    `);

    // 5. Scan and verify migration files
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const version = file.split('_')[0];
      const name = file;
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const checksum = crypto.createHash('sha256').update(content).digest('hex');

      // Check if migration already applied
      const existingRes = await client.query(
        'SELECT version, checksum FROM public.schema_migrations WHERE version = $1;',
        [version]
      );

      if (existingRes.rows.length > 0) {
        const recordedChecksum = existingRes.rows[0].checksum;
        if (recordedChecksum !== checksum) {
          throw new Error(
            `CRITICAL_CHECKSUM_MISMATCH: Migration ${file} was previously applied with checksum ${recordedChecksum}, but file on disk has checksum ${checksum}. Tampering or modification of applied migrations is prohibited.`
          );
        }
        console.log(`Migration ${file} already applied and checksum verified (${checksum.substring(0, 10)}...). Skipping.`);
        continue;
      }

      console.log(`Applying migration within transaction: ${file}...`);
      const startTime = Date.now();

      // Split into statements safely using robust SQL lexer
      const statements = splitSqlStatements(content);

      for (const stmt of statements) {
        if (stmt.length > 0) {
          await client.query(stmt);
        }
      }

      const executionTimeMs = Date.now() - startTime;

      // Record migration in schema_migrations
      await client.query(
        `INSERT INTO public.schema_migrations (version, name, checksum, execution_time_ms)
         VALUES ($1, $2, $3, $4);`,
        [version, name, checksum, executionTimeMs]
      );

      console.log(`Applied ${file} in ${executionTimeMs}ms.`);
    }

    // 6. Administrator Provisioning Check (Hardened: No hardcoded fallback password)
    const adminEmail = (process.env.ADMIN_INITIAL_EMAIL || 'admin@printstudio.ae').trim().toLowerCase();
    const existingAdminRes = await client.query(
      'SELECT id, email FROM public.users WHERE email = $1;',
      [adminEmail]
    );

    if (existingAdminRes.rows.length === 0) {
      const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
      if (!adminPassword) {
        throw new Error(
          'CRITICAL_CONFIG_ERROR: Administrator provisioning requires ADMIN_INITIAL_PASSWORD environment variable to be explicitly set. Hardcoded fallback credentials have been removed for security hardening.'
        );
      }
      if (adminPassword.length < 12) {
        throw new Error(
          'INSECURE_PASSWORD: ADMIN_INITIAL_PASSWORD must be at least 12 characters in length.'
        );
      }

      console.log(`Seeding initial administrator user (${adminEmail})...`);
      const passwordHash = await hash(adminPassword, {
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
        algorithm: 2 as const, // Algorithm.Argon2id
      });

      await client.query(
        `INSERT INTO public.users (email, password_hash, full_name, role, is_active)
         VALUES ($1, $2, $3, 'ADMIN', true);`,
        [adminEmail, passwordHash, 'Studio Administrator']
      );
      console.log(`Admin user seeded successfully.`);
    } else {
      console.log(`Admin user ${adminEmail} already exists.`);
    }

    // 7. Post-migration ledger_collections row count integrity check
    if (preCount !== -1) {
      const postCountRes = await client.query('SELECT count(*)::int as count FROM public.ledger_collections;');
      const postCount = postCountRes.rows[0].count;
      console.log(`Post-migration ledger_collections count: ${postCount}`);
      if (preCount !== postCount) {
        throw new Error(
          `CRITICAL_INTEGRITY_FAILURE: ledger_collections row count changed from ${preCount} to ${postCount}! Rolling back transaction.`
        );
      }
      console.log(`INTEGRITY VERIFIED: ledger_collections count remains exactly ${postCount}.`);
    }

    // 8. Commit transaction (atomically commits all DDL and releases advisory lock)
    await client.query('COMMIT;');
    console.log('Transaction committed successfully.');

    // 9. Report public tables
    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log('Current public tables:', tablesRes.rows.map(t => t.table_name));
    console.log('--- Migration Finished Successfully ---');
  } catch (err: any) {
    console.error('Migration failed. Rolling back transaction...', err.message);
    try {
      await client.query('ROLLBACK;');
      console.log('Transaction rolled back cleanly. No partial DDL changes persisted.');
    } catch (rbErr) {
      console.error('Rollback error:', rbErr);
    }
    throw err;
  } finally {
    await client.end();
  }
}

// If run directly from CLI
if (require.main === module || process.argv[1]?.endsWith('migrate.ts')) {
  const targetUrl = process.argv[2];
  runMigrations(targetUrl).catch((err) => {
    console.error('Migration execution failed:', err);
    process.exit(1);
  });
}
