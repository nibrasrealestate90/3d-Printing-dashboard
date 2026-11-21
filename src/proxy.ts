import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16 Proxy Implementation
 * Node.js Runtime by default.
 * Handles hostname routing, canonical redirects, and internal rewrites.
 *
 * NOTE: Proxy is NOT the authoritative security boundary.
 * Authoritative security is enforced inside Server Components and API Route Handlers.
 */

// Helper to safely parse and sanitize hostname strings
function sanitizeHostname(val?: string | null): string | null {
  if (!val) return null;
  const cleaned = val.toLowerCase().trim().replace(/^https?:\/\//, '');
  const host = cleaned.split(':')[0].split('/')[0].trim();
  return host || null;
}

// Hostname configuration
function getHostnameSets() {
  const prodAppHost = sanitizeHostname(process.env.APP_HOSTNAME);
  const prodStoreHost = sanitizeHostname(process.env.STORE_HOSTNAME);
  const prodApexHost = sanitizeHostname(process.env.APEX_HOSTNAME);

  // Trusted Vercel deployment hostnames (exact hostnames only from trusted Vercel environment, never a blind wildcard)
  const vercelDeployHost = sanitizeHostname(process.env.VERCEL_URL);
  const vercelProdHost = sanitizeHostname(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const vercelBranchHost = sanitizeHostname(process.env.VERCEL_BRANCH_URL);

  const trustedVercelHosts = [
    vercelDeployHost,
    vercelProdHost,
    vercelBranchHost,
  ].filter((h): h is string => Boolean(h));

  const appHosts = new Set<string>([
    'app.lvh.me',
    ...(prodAppHost ? [prodAppHost] : []),
    ...trustedVercelHosts,
  ]);

  const storeHosts = new Set<string>([
    'www.lvh.me',
    ...(prodStoreHost ? [prodStoreHost] : []),
  ]);

  const apexHosts = new Set<string>([
    'lvh.me',
    ...(prodApexHost ? [prodApexHost] : []),
  ]);

  const localhostNames = new Set<string>(['localhost']);

  return { appHosts, storeHosts, apexHosts, localhostNames, prodStoreHost, prodApexHost };
}

export function proxy(req: NextRequest): NextResponse | Response {
  const { pathname, search } = req.nextUrl;

  // 1. Static asset and internal bypass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/health') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  // 1b. Canonical Redirects for moved Commercial & Reporting routes to Bambu Production App
  const legacyToBambuTabMap: Record<string, string> = {
    '/admin/orders': 'orders',
    '/admin/enquiries': 'enquiries',
    '/admin/customers': 'customers',
    '/admin/reports': 'reports',
    '/admin/quotations': 'enquiries',
  };

  if (legacyToBambuTabMap[pathname]) {
    const targetTab = legacyToBambuTabMap[pathname];
    const destination = new URL(`/?tab=${targetTab}`, req.url);
    return NextResponse.redirect(destination, 307);
  }

  // 2. Extract and sanitize Host header (Ignore untrusted X-Forwarded-Host)
  const rawHost = req.headers.get('host');
  if (!rawHost) {
    return new Response('Bad Request: Missing Host header', { status: 400 });
  }

  // Strip port (e.g., "app.lvh.me:3000" -> "app.lvh.me")
  const hostParts = rawHost.toLowerCase().split(':');
  const hostname = hostParts[0].trim();
  const port = hostParts.length > 1 ? hostParts[1].trim() : '';

  const { appHosts, storeHosts, apexHosts, localhostNames, prodStoreHost, prodApexHost } = getHostnameSets();

  // 3. Apex Hostname -> Canonical Storefront 308 Permanent Redirect
  if (apexHosts.has(hostname)) {
    let canonicalStoreHost: string;
    if (prodStoreHost && hostname === prodApexHost) {
      canonicalStoreHost = prodStoreHost;
    } else if (hostname === 'lvh.me') {
      canonicalStoreHost = `www.lvh.me${port ? `:${port}` : ''}`;
    } else {
      canonicalStoreHost = `www.${hostname}${port ? `:${port}` : ''}`;
    }

    const isProd = process.env.NODE_ENV === 'production' && !hostname.endsWith('.lvh.me');
    const protocol = isProd ? 'https' : 'http';
    const destination = `${protocol}://${canonicalStoreHost}${pathname}${search}`;
    return NextResponse.redirect(destination, 308);
  }

  // 4. Unknown Hostname / Direct IP Access Rejection (Default-Deny)
  const isAppHost = appHosts.has(hostname);
  const isStoreHost = storeHosts.has(hostname);
  const isLocalhost = localhostNames.has(hostname);

  if (!isAppHost && !isStoreHost && !isLocalhost) {
    return new Response('Invalid Hostname', { status: 400 });
  }

  // 5. Storefront Hostname Routing (www.<domain>, www.lvh.me)
  if (isStoreHost) {
    // Perimeter safety: Admin workspace and private APIs do not exist on storefront
    if (
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname === '/api/data' ||
      pathname.startsWith('/api/bambu') ||
      pathname.startsWith('/api/admin')
    ) {
      return new Response('Not Found', { status: 404 });
    }

    // Rewrite storefront root to /store
    const requestHeaders = new Headers(req.headers);
    if (pathname === '/') {
      requestHeaders.set('x-pathname', '/store');
      return NextResponse.rewrite(new URL('/store', req.url), {
        request: { headers: requestHeaders },
      });
    }

    requestHeaders.set('x-pathname', pathname);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // 6. Admin Hostname Routing (app.<domain>, app.lvh.me)
  if (isAppHost) {
    // If user accesses /store on the app domain, redirect to canonical store host
    if (pathname === '/store' || pathname.startsWith('/store/')) {
      const storeHost = prodStoreHost || `www.lvh.me${port ? `:${port}` : ''}`;
      const isProd = process.env.NODE_ENV === 'production' && !hostname.endsWith('.lvh.me');
      const protocol = isProd ? 'https' : 'http';
      return NextResponse.redirect(`${protocol}://${storeHost}${pathname}${search}`, 308);
    }

    // Rewrite admin root to /admin
    const requestHeaders = new Headers(req.headers);
    if (pathname === '/') {
      requestHeaders.set('x-pathname', '/admin');
      return NextResponse.rewrite(new URL('/admin', req.url), {
        request: { headers: requestHeaders },
      });
    }

    requestHeaders.set('x-pathname', pathname);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // 7. Localhost Hostname (localhost) - Preserve Existing Behavior Completely
  // Serves / as existing dashboard, permits /admin, /store, /login, /api/*
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export default proxy;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static JS/CSS)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public static assets by extension
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf|css|js)$).*)',
  ],
};
