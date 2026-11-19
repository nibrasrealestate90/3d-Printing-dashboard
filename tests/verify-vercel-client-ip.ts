import { extractClientIp } from '../src/lib/auth';

interface TestCase {
  name: string;
  category: string;
  fn: () => boolean | Promise<boolean>;
  expected: string;
}

const tests: TestCase[] = [];
let passedCount = 0;
let failedCount = 0;

function it(category: string, name: string, expected: string, fn: () => boolean | Promise<boolean>) {
  tests.push({ name, category, expected, fn });
}

// Save initial env to restore later
const origEnv = { ...process.env };

function resetEnv() {
  process.env = { ...origEnv };
}

// ----------------------------------------------------------------------------
// Test Suite: Vercel Client IP Extraction & Security Invariants
// ----------------------------------------------------------------------------

// --- 1. Valid Single IPv4 & IPv6 Addresses on Vercel ---
it('Vercel Edge Proxy', 'VERCEL=1 with valid single IPv4 returns that IP', '203.0.113.195', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '203.0.113.195' },
  });
  return extractClientIp(req) === '203.0.113.195';
});

it('Vercel Edge Proxy', 'VERCEL=1 with valid single IPv6 returns that IP', '2001:db8::8a2e:370:7334', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '2001:db8::8a2e:370:7334' },
  });
  return extractClientIp(req) === '2001:db8::8a2e:370:7334';
});

// --- 2. Surrounding Whitespace Handling ---
it('Vercel Edge Proxy', 'VERCEL=1 with surrounding whitespace trims and returns valid IPv4', '203.0.113.195', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '   203.0.113.195   ' },
  });
  return extractClientIp(req) === '203.0.113.195';
});

it('Vercel Edge Proxy', 'VERCEL=1 with surrounding whitespace trims and returns valid IPv6', '2001:db8::1', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '  2001:db8::1 \t ' },
  });
  return extractClientIp(req) === '2001:db8::1';
});

// --- 3. Comma-Separated Values Strictly Rejected (Direct Vercel Mode) ---
it('Strict Single IP Enforcement', 'VERCEL=1 with comma-separated chain is rejected and throws UNVERIFIED_CLIENT_IP', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '198.51.100.42, 76.76.21.21' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Strict Single IP Enforcement', 'VERCEL=1 with comma and trailing space is rejected', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '203.0.113.195 , 10.0.0.1' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Strict Single IP Enforcement', 'VERCEL=1 with standalone comma is rejected', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': ',' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

// --- 4. Malformed Values & Missing Header (Fail-Closed) ---
it('Fail-Closed Invariants', 'VERCEL=1 with missing header throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login');
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Fail-Closed Invariants', 'VERCEL=1 with empty header throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Fail-Closed Invariants', 'VERCEL=1 with whitespace-only header throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '    ' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Fail-Closed Invariants', 'VERCEL=1 with malformed non-IP string throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': 'invalid-ip-string' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Fail-Closed Invariants', 'VERCEL=1 with out-of-range IP octets throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '999.999.999.999' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Fail-Closed Invariants', 'VERCEL=1 with incomplete IP string throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '192.168.1' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

it('Fail-Closed Invariants', 'VERCEL=1 with embedded internal whitespace throws UNVERIFIED_CLIENT_IP in production', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  process.env.VERCEL = '1';
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '203.0. 113.195' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

// --- 5. Security Boundary (Non-Vercel Deployments) ---
it('Security Boundary', 'Direct non-Vercel production ignores spoofed x-vercel-forwarded-for header', 'Throws UNVERIFIED_CLIENT_IP', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  delete process.env.VERCEL;
  delete process.env.TRUSTED_PROXY;

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-vercel-forwarded-for': '203.0.113.195' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('UNVERIFIED_CLIENT_IP');
  }
});

// --- 6. Cloudflare Mode Regression Safety ---
it('Cloudflare Regression', 'Cloudflare mode with CF_INGRESS_VERIFIED=true returns cf-connecting-ip', '198.51.100.99', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  delete process.env.VERCEL;
  process.env.TRUSTED_PROXY = 'cloudflare';
  process.env.CF_INGRESS_VERIFIED = 'true';

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'cf-connecting-ip': '198.51.100.99' },
  });
  return extractClientIp(req) === '198.51.100.99';
});

it('Cloudflare Regression', 'Cloudflare mode without CF_INGRESS_VERIFIED throws CRITICAL_INGRESS_CONFIGURATION_ERROR in production', 'Throws CRITICAL_INGRESS_CONFIGURATION_ERROR', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  delete process.env.VERCEL;
  process.env.TRUSTED_PROXY = 'cloudflare';
  process.env.CF_INGRESS_VERIFIED = 'false';

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'cf-connecting-ip': '198.51.100.99' },
  });
  try {
    extractClientIp(req);
    return false;
  } catch (err: any) {
    return err.message.includes('CRITICAL_INGRESS_CONFIGURATION_ERROR');
  }
});

// --- 7. Generic Reverse Proxy Regression Safety ---
it('Generic Proxy Regression', 'Generic trusted reverse proxy chain walk extracts real client IP', '203.0.113.50', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'production';
  delete process.env.VERCEL;
  process.env.TRUSTED_PROXY = 'true';
  process.env.TRUSTED_PROXY_IPS = '10.0.0.1, 10.0.0.2';

  const req = new Request('https://app.printstudio.ae/api/admin/auth/login', {
    headers: { 'x-forwarded-for': '203.0.113.50, 10.0.0.1, 10.0.0.2' },
  });
  return extractClientIp(req) === '203.0.113.50';
});

// --- 8. Development Fallback ---
it('Development Fallback', 'Development direct connection retains safe 127.0.0.1 loopback', '127.0.0.1', () => {
  resetEnv();
  (process.env as any).NODE_ENV = 'development';
  delete process.env.VERCEL;
  delete process.env.TRUSTED_PROXY;

  const req = new Request('http://localhost:3000/api/admin/auth/login');
  return extractClientIp(req) === '127.0.0.1';
});

// Execute test suite
async function run() {
  console.log('========================================================================');
  console.log('  VERCEL CLIENT IP DETECTION & SECURITY REGRESSION TEST SUITE');
  console.log('========================================================================\n');

  for (const t of tests) {
    let result = false;
    let errorDetail = '';
    try {
      result = await t.fn();
    } catch (e: any) {
      result = false;
      errorDetail = ` (threw: ${e.message})`;
    }

    if (result) {
      passedCount++;
      console.log(`✅ [${t.category}] ${t.name}: PASS (Expected: ${t.expected})`);
    } else {
      failedCount++;
      console.log(`❌ [${t.category}] ${t.name}: FAIL (Expected: ${t.expected}${errorDetail})`);
    }
  }

  resetEnv();

  console.log('\n========================================================================');
  console.log(`Total Tests Executed : ${tests.length}`);
  console.log(`Passed               : ${passedCount} ✅`);
  console.log(`Failed               : ${failedCount} ❌`);
  console.log(`Success Rate         : ${((passedCount / tests.length) * 100).toFixed(1)}%`);
  console.log('========================================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

run();
