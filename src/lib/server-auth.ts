import { cookies, headers } from 'next/headers';
import {
  validateSession,
  SESSION_COOKIE_NAME,
  DatabaseUnavailableError,
  type AuthUser,
  type AdminSession,
} from './auth';

export interface ServerAuthResult {
  authenticated: boolean;
  user?: AuthUser;
  session?: AdminSession;
  status: 'authenticated' | 'unauthenticated' | 'db_unavailable' | 'storefront_blocked';
  error?: string;
}

/**
 * Server Component & Server Layout Session Guard
 * Authoritatively validates administrator session cookies against PostgreSQL.
 *
 * Edge cases handled:
 * 1. Storefront Hostname: Returns 'storefront_blocked' (defense-in-depth).
 * 2. Missing/invalid/expired/revoked session: Returns 'unauthenticated'.
 * 3. Database connection down/timeout: Returns 'db_unavailable' without silent login redirect.
 * 4. Active valid session: Returns 'authenticated' with User and Session profiles.
 */
export async function verifyServerSession(): Promise<ServerAuthResult> {
  let headerList: Headers;
  try {
    headerList = await headers();
  } catch {
    headerList = new Headers();
  }

  const hostHeader = headerList.get('host') || '';
  const rawHostname = hostHeader.toLowerCase().split(':')[0].trim();

  // 1. Storefront Hostname Perimeter Check (Defense-in-Depth)
  const prodStoreHost = process.env.STORE_HOSTNAME?.toLowerCase().trim();
  const storeHosts = new Set<string>([
    'www.lvh.me',
    ...(prodStoreHost ? [prodStoreHost] : []),
  ]);

  if (storeHosts.has(rawHostname)) {
    return {
      authenticated: false,
      status: 'storefront_blocked',
      error: 'Private administrator workspaces cannot be accessed from public storefront hostname',
    };
  }

  // 2. Extract Session Token from cookies
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch {
    return {
      authenticated: false,
      status: 'unauthenticated',
      error: 'Unable to read request cookies',
    };
  }

  const token =
    cookieStore.get(SESSION_COOKIE_NAME)?.value ||
    cookieStore.get('admin_session')?.value ||
    cookieStore.get('__Host-admin_session')?.value;

  if (!token) {
    return {
      authenticated: false,
      status: 'unauthenticated',
      error: 'No administrator session cookie found',
    };
  }

  // 3. Authoritative Session Validation in PostgreSQL
  try {
    const auth = await validateSession(token);
    if (!auth) {
      return {
        authenticated: false,
        status: 'unauthenticated',
        error: 'Session has expired, been revoked, or is invalid',
      };
    }

    return {
      authenticated: true,
      status: 'authenticated',
      user: auth.user,
      session: auth.session,
    };
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError || err.name === 'DatabaseUnavailableError') {
      return {
        authenticated: false,
        status: 'db_unavailable',
        error: 'PostgreSQL database service unavailable. Please retry momentarily.',
      };
    }
    console.error('Unexpected error during server session verification:', err);
    return {
      authenticated: false,
      status: 'db_unavailable',
      error: 'Session verification service failure.',
    };
  }
}
