/**
 * Test Suite: Dashboard Public Content API Caching & Invariant Verification
 *
 * Verifies:
 * 1. GET /api/store/content sets strict no-store cache headers preventing stale edge/browser caching.
 * 2. 'Cache-Control' contains 'no-store, no-cache, must-revalidate, max-age=0'.
 * 3. 'CDN-Cache-Control' and 'Vercel-CDN-Cache-Control' are both 'no-store'.
 * 4. Response body includes all required fields: success, count, instagramGallery, categories.
 * 5. Published categories are correctly ordered ascending by order.
 * 6. Deleted categories (e.g. cat-demo-catagory) are absent from fresh responses.
 * 7. Instagram gallery response structure and items are intact.
 */

import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/store/content/route';

let testCount = 0;
let passCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  testCount++;
  if (condition) {
    passCount++;
    console.log(` ✅ [PASS] ${testName}`);
  } else {
    console.error(` ❌ [FAIL] ${testName}`);
    if (details) {
      console.error('    Details:', details);
    }
  }
}

async function run() {
  console.log('========================================================================');
  console.log('  DASHBOARD CONTENT API CACHE-CONTROL & INVARIANT TEST');
  console.log('========================================================================\n');

  const req = new NextRequest('http://localhost:3000/api/store/content');
  const res = await GET(req);

  console.log('--- 1. HTTP Status & Cache Control Headers ---');
  assert(res.status === 200, 'HTTP status is 200 OK');

  const cacheControl = res.headers.get('cache-control') || '';
  const cdnCacheControl = res.headers.get('cdn-cache-control') || '';
  const vercelCdnCacheControl = res.headers.get('vercel-cdn-cache-control') || '';

  console.log('  Cache-Control:', cacheControl);
  console.log('  CDN-Cache-Control:', cdnCacheControl);
  console.log('  Vercel-CDN-Cache-Control:', vercelCdnCacheControl);

  assert(cacheControl.includes('no-store'), 'Cache-Control header contains no-store');
  assert(cacheControl.includes('no-cache'), 'Cache-Control header contains no-cache');
  assert(cacheControl.includes('must-revalidate'), 'Cache-Control header contains must-revalidate');
  assert(cacheControl.includes('max-age=0'), 'Cache-Control header contains max-age=0');
  assert(cdnCacheControl === 'no-store', 'CDN-Cache-Control header is strictly "no-store"');
  assert(vercelCdnCacheControl === 'no-store', 'Vercel-CDN-Cache-Control header is strictly "no-store"');

  console.log('\n--- 2. JSON Response Contract & Structure ---');
  const data = await res.json();
  assert(data.success === true, 'Response contains success: true');
  assert(typeof data.count === 'number', 'Response contains numeric count field');
  assert(Array.isArray(data.instagramGallery), 'Response contains instagramGallery array');
  assert(Array.isArray(data.categories), 'Response contains categories array');

  console.log('\n--- 3. Category Sequential Ordering & Deletion Verification ---');
  const categories = data.categories as Array<{ id: string; name: string; order: number }>;
  console.log(`  Categories returned: ${categories.length}`);

  let isOrdered = true;
  for (let i = 1; i < categories.length; i++) {
    if ((categories[i].order || 0) < (categories[i - 1].order || 0)) {
      isOrdered = false;
      break;
    }
  }
  assert(isOrdered, 'Categories are strictly sorted in ascending order');

  const demoFound = categories.some(
    (c) => c.id === 'cat-demo-catagory' || c.name === 'demo catagory'
  );
  assert(!demoFound, 'Deleted category "cat-demo-catagory" is strictly absent from fresh response');

  console.log('\n--- 4. Instagram Gallery Intactness ---');
  console.log(`  Instagram items returned: ${data.instagramGallery.length}`);
  assert(data.instagramGallery.length >= 1, 'Instagram gallery items remain populated and intact');
  assert(data.count === data.instagramGallery.length, 'Count matches instagramGallery.length contract');

  console.log('\n========================================================================');
  console.log(`SCORECARD: ${passCount} / ${testCount} tests passed (${Math.round((passCount / testCount) * 100)}%)`);
  console.log('========================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
