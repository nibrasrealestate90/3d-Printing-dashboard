import { neon, Client } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL is not configured. Running in local fallback mode.');
}

// Neon HTTP query client for serverless Next.js App Router (auto-commit single queries)
export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;

/**
 * Executes a callback within an explicit interactive PostgreSQL transaction.
 * Uses a dedicated Client connection to guarantee that all queries in the callback
 * are executed over the same connection within BEGIN / COMMIT / ROLLBACK semantics.
 */
export async function withTransaction<T>(
  callback: (client: Client) => Promise<T>
): Promise<T> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = new Client(dbUrl);
  await client.connect();

  try {
    await client.query('BEGIN;');
    const result = await callback(client);
    await client.query('COMMIT;');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK;');
    } catch (rbErr) {
      console.error('Error during transaction rollback:', rbErr);
    }
    throw err;
  } finally {
    try {
      await client.end();
    } catch (endErr) {
      console.error('Error closing transaction client:', endErr);
    }
  }
}
