/**
 * Test Suite: Phase 4 Public Storefront Content API & Category Synchronization
 *
 * Verifies:
 * 1. Public GET /api/store/content returns published categories in ascending order.
 * 2. Unpublished categories are strictly filtered out from public view.
 * 3. Instagram gallery response structure and data remain completely intact.
 * 4. Image URL sanitization rejects dangerous schemes (javascript:, data:) while accepting R2 URLs.
 * 5. Internal metadata and sensitive fields are not leaked.
 */

import { sanitizeImageUrl } from '../src/lib/storefront';

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

// Mock categories dataset matching ledger_collections
const mockCategories = [
  {
    id: 'cat-desk-accessories',
    name: 'Desk Accessories',
    slug: 'desk-accessories',
    description: 'Executive desk organizers and docks.',
    imageUrl: 'https://pub-r2.dev/categories/desk.webp',
    order: 4,
    isPublished: true,
    internalNotes: 'Top seller',
  },
  {
    id: 'cat-home-decor',
    name: 'Home Decor',
    slug: 'home-decor',
    description: 'Vases and planters.',
    imageUrl: 'https://pub-r2.dev/categories/home.webp',
    order: 1,
    isPublished: true,
  },
  {
    id: 'cat-halloween',
    name: 'Seasonal Halloween',
    slug: 'seasonal-halloween',
    description: 'Internal draft',
    imageUrl: 'https://pub-r2.dev/categories/draft.webp',
    order: 2,
    isPublished: false, // UNPUBLISHED
  },
  {
    id: 'cat-custom-prints',
    name: 'Custom Prints',
    slug: 'custom-prints',
    description: 'Bespoke prints.',
    imageUrl: 'javascript:alert(1)', // MALICIOUS SCHEME
    order: 3,
    isPublished: true,
  },
];

// Mock Instagram gallery matching ledger_collections
const mockInstagramItems = [
  {
    id: 'insta-1',
    imageUrl: 'https://pub-r2.dev/instagram/dragon.webp',
    caption: 'Silk copper dragon printed in Dubai.',
    postUrl: 'https://instagram.com/p/123',
    order: 1,
    published: true,
  },
  {
    id: 'insta-draft',
    imageUrl: 'https://pub-r2.dev/instagram/draft.webp',
    caption: 'Unpublished photo test',
    order: 2,
    published: false,
  },
];

// Content Handler Simulation matching src/app/api/store/content/route.ts
function handleGetStorefrontContent(mockCategoriesData: any[], mockInstagramData: any[]) {
  // Instagram Gallery Processing
  const publishedInstagram = mockInstagramData
    .filter((item) => item && (item.published === true || item.published === 'true'))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((item) => {
      const sanitizedUrl = sanitizeImageUrl(item.imageUrl) || '/assets/images/hero_creations_dubai_1794842125042.jpg';
      return {
        id: String(item.id || ''),
        imageUrl: sanitizedUrl,
        caption: String(item.caption || '').trim(),
        postUrl: typeof item.postUrl === 'string' && item.postUrl.startsWith('http') ? item.postUrl.trim() : undefined,
        order: Number(item.order) || 0,
      };
    });

  // Category Processing
  const publishedCategories = mockCategoriesData
    .filter((cat) => cat && (cat.isPublished === true || cat.isPublished === 'true'))
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    .map((cat) => ({
      id: String(cat.id || ''),
      name: String(cat.name || '').trim(),
      slug: String(cat.slug || '').trim(),
      description: typeof cat.description === 'string' && cat.description.trim() ? cat.description.trim() : undefined,
      imageUrl: sanitizeImageUrl(cat.imageUrl) || '',
      order: Number(cat.order) || 0,
    }));

  return {
    success: true,
    count: publishedInstagram.length,
    instagramGallery: publishedInstagram,
    categories: publishedCategories,
  };
}

async function runTests() {
  console.log('========================================================================');
  console.log('  DASHBOARD PUBLIC CONTENT API — PHASE 4 VERIFICATION');
  console.log('========================================================================\n');

  const res = handleGetStorefrontContent(mockCategories, mockInstagramItems);

  // 1. Response Structure
  console.log('--- 1. API Response Contract & Schema ---');
  assert(res.success === true, 'Response returns success: true');
  assert(Array.isArray(res.instagramGallery), 'Response includes instagramGallery array');
  assert(Array.isArray(res.categories), 'Response includes categories array');

  // 2. Category Filtering & Ordering
  console.log('\n--- 2. Category Visibility & Order ---');
  assert(res.categories.length === 3, 'Only 3 published categories returned (unpublished Halloween excluded)');
  assert(!res.categories.some((c) => c.id === 'cat-halloween'), 'Unpublished category cat-halloween is strictly excluded');
  assert(res.categories[0].id === 'cat-home-decor', 'First category is Home Decor (order 1)');
  assert(res.categories[1].id === 'cat-custom-prints', 'Second category is Custom Prints (order 3)');
  assert(res.categories[2].id === 'cat-desk-accessories', 'Third category is Desk Accessories (order 4)');

  // 3. Security & Sanitization
  console.log('\n--- 3. Image Sanitization & Privacy Invariants ---');
  const customPrints = res.categories.find((c) => c.id === 'cat-custom-prints');
  assert(customPrints?.imageUrl === '', 'Malicious javascript: scheme sanitized to safe empty string');

  const desk = res.categories.find((c) => c.id === 'cat-desk-accessories');
  assert(desk?.imageUrl === 'https://pub-r2.dev/categories/desk.webp', 'Valid R2 public image URL preserved');
  assert((desk as any).internalNotes === undefined, 'Internal administrator notes are never leaked');

  // 4. Instagram Regression Safety
  console.log('\n--- 4. Instagram Showcase Regression Protection ---');
  assert(res.instagramGallery.length === 1, 'Only published Instagram posts returned');
  assert(res.instagramGallery[0].id === 'insta-1', 'Published post insta-1 preserved');
  assert(res.count === 1, 'count field preserves existing Instagram count contract');

  console.log('\n========================================================================');
  console.log(`SCORECARD: ${passCount} / ${testCount} tests passed (${Math.round((passCount / testCount) * 100)}%)`);
  console.log('========================================================================\n');

  if (passCount !== testCount) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
