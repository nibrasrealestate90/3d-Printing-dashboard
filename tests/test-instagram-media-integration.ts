import { validateInstagramItem } from '../src/lib/storefront';

function runTests() {
  console.log('========================================================================');
  console.log('  INSTAGRAM SHOWCASE & MEDIA LIBRARY INTEGRATION VERIFICATION');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name: string, condition: boolean, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(` ✅ [PASS] ${name}`);
    } else {
      console.error(` ❌ [FAIL] ${name}${details ? ` - ${details}` : ''}`);
    }
  }

  // 1. Test: Valid R2 Public Domain Image URL from Media Library
  const r2Item = validateInstagramItem({
    imageUrl: 'https://pub-abcdef123456.r2.dev/media/instagram/2026-11/dragon-print.jpg',
    caption: 'Dual-color silk copper dragon fresh off the X1C build plate.',
    postUrl: 'https://www.instagram.com/p/DFxyz123/',
    published: true,
  });
  assert(
    'R2 Public Domain Image URL from Media Library is accepted and sanitized',
    r2Item.valid &&
      r2Item.sanitized?.imageUrl ===
        'https://pub-abcdef123456.r2.dev/media/instagram/2026-11/dragon-print.jpg'
  );

  // 2. Test: Manual Local Path Image URL Fallback
  const localItem = validateInstagramItem({
    imageUrl: '/assets/images/hero_creations_dubai_1794842125042.jpg',
    caption: 'Dubai studio architectural model.',
    published: false,
  });
  assert(
    'Manual local asset path fallback is accepted',
    localItem.valid &&
      localItem.sanitized?.imageUrl === '/assets/images/hero_creations_dubai_1794842125042.jpg'
  );

  // 3. Test: Manual External HTTPS URL Entry
  const externalItem = validateInstagramItem({
    imageUrl: 'https://images.unsplash.com/photo-123456789.jpg',
    caption: 'Custom filament swatch test.',
    postUrl: 'https://instagram.com/p/12345',
  });
  assert(
    'Manual external HTTPS URL is accepted',
    externalItem.valid &&
      externalItem.sanitized?.imageUrl === 'https://images.unsplash.com/photo-123456789.jpg'
  );

  // 4. Test: Dangerous URL Schemes Rejected (XSS Prevention)
  const xssItem = validateInstagramItem({
    imageUrl: 'javascript:alert(1)',
    caption: 'Malicious post',
  });
  assert(
    'javascript: URL scheme is strictly rejected',
    !xssItem.valid && !!xssItem.errors.imageUrl
  );

  const dataUriItem = validateInstagramItem({
    imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
    caption: 'Data URI post',
  });
  assert(
    'data: URI scheme is strictly rejected',
    !dataUriItem.valid && !!dataUriItem.errors.imageUrl
  );

  // 5. Test: Caption Validation (Required and Length Limit)
  const emptyCaption = validateInstagramItem({
    imageUrl: 'https://pub-abcdef123456.r2.dev/media/instagram/sample.jpg',
    caption: '   ',
  });
  assert('Empty caption is rejected', !emptyCaption.valid && !!emptyCaption.errors.caption);

  const longCaption = validateInstagramItem({
    imageUrl: 'https://pub-abcdef123456.r2.dev/media/instagram/sample.jpg',
    caption: 'A'.repeat(501),
  });
  assert(
    'Caption exceeding 500 characters is rejected',
    !longCaption.valid && !!longCaption.errors.caption
  );

  // 6. Test: Post URL Protocol Validation
  const badPostUrl = validateInstagramItem({
    imageUrl: 'https://pub-abcdef123456.r2.dev/media/instagram/sample.jpg',
    caption: 'Valid caption',
    postUrl: 'ftp://instagram.com/p/123',
  });
  assert(
    'Non-HTTP/HTTPS Instagram URL protocol is rejected',
    !badPostUrl.valid && !!badPostUrl.errors.postUrl
  );

  // 7. Test: Optional Post URL Sanitization
  const noPostUrl = validateInstagramItem({
    imageUrl: 'https://pub-abcdef123456.r2.dev/media/instagram/sample.jpg',
    caption: 'Studio highlight without dedicated post link',
    postUrl: '',
  });
  assert(
    'Empty postUrl is permitted and sanitized to undefined',
    noPostUrl.valid && noPostUrl.sanitized?.postUrl === undefined
  );

  console.log('\n========================================================================');
  console.log(`SCORECARD: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
