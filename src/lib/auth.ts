import crypto from 'crypto';
import net from 'net';
import { hash, verify, Algorithm } from '@node-rs/argon2';
import { sql } from './db';

// --- Configuration Constants ---
export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  algorithm: 2 as const, // Algorithm.Argon2id
};

// --- Type Definitions ---
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'STUDIO_OPERATOR' | 'VIEWER';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  is_revoked: boolean;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
  last_active_at: string;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  remaining: number;
  resetAt: Date;
}

export class DatabaseUnavailableError extends Error {
  constructor(message = 'Database service unavailable') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

// --- 1. Password Hashing & Verification (Argon2id) ---

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 12) {
    throw new Error('Password must be at least 12 characters in length.');
  }
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hashString: string, password: string): Promise<boolean> {
  if (!hashString || !password) return false;
  try {
    return await verify(hashString, password);
  } catch (err) {
    console.error('Password verification error:', err);
    return false;
  }
}

// --- 2. Token Cryptography ---

export function generateSessionToken(): string {
  // 32 bytes cryptographically secure random token (256-bit entropy)
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// --- 3. Session Lifecycle Management ---

export async function createAdminSession(
  userId: string,
  metadata?: { userAgent?: string; ipAddress?: string }
): Promise<{ rawToken: string; session: AdminSession }> {
  if (!sql) throw new Error('Database connection not available');

  const rawToken = generateSessionToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const [session] = (await sql`
    INSERT INTO public.sessions (
      user_id,
      token_hash,
      expires_at,
      user_agent,
      ip_address
    ) VALUES (
      ${userId},
      ${tokenHash},
      ${expiresAt.toISOString()},
      ${metadata?.userAgent || null},
      ${metadata?.ipAddress || null}
    )
    RETURNING *;
  `) as AdminSession[];

  return { rawToken, session };
}

export async function validateSession(
  rawToken: string
): Promise<{ session: AdminSession; user: AuthUser } | null> {
  if (!rawToken) return null;
  if (!sql) {
    throw new DatabaseUnavailableError('Database connection not available');
  }

  const tokenHash = hashToken(rawToken);

  let rows;
  try {
    rows = await sql`
      SELECT 
        s.id as session_id,
        s.user_id,
        s.token_hash,
        s.expires_at,
        s.is_revoked,
        s.user_agent,
        s.ip_address,
        s.created_at as session_created_at,
        s.last_active_at,
        u.id as user_id,
        u.email,
        u.full_name,
        u.role,
        u.is_active,
        u.created_at as user_created_at,
        u.updated_at as user_updated_at
      FROM public.sessions s
      JOIN public.users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash}
        AND s.is_revoked = false
        AND s.expires_at > NOW()
        AND u.is_active = true
      LIMIT 1;
    `;
  } catch (err: any) {
    console.error('Database query failure in validateSession:', err.message);
    throw new DatabaseUnavailableError('Database query failed during session validation');
  }

  if (!rows || rows.length === 0) {
    return null;
  }

  const r = rows[0];

  // Sliding window activity touch (asynchronously update last_active_at)
  sql`
    UPDATE public.sessions
    SET last_active_at = NOW()
    WHERE id = ${r.session_id};
  `.catch(err => console.error('Failed to update session activity:', err));

  const session: AdminSession = {
    id: r.session_id,
    user_id: r.user_id,
    token_hash: r.token_hash,
    expires_at: r.expires_at,
    is_revoked: r.is_revoked,
    user_agent: r.user_agent,
    ip_address: r.ip_address,
    created_at: r.session_created_at,
    last_active_at: r.last_active_at,
  };

  const user: AuthUser = {
    id: r.user_id,
    email: r.email,
    full_name: r.full_name,
    role: r.role,
    is_active: r.is_active,
    created_at: r.user_created_at,
    updated_at: r.user_updated_at,
  };

  return { session, user };
}

export async function revokeSession(rawToken: string): Promise<boolean> {
  if (!sql || !rawToken) return false;
  const tokenHash = hashToken(rawToken);

  const result = await sql`
    UPDATE public.sessions
    SET is_revoked = true
    WHERE token_hash = ${tokenHash}
    RETURNING id;
  `;

  return result.length > 0;
}

export async function revokeUserSessions(userId: string): Promise<number> {
  if (!sql || !userId) return 0;

  const result = await sql`
    UPDATE public.sessions
    SET is_revoked = true
    WHERE user_id = ${userId} AND is_revoked = false
    RETURNING id;
  `;

  return result.length;
}

// --- 4. Sliding Window Rate Limiting (Atomic UPSERT) ---

export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000
): Promise<RateLimitResult> {
  if (!sql) {
    return { allowed: true, count: 0, remaining: maxAttempts, resetAt: new Date() };
  }

  const now = new Date();
  const resetTime = new Date(now.getTime() + windowMs);

  // Single atomic UPSERT query with row-level locking
  const rows = await sql`
    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (${key}, 1, ${resetTime.toISOString()})
    ON CONFLICT (key) DO UPDATE
    SET 
      count = CASE 
        WHEN public.rate_limits.reset_at < NOW() THEN 1 
        ELSE public.rate_limits.count + 1 
      END,
      reset_at = CASE 
        WHEN public.rate_limits.reset_at < NOW() THEN ${resetTime.toISOString()}::timestamptz 
        ELSE public.rate_limits.reset_at 
      END
    RETURNING count, reset_at;
  `;

  const count = Number(rows[0].count);
  const dbResetAt = new Date(rows[0].reset_at);
  const remaining = Math.max(0, maxAttempts - count);
  const allowed = count <= maxAttempts;

  return {
    allowed,
    count,
    remaining,
    resetAt: dbResetAt,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  if (!sql) return;
  await sql`DELETE FROM public.rate_limits WHERE key = ${key};`.catch(() => {});
}

// --- 5. Account Progressive Throttling (Eliminating Account Lockout DoS) ---

export async function getAccountThrottleDelay(
  key: string
): Promise<{ failureCount: number; delayMs: number }> {
  if (!sql) return { failureCount: 0, delayMs: 0 };

  const rows = await sql`
    SELECT count FROM public.rate_limits
    WHERE key = ${key} AND reset_at > NOW()
    LIMIT 1;
  `;

  if (!rows || rows.length === 0) {
    return { failureCount: 0, delayMs: 0 };
  }

  const count = Number(rows[0].count);
  let delayMs = 0;

  // Progressive backoff schedule:
  // 0-2 failures: 0ms
  // 3 failures: 100ms
  // 4 failures: 250ms
  // 5 failures: 500ms
  // 6 failures: 1000ms
  // 7+ failures: 2000ms (strictly capped at 2000ms to prevent gateway timeouts)
  if (count === 3) delayMs = 100;
  else if (count === 4) delayMs = 250;
  else if (count === 5) delayMs = 500;
  else if (count === 6) delayMs = 1000;
  else if (count >= 7) delayMs = 2000;

  return { failureCount: count, delayMs };
}

export async function recordAccountFailure(
  key: string,
  windowMs = 30 * 60 * 1000
): Promise<number> {
  if (!sql) return 0;

  const now = new Date();
  const resetTime = new Date(now.getTime() + windowMs);

  const rows = await sql`
    INSERT INTO public.rate_limits (key, count, reset_at)
    VALUES (${key}, 1, ${resetTime.toISOString()})
    ON CONFLICT (key) DO UPDATE
    SET 
      count = CASE 
        WHEN public.rate_limits.reset_at < NOW() THEN 1 
        ELSE public.rate_limits.count + 1 
      END,
      reset_at = CASE 
        WHEN public.rate_limits.reset_at < NOW() THEN ${resetTime.toISOString()}::timestamptz 
        ELSE public.rate_limits.reset_at 
      END
    RETURNING count;
  `;

  return Number(rows[0].count);
}

// --- 6. Bounded Session & Rate-Limit Cleanup Routine (SEC-06) ---

let lastPruneTimestamp = 0;
const PRUNE_THROTTLE_MS = 60 * 60 * 1000; // Throttled to at most once per hour

export async function pruneExpiredSessions(
  force = false
): Promise<{ sessionsPruned: number; rateLimitsPruned: number }> {
  if (!sql) return { sessionsPruned: 0, rateLimitsPruned: 0 };

  const now = Date.now();
  if (!force && now - lastPruneTimestamp < PRUNE_THROTTLE_MS) {
    return { sessionsPruned: 0, rateLimitsPruned: 0 };
  }
  lastPruneTimestamp = now;

  try {
    // 1. Bounded batch deletion of expired or long-revoked sessions (max 1000 rows per run)
    // Never touches audit_logs
    const sessionResult = await sql`
      WITH expired_candidates AS (
        SELECT id FROM public.sessions
        WHERE expires_at < NOW()
           OR (is_revoked = true AND last_active_at < NOW() - INTERVAL '7 days')
        LIMIT 1000
      )
      DELETE FROM public.sessions
      WHERE id IN (SELECT id FROM expired_candidates)
      RETURNING id;
    `;

    // 2. Safe deletion of expired rate limits
    const rateLimitResult = await sql`
      DELETE FROM public.rate_limits
      WHERE reset_at < NOW()
      RETURNING key;
    `;

    return {
      sessionsPruned: sessionResult.length,
      rateLimitsPruned: rateLimitResult.length,
    };
  } catch (err) {
    console.error('Session/Rate-limit pruning error:', err);
    return { sessionsPruned: 0, rateLimitsPruned: 0 };
  }
}

// --- 7. Audit Logging ---

export async function logAuditEvent(params: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, any> | null;
}): Promise<void> {
  if (!sql) return;

  try {
    await sql`
      INSERT INTO public.audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        ip_address,
        user_agent,
        details
      ) VALUES (
        ${params.userId || null},
        ${params.action},
        ${params.entityType},
        ${params.entityId || null},
        ${params.ipAddress || null},
        ${params.userAgent || null},
        ${params.details ? JSON.stringify(params.details) : null}
      );
    `;
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// --- 8. Request Context & Trustworthy IP Extraction (Remediation C) ---

function isTrustedProxy(ip: string, trustedList: Set<string>): boolean {
  if (trustedList.has(ip)) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  return false;
}

export function parseForwardedHeader(
  forwardedHeader: string,
  trustedProxies: Set<string>
): string | null {
  if (!forwardedHeader || typeof forwardedHeader !== 'string') return null;

  const hops = forwardedHeader
    .split(',')
    .map(h => h.trim())
    .filter(Boolean);

  if (hops.length === 0) return null;

  // Validate every hop is a valid syntactical IP address
  for (const hop of hops) {
    if (!net.isIP(hop)) {
      return null; // Malformed chain rejected
    }
  }

  // Walk the chain from right to left (from most recent trusted peer backwards)
  for (let i = hops.length - 1; i >= 0; i--) {
    const currentIp = hops[i];
    if (!isTrustedProxy(currentIp, trustedProxies)) {
      // First untrusted IP encountered is the legitimate client IP
      return currentIp;
    }
  }

  // If all hops are in the trusted proxy set, the client is the original ingress hop
  return hops[0];
}

export function extractClientIp(req: Request): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const trustedProxyMode = process.env.TRUSTED_PROXY?.toLowerCase();

  // 1. Cloudflare Mode: strictly require deployment ingress verification (CF_INGRESS_VERIFIED=true)
  if (trustedProxyMode === 'cloudflare') {
    const cfIngressVerified = process.env.CF_INGRESS_VERIFIED === 'true';
    if (!cfIngressVerified) {
      if (isProduction) {
        throw new Error(
          'CRITICAL_INGRESS_CONFIGURATION_ERROR: TRUSTED_PROXY is set to "cloudflare", but CF_INGRESS_VERIFIED is not enabled. Ingress network restrictions (Cloudflare Tunnel or firewall allowlisting) must be active before CF-Connecting-IP can be trusted.'
        );
      }
      return '127.0.0.1';
    }

    const cfConnectingIp = req.headers.get('cf-connecting-ip')?.trim();
    if (cfConnectingIp && net.isIP(cfConnectingIp)) {
      return cfConnectingIp;
    }
  }

  // 2. Generic Trusted Reverse Proxy Mode (Chain Walk)
  if (trustedProxyMode === 'true' || trustedProxyMode === '1') {
    const forwardedHeader = req.headers.get('x-forwarded-for');
    if (forwardedHeader) {
      const trustedList = new Set(
        (process.env.TRUSTED_PROXY_IPS || '127.0.0.1, ::1')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)
      );
      const parsedIp = parseForwardedHeader(forwardedHeader, trustedList);
      if (parsedIp) {
        return parsedIp;
      }
    }
    const realIp = req.headers.get('x-real-ip')?.trim();
    if (realIp && net.isIP(realIp)) {
      return realIp;
    }
  }

  // 3. Platform socket connection IP (e.g. Next.js socket)
  const nextIp = (req as any).ip;
  if (nextIp && typeof nextIp === 'string' && net.isIP(nextIp.trim())) {
    return nextIp.trim();
  }

  // 4. Safe fallback handling
  if (isProduction) {
    throw new Error(
      'UNVERIFIED_CLIENT_IP: Production environment requires a verified client IP configuration. Falling back to shared 127.0.0.1 is disabled in production to prevent shared rate-limit denial of service.'
    );
  }

  // In local development / non-production: safe loopback fallback
  return '127.0.0.1';
}

export function extractSessionToken(req: Request): string | null {
  // 1. Try Authorization header
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Try Cookie header (check both __Host-admin_session and admin_session)
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookieHeader.split(';').map(c => c.trim());

  for (const c of cookies) {
    if (c.startsWith('__Host-admin_session=')) {
      return decodeURIComponent(c.substring('__Host-admin_session='.length));
    }
    if (c.startsWith('admin_session=')) {
      return decodeURIComponent(c.substring('admin_session='.length));
    }
  }

  return null;
}

// --- 9. Hardened CSRF & Origin Validation (Remediation B) ---

export function validateOrigin(req: Request): boolean {
  const method = req.method.toUpperCase();
  // Safe idempotent methods do not mutate state
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return true;
  }

  const hostHeader = req.headers.get('host');
  if (!hostHeader) {
    // Missing Host header is invalid HTTP/1.1+
    return false;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  let expectedProtocol = 'http:';
  try {
    const requestUrl = new URL(req.url);
    expectedProtocol = requestUrl.protocol;
  } catch {}

  if (isProduction || req.headers.get('x-forwarded-proto') === 'https') {
    expectedProtocol = 'https:';
  }

  // 1. Validate Origin header if present
  const originHeader = req.headers.get('origin');
  if (originHeader) {
    if (originHeader === 'null') {
      return false; // Reject sandboxed iframes and privacy origins
    }
    try {
      const originUrl = new URL(originHeader);
      // In production, scheme must be HTTPS
      if (isProduction && originUrl.protocol !== 'https:') {
        return false;
      }
      // Exact scheme match
      if (originUrl.protocol !== expectedProtocol) {
        return false;
      }
      // Exact host match (includes port if non-standard)
      return originUrl.host.toLowerCase() === hostHeader.toLowerCase();
    } catch {
      return false;
    }
  }

  // 2. Validate Referer header only as supported fallback when Origin is absent
  const refererHeader = req.headers.get('referer');
  if (refererHeader) {
    try {
      const refererUrl = new URL(refererHeader);
      if (isProduction && refererUrl.protocol !== 'https:') {
        return false;
      }
      if (refererUrl.protocol !== expectedProtocol) {
        return false;
      }
      return refererUrl.host.toLowerCase() === hostHeader.toLowerCase();
    } catch {
      return false;
    }
  }

  // 3. When BOTH Origin and Referer are absent:
  // State mutations MUST be rejected to prevent ambient credential CSRF.
  // There are zero exemptions based on Authorization header presence.
  return false;
}

export async function requireAdminSession(
  req: Request
): Promise<{ session: AdminSession; user: AuthUser } | Response> {
  // 1. Validate Origin for state mutations (Strict CSRF)
  if (!validateOrigin(req)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: Cross-Site Request Forgery validation failed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // 2. Extract and validate session token
  const token = extractSessionToken(req);
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Authentication required' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  let auth;
  try {
    auth = await validateSession(token);
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError || !sql) {
      return new Response(
        JSON.stringify({ error: 'Database service unavailable' }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    throw err;
  }

  if (!auth) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized: Invalid, expired, or revoked session' }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return auth;
}

// --- 10. Machine-to-Machine (M2M) Credential Validation & Dual-Gate Auth ---

export function validateM2MToken(req: Request, requiredScope = 'bambu:sync'): boolean {
  const authHeader = req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  // Ambient cookies must NOT be mixed with M2M bearer tokens
  const cookieHeader = req.headers.get('cookie') || '';
  if (cookieHeader.includes('admin_session')) {
    return false;
  }

  const rawToken = authHeader.substring(7).trim();
  if (!rawToken || rawToken.length < 32) {
    return false;
  }

  // Check required scope: BAMBU_M2M_SECRET is strictly scoped to 'bambu:sync'
  if (requiredScope !== 'bambu:sync') {
    return false;
  }

  const validHashes: string[] = [];

  // 1. Primary SHA-256 hash from server environment
  if (process.env.BAMBU_M2M_SECRET_HASH) {
    validHashes.push(process.env.BAMBU_M2M_SECRET_HASH.toLowerCase().trim());
  }
  if (process.env.BAMBU_M2M_API_KEY_HASH) {
    validHashes.push(process.env.BAMBU_M2M_API_KEY_HASH.toLowerCase().trim());
  }

  // 2. Previous SHA-256 hash for zero-downtime rotation
  if (process.env.BAMBU_M2M_SECRET_HASH_PREVIOUS) {
    validHashes.push(process.env.BAMBU_M2M_SECRET_HASH_PREVIOUS.toLowerCase().trim());
  }

  // 3. Fallback to computing hash of BAMBU_M2M_SECRET in test/dev environments ONLY (strictly forbidden in production)
  if (process.env.NODE_ENV !== 'production' && validHashes.length === 0 && process.env.BAMBU_M2M_SECRET) {
    const rawSecret = process.env.BAMBU_M2M_SECRET.trim();
    if (rawSecret.length >= 32) {
      validHashes.push(
        crypto.createHash('sha256').update(rawSecret).digest('hex')
      );
    }
  }

  // Fail-closed if no M2M secret or hash is configured
  if (validHashes.length === 0) {
    return false;
  }

  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenBuf = Buffer.from(tokenHash, 'hex');

  for (const expectedHash of validHashes) {
    if (expectedHash.length !== 64) continue;
    try {
      const expectedBuf = Buffer.from(expectedHash, 'hex');
      if (tokenBuf.length === expectedBuf.length && crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
        return true;
      }
    } catch {}
  }

  return false;
}

export type BambuSyncAuthResult =
  | { type: 'session'; user: AuthUser; session: AdminSession }
  | { type: 'm2m'; scope: string }
  | Response;

export async function authenticateBambuSync(req: Request): Promise<BambuSyncAuthResult> {
  const authHeader = req.headers.get('authorization');
  const cookieHeader = req.headers.get('cookie') || '';
  const clientIp = extractClientIp(req);

  // Path A: Machine-to-Machine automation request
  if (authHeader && authHeader.startsWith('Bearer ') && !cookieHeader.includes('admin_session')) {
    const isValid = validateM2MToken(req, 'bambu:sync');
    if (!isValid) {
      // Throttle brute-force M2M attempts
      await checkRateLimit(`m2m_failed:${clientIp}`, 5, 15 * 60 * 1000);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid or incorrectly scoped machine credential' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Rate-limit automated invocations (max 10 sync calls per minute)
    const m2mRate = await checkRateLimit(`m2m_sync:${clientIp}`, 10, 60 * 1000);
    if (!m2mRate.allowed) {
      return new Response(
        JSON.stringify({ error: 'Too Many Requests: Machine sync rate limit exceeded' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
          },
        }
      );
    }

    // Immutable audit logging for M2M automation
    await logAuditEvent({
      action: 'M2M_BAMBU_SYNC',
      entityType: 'BAMBU_SYNC',
      ipAddress: clientIp,
      details: { scope: 'bambu:sync' },
    });

    return { type: 'm2m', scope: 'bambu:sync' };
  }

  // Path B: Interactive Administrator Session
  // Require CSRF validation: both GET and POST mutate print records on /api/bambu/sync
  if (cookieHeader.includes('admin_session')) {
    if (!validateOrigin(req)) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Cross-Site Request Forgery validation failed' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  const adminAuth = await requireAdminSession(req);
  if (adminAuth instanceof Response) {
    return adminAuth;
  }

  // Audit log for interactive administrator sync
  await logAuditEvent({
    userId: adminAuth.user.id,
    action: 'ADMIN_BAMBU_SYNC',
    entityType: 'BAMBU_SYNC',
    ipAddress: clientIp,
    details: { method: req.method },
  });

  return { type: 'session', user: adminAuth.user, session: adminAuth.session };
}

// --- 11. Re-export Server Session Guard for Server Components ---
export { verifyServerSession, type ServerAuthResult } from './server-auth';
