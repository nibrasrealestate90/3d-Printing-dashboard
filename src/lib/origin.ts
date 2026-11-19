/**
 * Strict Storefront Origin Validator
 *
 * Security Requirements:
 * - Browser mutation endpoints (/enquiries, /quotes/presign, /quotes) MUST present a valid Origin header.
 * - Exact origin matching against configured storefront hosts and development ports.
 * - Scheme, hostname, and port must match exactly.
 * - Rejects null, empty, malformed, or untrusted origins.
 * - Rejects substring / suffix evasion attempts (e.g. evil-www.lvh.me or www.lvh.me.evil.com).
 * - Never trusts client-supplied X-Forwarded-* headers for origin verification.
 */

export interface OriginValidationResult {
  valid: boolean;
  reason?: string;
  origin?: string;
}

export function validateStorefrontOrigin(req: Request): OriginValidationResult {
  const originHeader = req.headers.get('origin')?.trim();

  // Browser mutation endpoints strictly require the Origin header
  if (!originHeader) {
    return {
      valid: false,
      reason: 'MISSING_ORIGIN: State mutation requests must include a valid Origin header.',
    };
  }

  if (originHeader.toLowerCase() === 'null') {
    return {
      valid: false,
      reason: 'NULL_ORIGIN: Null origins are strictly prohibited on state mutations.',
    };
  }

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return {
      valid: false,
      reason: 'MALFORMED_ORIGIN: Origin header cannot be parsed as a valid URL.',
    };
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const allowedOrigins = new Set<string>();

  if (isProduction) {
    // In production, strictly require https and exact configured storefront hostname
    const storeHostname = process.env.STORE_HOSTNAME?.trim().toLowerCase();
    if (storeHostname) {
      allowedOrigins.add(`https://${storeHostname}`);
    }
    const appHostname = process.env.APP_HOSTNAME?.trim().toLowerCase();
    if (appHostname) {
      allowedOrigins.add(`https://${appHostname}`);
    }
    if (process.env.STORE_ORIGIN) {
      allowedOrigins.add(process.env.STORE_ORIGIN.trim().toLowerCase());
    }
  } else {
    // In local development / test environments:
    // Support standard local development origins with exact port matching
    const devPort = process.env.PORT || '3000';
    const devHosts = [
      'localhost',
      '127.0.0.1',
      'www.lvh.me',
      'app.lvh.me',
      'lvh.me',
    ];
    for (const host of devHosts) {
      allowedOrigins.add(`http://${host}:${devPort}`);
      allowedOrigins.add(`http://${host}`);
    }
    if (process.env.STORE_HOSTNAME) {
      const h = process.env.STORE_HOSTNAME.trim().toLowerCase();
      allowedOrigins.add(`http://${h}:${devPort}`);
      allowedOrigins.add(`http://${h}`);
      allowedOrigins.add(`https://${h}`);
    }
    if (process.env.STORE_ORIGIN) {
      allowedOrigins.add(process.env.STORE_ORIGIN.trim().toLowerCase());
    }
  }

  const normalizedIncoming = parsedOrigin.origin.toLowerCase();
  if (!allowedOrigins.has(normalizedIncoming)) {
    return {
      valid: false,
      reason: `UNTRUSTED_ORIGIN: Origin "${originHeader}" is not in the configured storefront allowlist.`,
      origin: originHeader,
    };
  }

  return { valid: true, origin: normalizedIncoming };
}
