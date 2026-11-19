import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import {
  verifyPassword,
  createAdminSession,
  checkRateLimit,
  resetRateLimit,
  getAccountThrottleDelay,
  recordAccountFailure,
  logAuditEvent,
  extractClientIp,
  pruneExpiredSessions,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  AuthUser,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!sql) {
    return NextResponse.json(
      { error: 'Database service unavailable' },
      { status: 503 }
    );
  }

  const clientIp = extractClientIp(req);
  const userAgent = req.headers.get('user-agent') || undefined;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON request payload' },
      { status: 400 }
    );
  }

  const { email, password } = body || {};

  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json(
      { error: 'Email and password are required' },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  // --- DUAL-KEY RATE LIMITING & PROGRESSIVE THROTTLING (Remediation A) ---
  // 1. Hard IP-based limiter: 5 attempts per 15 minutes (900,000 ms)
  const ipRateLimitKey = `auth_login_ip:${clientIp}`;
  const ipLimit = await checkRateLimit(ipRateLimitKey, 5, 15 * 60 * 1000);

  if (!ipLimit.allowed) {
    await logAuditEvent({
      action: 'LOGIN_RATE_LIMITED',
      entityType: 'AUTH',
      ipAddress: clientIp,
      userAgent,
      details: {
        email: normalizedEmail,
        reason: 'IP_RATE_LIMIT_EXCEEDED',
        ipCount: ipLimit.count,
      },
    });

    const retryAfterSeconds = Math.max(1, Math.ceil((ipLimit.resetAt.getTime() - Date.now()) / 1000));

    return NextResponse.json(
      {
        error: 'Too many authentication attempts from this IP address. Please try again later.',
        retryAfter: retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSeconds),
        },
      }
    );
  }

  // 2. Account-based progressive throttling (prevents account-lockout DoS)
  // Check if account has accumulated failed attempts and apply bounded artificial delay
  const accountThrottleKey = `auth_login_account:${normalizedEmail}`;
  const { failureCount, delayMs } = await getAccountThrottleDelay(accountThrottleKey);

  if (failureCount >= 5) {
    await logAuditEvent({
      action: 'ACCOUNT_THROTTLE_WARNING',
      entityType: 'AUTH',
      ipAddress: clientIp,
      userAgent,
      details: {
        email: normalizedEmail,
        failureCount,
        appliedDelayMs: delayMs,
      },
    });
  }

  if (delayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  // 3. Query user from database
  const users = (await sql`
    SELECT id, email, password_hash, full_name, role, is_active, created_at, updated_at
    FROM public.users
    WHERE email = ${normalizedEmail}
    LIMIT 1;
  `) as (AuthUser & { password_hash: string })[];

  const user = users[0];

  if (!user || !user.is_active) {
    // Record account-level failure to increment progressive throttle
    await recordAccountFailure(accountThrottleKey);

    await logAuditEvent({
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      ipAddress: clientIp,
      userAgent,
      details: { email: normalizedEmail, reason: 'User not found or inactive' },
    });

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // 4. Verify Argon2id password hash
  const isValidPassword = await verifyPassword(user.password_hash, password);
  if (!isValidPassword) {
    // Record account-level failure to increment progressive throttle
    await recordAccountFailure(accountThrottleKey);

    await logAuditEvent({
      userId: user.id,
      action: 'LOGIN_FAILED',
      entityType: 'AUTH',
      ipAddress: clientIp,
      userAgent,
      details: { email: normalizedEmail, reason: 'Invalid password' },
    });

    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  // 5. Successful login: reset both IP rate limiter and account throttle counters
  await resetRateLimit(ipRateLimitKey);
  await resetRateLimit(accountThrottleKey);

  // 6. Trigger bounded background session and rate-limit cleanup (throttled internally)
  pruneExpiredSessions().catch(err => console.error('Background session pruning failed:', err));

  // 7. Create database session
  const { rawToken, session } = await createAdminSession(user.id, {
    userAgent,
    ipAddress: clientIp,
  });

  // 8. Record audit log for successful login
  await logAuditEvent({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    entityType: 'AUTH',
    entityId: session.id,
    ipAddress: clientIp,
    userAgent,
    details: { email: normalizedEmail, role: user.role },
  });

  // 9. Configure secure HTTP-only session cookie
  const isSecure =
    process.env.NODE_ENV === 'production' ||
    req.headers.get('x-forwarded-proto') === 'https';

  const response = NextResponse.json(
    {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    },
    { status: 200 }
  );

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: rawToken,
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
