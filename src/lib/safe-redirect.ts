/**
 * Validates and sanitizes a post-login redirect path.
 *
 * Security Requirements:
 * - Accepts only safe relative paths within the trusted admin application workspace (/admin, /admin/*, /)
 * - Rejects absolute URLs (http:, https:, etc.)
 * - Rejects protocol-relative URLs (//)
 * - Rejects backslashes (\ or %5c)
 * - Rejects directory traversal (..)
 * - Rejects paths outside the admin workspace
 * - Rejects redirect loops back to login routes (/admin/login, /login)
 * - Rejects ASCII control characters and malformed URI encodings
 * - Defaults safely to '/admin'
 */
export function getSafeRedirectUrl(target: string | null | undefined): string {
  if (!target || typeof target !== 'string') {
    return '/admin';
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return '/admin';
  }

  // Reject ASCII control characters
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return '/admin';
  }

  // Reject backslashes in raw target
  if (trimmed.includes('\\')) {
    return '/admin';
  }

  // Reject protocol-relative or absolute URLs
  if (trimmed.startsWith('//') || trimmed.includes('://')) {
    return '/admin';
  }

  // Reject directory traversal attempts
  if (trimmed.includes('..')) {
    return '/admin';
  }

  // Decode URI components to catch encoded evasion attempts
  let decoded: string;
  try {
    decoded = decodeURIComponent(trimmed);
  } catch {
    return '/admin';
  }

  // Inspect decoded string for control chars, backslashes, traversal, protocol-relative
  if (
    /[\x00-\x1F\x7F]/.test(decoded) ||
    decoded.includes('\\') ||
    decoded.includes('..') ||
    decoded.startsWith('//') ||
    decoded.includes('://')
  ) {
    return '/admin';
  }

  // Must begin with '/' and not '//'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/admin';
  }

  // Check workspace boundary on both raw and decoded strings
  const isSafeAdminPath =
    (trimmed === '/' || trimmed === '/admin' || trimmed.startsWith('/admin/')) &&
    (decoded === '/' || decoded === '/admin' || decoded.startsWith('/admin/'));

  if (!isSafeAdminPath) {
    return '/admin';
  }

  // Prevent redirect loop back to login forms
  const isLoginRoute =
    decoded === '/admin/login' ||
    decoded === '/admin/login/' ||
    decoded.startsWith('/admin/login?') ||
    decoded === '/login' ||
    decoded === '/login/' ||
    decoded.startsWith('/login?');

  if (isLoginRoute) {
    return '/admin';
  }

  return trimmed;
}
