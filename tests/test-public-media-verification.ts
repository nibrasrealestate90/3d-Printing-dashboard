/**
 * ============================================================================
 * TEST SUITE: PUBLIC MEDIA R2 VERIFICATION & CAD VAULT ISOLATION
 * ============================================================================
 *
 * Validates:
 * 1. Successful HEAD response (HTTP 200) from public domain
 * 2. Missing object (HTTP 404)
 * 3. Public-domain server error (HTTP 500)
 * 4. Inaccessible / Forbidden object (HTTP 403)
 * 5. Network connectivity failure
 * 6. Network timeout / aborted request
 * 7. Invalid storage keys (traversal, prefix, backslash, empty)
 * 8. Missing or malformed public-domain configuration
 * 9. Filename containing spaces and special characters (URL encoding)
 * 10. Oversized object (> 10 MB) & invalid MIME rejection
 * 11. SSRF prevention / origin pinning
 * 12. Complete isolation & non-regression of private CAD verification (src/lib/r2.ts)
 */

import assert from 'node:assert';
import {
  verifyPublicMediaObject,
  registerMockMediaObject,
  clearMockMediaObjects,
  PublicMediaVerificationResult,
} from '../src/lib/media-storage';
import {
  verifyUploadedObject,
  registerMockUploadedObject,
  clearMockUploadedObjects,
} from '../src/lib/r2';

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> | void {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          passedTests++;
          console.log(`  ✅ [PASS] ${name}`);
        })
        .catch((err) => {
          console.error(`  ❌ [FAIL] ${name}`);
          console.error(`     Error: ${err.message}`);
          throw err;
        });
    } else {
      passedTests++;
      console.log(`  ✅ [PASS] ${name}`);
    }
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function main() {
  console.log('========================================================================');
  console.log('  TESTING PUBLIC MEDIA R2 VERIFICATION & CAD ISOLATION');
  console.log('========================================================================\n');

  const DUMMY_PUBLIC_DOMAIN = 'https://pub-b19d7b7c8ecc459f9b1cff7a7e30c0aa.r2.dev';

  // --------------------------------------------------------------------------
  // Test 1: Successful HEAD response (200)
  // --------------------------------------------------------------------------
  await runTest('Successful HEAD response (200) verifies object metadata', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedCache = '';

    const mockFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedMethod = init?.method || '';
      capturedCache = init?.cache || '';
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Length': '204800',
          'Content-Type': 'image/jpeg',
          'ETag': '"e2fc714c4727ee9395f324cd2e7f331f"',
        },
      });
    }) as typeof fetch;

    const result = await verifyPublicMediaObject(
      'media/products/2026-11/sample-photo.jpg',
      204800,
      'image/jpeg',
      {
        publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
        customFetch: mockFetch,
        forceLiveVerification: true,
      }
    );

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.actualSizeBytes, 204800);
    assert.strictEqual(result.contentType, 'image/jpeg');
    assert.strictEqual(result.etag, 'e2fc714c4727ee9395f324cd2e7f331f');
    assert.strictEqual(capturedMethod, 'HEAD');
    assert.strictEqual(capturedCache, 'no-store');
    assert.strictEqual(
      capturedUrl,
      `${DUMMY_PUBLIC_DOMAIN}/media/products/2026-11/sample-photo.jpg`
    );
  });

  // --------------------------------------------------------------------------
  // Test 2: Missing object (404)
  // --------------------------------------------------------------------------
  await runTest('Missing object (404) returns OBJECT_NOT_FOUND', async () => {
    const mockFetch = (async () => {
      return new Response(null, { status: 404 });
    }) as typeof fetch;

    const result = await verifyPublicMediaObject(
      'media/products/2026-11/nonexistent.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
        customFetch: mockFetch,
        forceLiveVerification: true,
      }
    );

    assert.strictEqual(result.verified, false);
    assert.ok(result.error?.includes('OBJECT_NOT_FOUND'));
  });

  // --------------------------------------------------------------------------
  // Test 3: Public-domain server error (500)
  // --------------------------------------------------------------------------
  await runTest('Public-domain server error (500) returns STORAGE_ERROR', async () => {
    const mockFetch = (async () => {
      return new Response(null, { status: 500, statusText: 'Internal Server Error' });
    }) as typeof fetch;

    const result = await verifyPublicMediaObject(
      'media/products/2026-11/server-error.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
        customFetch: mockFetch,
        forceLiveVerification: true,
      }
    );

    assert.strictEqual(result.verified, false);
    assert.ok(result.error?.includes('STORAGE_ERROR'));
    assert.ok(result.error?.includes('HTTP 500'));
  });

  // --------------------------------------------------------------------------
  // Test 4: Inaccessible / Forbidden object (403)
  // --------------------------------------------------------------------------
  await runTest('Forbidden object (403) returns STORAGE_INACCESSIBLE', async () => {
    const mockFetch = (async () => {
      return new Response(null, { status: 403 });
    }) as typeof fetch;

    const result = await verifyPublicMediaObject(
      'media/products/2026-11/private-denied.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
        customFetch: mockFetch,
        forceLiveVerification: true,
      }
    );

    assert.strictEqual(result.verified, false);
    assert.ok(result.error?.includes('STORAGE_INACCESSIBLE'));
    assert.ok(result.error?.includes('HTTP 403'));
  });

  // --------------------------------------------------------------------------
  // Test 5: Network failure
  // --------------------------------------------------------------------------
  await runTest('Network connectivity failure returns STORAGE_CONNECTIVITY_ERROR', async () => {
    const mockFetch = (async () => {
      throw new Error('getaddrinfo ENOTFOUND pub-b19d7b7c8ecc459f9b1cff7a7e30c0aa.r2.dev');
    }) as typeof fetch;

    const result = await verifyPublicMediaObject(
      'media/products/2026-11/network-fail.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
        customFetch: mockFetch,
        forceLiveVerification: true,
      }
    );

    assert.strictEqual(result.verified, false);
    assert.ok(result.error?.includes('STORAGE_CONNECTIVITY_ERROR'));
    assert.ok(result.error?.includes('ENOTFOUND'));
  });

  // --------------------------------------------------------------------------
  // Test 6: Timeout
  // --------------------------------------------------------------------------
  await runTest('Network request timeout returns STORAGE_TIMEOUT', async () => {
    const mockFetch = (async () => {
      const abortError = new Error('The operation was aborted due to timeout');
      abortError.name = 'AbortError';
      throw abortError;
    }) as typeof fetch;

    const result = await verifyPublicMediaObject(
      'media/products/2026-11/timeout.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
        customFetch: mockFetch,
        timeoutMs: 50,
        forceLiveVerification: true,
      }
    );

    assert.strictEqual(result.verified, false);
    assert.ok(result.error?.includes('STORAGE_TIMEOUT'));
  });

  // --------------------------------------------------------------------------
  // Test 7: Invalid storage keys (prefix, traversal, backslash, empty)
  // --------------------------------------------------------------------------
  await runTest('Invalid storage key paths are rejected with INVALID_STORAGE_KEY', async () => {
    const badKeys = [
      '',
      '   ',
      'uploads/products/2026-11/test.jpg',
      'media/../etc/passwd',
      'media/products/../../secret',
      'media\\products\\backslash.jpg',
      'cad/vault/private.step',
    ];

    for (const key of badKeys) {
      const result = await verifyPublicMediaObject(key, 1000, 'image/jpeg');
      assert.strictEqual(result.verified, false, `Key "${key}" must be rejected`);
      assert.ok(
        result.error?.includes('INVALID_STORAGE_KEY'),
        `Key "${key}" must produce INVALID_STORAGE_KEY error`
      );
    }
  });

  // --------------------------------------------------------------------------
  // Test 8: Missing or malformed public-domain configuration
  // --------------------------------------------------------------------------
  await runTest('Missing or invalid public domain returns CONFIGURATION_ERROR', async () => {
    // Missing domain
    const emptyDomainResult = await verifyPublicMediaObject(
      'media/products/2026-11/sample.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: '',
        forceLiveVerification: true,
      }
    );
    assert.strictEqual(emptyDomainResult.verified, false);
    assert.ok(emptyDomainResult.error?.includes('CONFIGURATION_ERROR'));
    assert.ok(emptyDomainResult.error?.includes('R2_PUBLIC_DOMAIN'));

    // Malformed URL
    const invalidDomainResult = await verifyPublicMediaObject(
      'media/products/2026-11/sample.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: 'not-a-valid-url',
        forceLiveVerification: true,
      }
    );
    assert.strictEqual(invalidDomainResult.verified, false);
    assert.ok(invalidDomainResult.error?.includes('CONFIGURATION_ERROR'));

    // Non-HTTP protocol
    const badProtocolResult = await verifyPublicMediaObject(
      'media/products/2026-11/sample.jpg',
      1000,
      'image/jpeg',
      {
        publicDomainOverride: 'ftp://files.example.com',
        forceLiveVerification: true,
      }
    );
    assert.strictEqual(badProtocolResult.verified, false);
    assert.ok(badProtocolResult.error?.includes('CONFIGURATION_ERROR'));
  });

  // --------------------------------------------------------------------------
  // Test 9: Filename containing spaces and special characters
  // --------------------------------------------------------------------------
  await runTest('Filename with spaces and special characters encodes cleanly', async () => {
    let capturedUrl = '';

    const mockFetch = (async (input: RequestInfo | URL) => {
      capturedUrl = String(input);
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Length': '512000',
          'Content-Type': 'image/png',
          'ETag': '"special-char-etag"',
        },
      });
    }) as typeof fetch;

    const specialKey = 'media/products/2026-11/my hero #1 (v2.0 & final).png';
    const result = await verifyPublicMediaObject(specialKey, 512000, 'image/png', {
      publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
      customFetch: mockFetch,
      forceLiveVerification: true,
    });

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.contentType, 'image/png');
    // Ensure URI segments were percent-encoded
    assert.strictEqual(
      capturedUrl,
      `${DUMMY_PUBLIC_DOMAIN}/media/products/2026-11/my%20hero%20%231%20(v2.0%20%26%20final).png`
    );
  });

  // --------------------------------------------------------------------------
  // Test 10: Size and MIME constraints on 200 responses
  // --------------------------------------------------------------------------
  await runTest('200 responses enforce 10 MB size limit and accepted image MIME types', async () => {
    // Oversized response
    const oversizedFetch = (async () => {
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Length': '15728640', // 15 MB
          'Content-Type': 'image/jpeg',
        },
      });
    }) as typeof fetch;

    const oversizedRes = await verifyPublicMediaObject('media/products/big.jpg', 1000, 'image/jpeg', {
      publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
      customFetch: oversizedFetch,
      forceLiveVerification: true,
    });
    assert.strictEqual(oversizedRes.verified, false);
    assert.ok(oversizedRes.error?.includes('OBJECT_TOO_LARGE'));

    // Non-image MIME response
    const badMimeFetch = (async () => {
      return new Response(null, {
        status: 200,
        headers: {
          'Content-Length': '1024',
          'Content-Type': 'application/pdf',
        },
      });
    }) as typeof fetch;

    const badMimeRes = await verifyPublicMediaObject('media/products/doc.jpg', 1000, 'image/jpeg', {
      publicDomainOverride: DUMMY_PUBLIC_DOMAIN,
      customFetch: badMimeFetch,
      forceLiveVerification: true,
    });
    assert.strictEqual(badMimeRes.verified, false);
    assert.ok(badMimeRes.error?.includes('INVALID_CONTENT_TYPE'));
  });

  // --------------------------------------------------------------------------
  // Test 11: Mock registry backward compatibility
  // --------------------------------------------------------------------------
  await runTest('In-memory mock registry functions without network calls', async () => {
    registerMockMediaObject('media/products/mock-item.webp', {
      sizeBytes: 123456,
      mimeType: 'image/webp',
      etag: 'mock-webp-etag',
    });

    const result = await verifyPublicMediaObject(
      'media/products/mock-item.webp',
      123456,
      'image/webp'
    );

    clearMockMediaObjects();

    assert.strictEqual(result.verified, true);
    assert.strictEqual(result.actualSizeBytes, 123456);
    assert.strictEqual(result.contentType, 'image/webp');
    assert.strictEqual(result.etag, 'mock-webp-etag');
  });

  // --------------------------------------------------------------------------
  // Test 12: Private CAD verification isolation (src/lib/r2.ts)
  // --------------------------------------------------------------------------
  await runTest('Private CAD verification remains completely functional and isolated', async () => {
    // 1. Valid CAD object verification
    registerMockUploadedObject('uploads/quotes/quote_123/part.step', {
      sizeBytes: 25 * 1024 * 1024, // 25 MB (within 50 MB CAD limit)
      mimeType: 'model/step',
      etag: 'cad-etag-123',
    });

    const cadValid = await verifyUploadedObject(
      'uploads/quotes/quote_123/part.step',
      25 * 1024 * 1024,
      'model/step'
    );

    assert.strictEqual(cadValid.verified, true);
    assert.strictEqual(cadValid.actualSizeBytes, 25 * 1024 * 1024);
    assert.strictEqual(cadValid.contentType, 'model/step');

    // 2. Oversized CAD object (> 50 MB)
    registerMockUploadedObject('uploads/quotes/quote_123/huge_assembly.step', {
      sizeBytes: 55 * 1024 * 1024, // 55 MB (> 50 MB CAD limit)
      mimeType: 'model/step',
      etag: 'cad-etag-huge',
    });

    const cadOversized = await verifyUploadedObject(
      'uploads/quotes/quote_123/huge_assembly.step',
      55 * 1024 * 1024,
      'model/step'
    );

    clearMockUploadedObjects();

    assert.strictEqual(cadOversized.verified, false);
    assert.ok(cadOversized.error?.includes('OBJECT_TOO_LARGE'));
    assert.ok(cadOversized.error?.includes('50 MB'));
  });

  console.log('\n========================================================================');
  console.log(`  VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('========================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
