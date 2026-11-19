import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const authResult = await requireAdminSession(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const { user, session } = authResult;

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
      },
      session: {
        id: session.id,
        expires_at: session.expires_at,
        created_at: session.created_at,
        last_active_at: session.last_active_at,
      },
    },
    { status: 200 }
  );
}
