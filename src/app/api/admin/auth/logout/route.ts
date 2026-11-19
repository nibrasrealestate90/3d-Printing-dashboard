import { NextRequest, NextResponse } from 'next/server';
import {
  extractSessionToken,
  revokeSession,
  validateSession,
  logAuditEvent,
  extractClientIp,
  validateOrigin,
  SESSION_COOKIE_NAME,
} from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!validateOrigin(req)) {
    return NextResponse.json(
      { error: 'Forbidden: Cross-Site Request Forgery validation failed' },
      { status: 403 }
    );
  }

  const clientIp = extractClientIp(req);
  const userAgent = req.headers.get('user-agent') || undefined;
  const token = extractSessionToken(req);

  if (token) {
    const auth = await validateSession(token);
    await revokeSession(token);

    if (auth) {
      await logAuditEvent({
        userId: auth.user.id,
        action: 'LOGOUT',
        entityType: 'AUTH',
        entityId: auth.session.id,
        ipAddress: clientIp,
        userAgent,
        details: { email: auth.user.email },
      });
    }
  }

  const response = NextResponse.json(
    { success: true, message: 'Logged out successfully' },
    { status: 200 }
  );

  // Clear session cookie
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });

  return response;
}
