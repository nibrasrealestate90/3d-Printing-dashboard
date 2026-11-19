import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { verifyServerSession } from '@/lib/server-auth';
import { DatabaseUnavailableCard } from '@/components/auth/DatabaseUnavailableCard';

export const metadata: Metadata = {
  title: 'Print Studio Ledger — Administrator Workspace',
  description: 'Secure business management and additive manufacturing console for Dubai Print Studio.',
};

/**
 * Authoritative Server Component Session Layout
 * Protects all administrative routes under /admin/*.
 *
 * Security Guarantees:
 * 1. Bypasses /admin/login so guests can authenticate.
 * 2. Rejects public storefront hostnames (defense-in-depth perimeter gate).
 * 3. Handles PostgreSQL database outages gracefully with HTTP 503 card instead of silent login redirect.
 * 4. Redirects unauthenticated, expired, or revoked sessions to /login?redirect=...
 * 5. Passes authenticated user profile downstream to protected workspace children.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headerList = await headers();
  const pathname =
    headerList.get('x-pathname') ||
    headerList.get('next-url') ||
    '';

  // 1. Bypass authentication check strictly for administrative login page (exact match)
  if (pathname === '/admin/login' || pathname === '/admin/login/') {
    return <>{children}</>;
  }

  // 2. Authoritative Server Session Verification
  const auth = await verifyServerSession();

  // 3. Defense-in-depth: Rejection of private workspace requests from storefront host
  if (auth.status === 'storefront_blocked') {
    notFound();
  }

  // 4. Database Unavailable Handling
  // Never silently redirect to login when database is down, avoiding false bad-credential impressions
  if (auth.status === 'db_unavailable') {
    return <DatabaseUnavailableCard error={auth.error} />;
  }

  // 5. Unauthenticated / Expired / Revoked Session: Redirect to Login Page
  if (!auth.authenticated || !auth.user) {
    const redirectParam =
      pathname && pathname !== '/' && pathname !== '/admin'
        ? `?redirect=${encodeURIComponent(pathname)}`
        : '';
    redirect(`/login${redirectParam}`);
  }

  // 6. Active Session Authenticated: Render Workspace Root
  return (
    <div
      className="admin-workspace-guard-root"
      data-testid="admin-workspace-guard-root"
      data-user-id={auth.user.id}
      data-user-role={auth.user.role}
    >
      {children}
    </div>
  );
}
