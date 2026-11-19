import http from 'http';
import crypto from 'crypto';
import { sql, withTransaction } from '../src/lib/db';
import {
  sanitizeImageUrl,
  sanitizeProductForStorefront,
  validateQuoteInput,
} from '../src/lib/storefront';
import {
  validateCadFile,
  generatePresignedPutUrl,
  generateStorageKey,
  verifyUploadedObject,
  setCustomMockVerifier,
  clearMockUploadedObjects,
} from '../src/lib/r2';
import { splitSqlStatements } from '../scripts/migrate';

interface TestResult {
  id: number;
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(
  id: number,
  name: string,
  category: string,
  passed: boolean,
  expected: string,
  actual: string
) {
  const status: 'PASS' | 'FAIL' = passed ? 'PASS' : 'FAIL';
  results.push({ id, name, category, status, expected, actual });
  console.log(
    ` ${passed ? '✅' : '❌'} [Req ${id}] ${name}: ${status} (Actual: ${actual})`
  );
}

function makeRequest(options: {
  hostname?: string;
  port?: number;
  path?: string;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: options.hostname || '127.0.0.1',
        port: options.port || 3000,
        path: options.path || '/',
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            body,
          });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function runPhase241RemediationVerification() {
  console.log('========================================================================');
  console.log('  PHASE 2.4.1 — PRODUCTION SECURITY REMEDIATIONS VERIFICATION');
  console.log('========================================================================\n');

  if (!sql) {
    console.error('❌ Critical: DATABASE_URL not configured. Aborting verification.');
    process.exit(1);
  }

  // Clear rate limits for clean test run
  await sql`DELETE FROM public.rate_limits WHERE key LIKE 'store_%' OR key LIKE 'quote_%';`.catch(() => {});

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Secure CAD Upload Lifecycle & Capability Token Security
    // ------------------------------------------------------------------------
    console.log('--- Section 1: Secure CAD Upload Lifecycle & Capability Tokens ---');

    // Test 1: Client-supplied storageKey is strictly rejected
    const clientStorageKeyPayload = {
      customerName: 'Attacker Test',
      customerEmail: 'attacker@evil.com',
      projectTitle: 'Malicious Path Traversal Attempt',
      projectDescription: 'Attempting to inject arbitrary storage key into quote.',
      quantity: 1,
      storageKey: 'uploads/rfq/../../etc/passwd',
      fileName: 'passwd',
      fileSizeBytes: 1024,
    };
    const resForbiddenKey = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clientStorageKeyPayload),
    });
    const parsedForbiddenKey = JSON.parse(resForbiddenKey.body || '{}');
    const hasForbiddenKeyError =
      parsedForbiddenKey.errors?.storageKey?.includes('CLIENT_STORAGE_KEY_FORBIDDEN') ||
      parsedForbiddenKey.errors?.storageKey?.includes('Client cannot specify storageKey') ||
      parsedForbiddenKey.errors?.storageKey?.includes('Arbitrary storage keys are prohibited');
    const test1Passed = resForbiddenKey.statusCode === 400 && Boolean(hasForbiddenKeyError);
    recordTest(
      1,
      'Capability Model: Client-Specified storageKey Strictly Rejected (HTTP 400)',
      'Upload Security',
      test1Passed,
      'HTTP 400 with CLIENT_STORAGE_KEY_FORBIDDEN error message',
      `Status: ${resForbiddenKey.statusCode}, error: ${parsedForbiddenKey.errors?.storageKey}`
    );

    // Test 2: Server-controlled storage key generation is randomized and sanitized
    const key1 = generateStorageKey('turbine_blade.step');
    const key2 = generateStorageKey('turbine_blade.step');
    const isUnpredictable = key1 !== key2;
    const hasSafePrefix = key1.startsWith('uploads/rfq/');
    const containsSanitizedName = key1.includes('turbine_blade.step');
    const test2Passed = isUnpredictable && hasSafePrefix && containsSanitizedName;
    recordTest(
      2,
      'Server Storage Keys: Unpredictable, Cryptographically Random, and Path-Sanitized',
      'Upload Security',
      test2Passed,
      'Randomized unique keys starting with uploads/rfq/ and sanitized filename',
      `Key1: ${key1}, Key2: ${key2}, Unique: ${isUnpredictable}`
    );

    // Test 3: S3/R2 SigV4 PUT URL Binds Content-Type and Host
    const mockR2Config = {
      accountId: 'cf_account_12345',
      accessKeyId: 'cf_key_id_abc',
      secretAccessKey: 'cf_secret_key_xyz987654321',
      bucketName: 'print-studio-secure-cad',
    };
    const signedUrl = generatePresignedPutUrl(
      mockR2Config,
      'uploads/rfq/test_bracket.step',
      'application/step',
      600
    );
    const bindsContentType = signedUrl.includes('X-Amz-SignedHeaders=content-type%3Bhost');
    const hasSigV4Params =
      signedUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256') &&
      signedUrl.includes('X-Amz-Signature=') &&
      signedUrl.includes('X-Amz-Expires=600');
    const test3Passed = bindsContentType && hasSigV4Params;
    recordTest(
      3,
      'SigV4 URL Integrity: Content-Type and Host Bound into X-Amz-SignedHeaders',
      'Upload Security',
      test3Passed,
      'X-Amz-SignedHeaders=content-type;host present in presigned PUT URL query parameters',
      `SignedHeaders bound: ${bindsContentType}, SigV4 valid: ${hasSigV4Params}`
    );

    // Test 4: Presign API Returns Honest 503 When Storage Is Unconfigured
    const resPresign503 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes/presign',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: 'engine_mount.step', fileSizeBytes: 2048576 }),
    });
    const parsedPresign503 = JSON.parse(resPresign503.body || '{}');
    const isHonest503 =
      resPresign503.statusCode === 503 &&
      parsedPresign503.error === 'STORAGE_UNAVAILABLE' &&
      parsedPresign503.storageConfigured === false &&
      Array.isArray(parsedPresign503.requiredPrerequisites);
    recordTest(
      4,
      'Honest Fallback: Presign API Returns HTTP 503 STORAGE_UNAVAILABLE When R2 Is Unconfigured',
      'Storage Architecture',
      isHonest503,
      'HTTP 503, STORAGE_UNAVAILABLE, storageConfigured: false, requiredPrerequisites listed',
      `Status: ${resPresign503.statusCode}, error: ${parsedPresign503.error}`
    );

    // Test 5: Single-Use Upload Token: Successful First Association & Consumption
    const testToken1 = crypto.randomBytes(32).toString('hex');
    const testTokenHash1 = crypto.createHash('sha256').update(testToken1).digest('hex');
    const testStorageKey1 = `uploads/rfq/test_${Date.now()}_bracket_v1.step`;

    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        expires_at
      ) VALUES (
        ${testStorageKey1},
        ${testTokenHash1},
        'bracket_v1.step',
        2048576,
        'application/step',
        '.step',
        'UPLOADED',
        NOW() + INTERVAL '10 minutes'
      );
    `;

    const quotePayload1 = {
      customerName: 'Hamdan Al-Maktoum',
      customerEmail: 'hamdan@aerospace.ae',
      projectTitle: 'Avionics Mounting Bracket',
      projectDescription: 'High-temperature functional bracket for drone prototype.',
      quantity: 5,
      uploadToken: testToken1,
    };

    const resQuote1 = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'verified',
      },
      body: JSON.stringify(quotePayload1),
    });
    const parsedQuote1 = JSON.parse(resQuote1.body || '{}');
    const quoteId1 = parsedQuote1.quoteRequestId;

    // Check intent status in database
    const intentRow1 = await sql`
      SELECT status, quote_id, consumed_at
      FROM public.store_upload_intents
      WHERE token_hash = ${testTokenHash1}
      LIMIT 1;
    `;
    const isConsumed1 =
      intentRow1.length > 0 &&
      intentRow1[0].status === 'CONSUMED' &&
      intentRow1[0].quote_id === quoteId1 &&
      Boolean(intentRow1[0].consumed_at);

    // Check quote file row and quarantine status
    const fileRow1 = await sql`
      SELECT quote_request_id, upload_intent_id, storage_key, scan_status
      FROM public.store_quote_files
      WHERE quote_request_id = ${quoteId1}
      LIMIT 1;
    `;
    const isQuarantined =
      fileRow1.length > 0 &&
      fileRow1[0].storage_key === testStorageKey1 &&
      fileRow1[0].scan_status === 'QUARANTINED';

    const test5Passed =
      resQuote1.statusCode === 201 &&
      parsedQuote1.success === true &&
      isConsumed1 &&
      isQuarantined;
    recordTest(
      5,
      'Token Lifecycle: Single-Use Token Consumed and File Marked QUARANTINED in Database',
      'Upload Security',
      test5Passed,
      'HTTP 201, intent status CONSUMED with quote_id linked, quote file scan_status QUARANTINED',
      `Status: ${resQuote1.statusCode}, intent consumed: ${isConsumed1}, scan_status: ${fileRow1[0]?.scan_status}`
    );

    // Test 6: Token Replay Defense: Second Attempt with Consumed Token Fails (HTTP 400)
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const resQuoteReplay = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'verified',
      },
      body: JSON.stringify({
        customerName: 'Replay Attacker',
        customerEmail: 'replay@evil.com',
        projectTitle: 'Attempting to Reuse Consumed Token',
        projectDescription: 'This submission attempts to hijack a previously consumed upload token.',
        quantity: 1,
        uploadToken: testToken1, // Replaying the exact same token
      }),
    });
    const parsedReplay = JSON.parse(resQuoteReplay.body || '{}');
    const test6Passed =
      resQuoteReplay.statusCode === 400 &&
      parsedReplay.error === 'TOKEN_ALREADY_CONSUMED';
    recordTest(
      6,
      'Anti-Replay Defense: Re-submitting Consumed Token Strictly Rejected (HTTP 400)',
      'Upload Security',
      test6Passed,
      'HTTP 400 with TOKEN_ALREADY_CONSUMED error code',
      `Status: ${resQuoteReplay.statusCode}, error: ${parsedReplay.error}`
    );

    // Test 7: Expired Token Defense: Expired Intent Rejected (HTTP 400)
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const expiredToken = crypto.randomBytes(32).toString('hex');
    const expiredTokenHash = crypto.createHash('sha256').update(expiredToken).digest('hex');
    const expiredStorageKey = `uploads/rfq/test_expired_${Date.now()}.step`;

    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        expires_at
      ) VALUES (
        ${expiredStorageKey},
        ${expiredTokenHash},
        'expired_part.step',
        1048576,
        'application/step',
        '.step',
        'UPLOADED',
        NOW() - INTERVAL '5 minutes' -- Already expired
      );
    `;

    const resQuoteExpired = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'verified',
      },
      body: JSON.stringify({
        customerName: 'Late Submitter',
        customerEmail: 'late@customer.ae',
        projectTitle: 'Submission After Session Expiry',
        projectDescription: 'Attempting to submit quote using expired upload intent.',
        quantity: 1,
        uploadToken: expiredToken,
      }),
    });
    const parsedExpired = JSON.parse(resQuoteExpired.body || '{}');
    const test7Passed =
      resQuoteExpired.statusCode === 400 &&
      parsedExpired.error === 'EXPIRED_UPLOAD_TOKEN';
    recordTest(
      7,
      'Session Expiration Defense: Expired Upload Intent Rejected (HTTP 400 EXPIRED_UPLOAD_TOKEN)',
      'Upload Security',
      test7Passed,
      'HTTP 400 with EXPIRED_UPLOAD_TOKEN error code',
      `Status: ${resQuoteExpired.statusCode}, error: ${parsedExpired.error}`
    );

    // Test 8: Non-Existent / Invalid Token Rejected (HTTP 400)
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const fakeToken = crypto.randomBytes(32).toString('hex');
    const resQuoteInvalidToken = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerName: 'Fake Token Attacker',
        customerEmail: 'fake@evil.com',
        projectTitle: 'Random Token Submission',
        projectDescription: 'Submitting unissued cryptographic token.',
        quantity: 1,
        uploadToken: fakeToken,
      }),
    });
    const parsedInvalidToken = JSON.parse(resQuoteInvalidToken.body || '{}');
    const test8Passed =
      resQuoteInvalidToken.statusCode === 400 &&
      parsedInvalidToken.error === 'INVALID_UPLOAD_TOKEN';
    recordTest(
      8,
      'Token Authenticity: Unrecognized Random Token Rejected (HTTP 400 INVALID_UPLOAD_TOKEN)',
      'Upload Security',
      test8Passed,
      'HTTP 400 with INVALID_UPLOAD_TOKEN error code',
      `Status: ${resQuoteInvalidToken.statusCode}, error: ${parsedInvalidToken.error}`
    );

    // ------------------------------------------------------------------------
    // SECTION 2: Server-Side Object Verification Before Quote Association
    // ------------------------------------------------------------------------
    console.log('\n--- Section 2: Independent Server-Side Object Verification ---');

    // Test 9: Object Verification Failure - Missing Object in Storage
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const missingObjToken = crypto.randomBytes(32).toString('hex');
    const missingObjTokenHash = crypto.createHash('sha256').update(missingObjToken).digest('hex');
    const missingStorageKey = `uploads/rfq/missing_${Date.now()}.step`;

    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        expires_at
      ) VALUES (
        ${missingStorageKey},
        ${missingObjTokenHash},
        'missing_file.step',
        1048576,
        'application/step',
        '.step',
        'PENDING',
        NOW() + INTERVAL '10 minutes'
      );
    `;

    const resMissingObj = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'not_found',
      },
      body: JSON.stringify({
        customerName: 'Ghost Upload Test',
        customerEmail: 'ghost@customer.ae',
        projectTitle: 'Uncompleted Upload Submission',
        projectDescription: 'Submitting without actually uploading to storage.',
        quantity: 1,
        uploadToken: missingObjToken,
      }),
    });
    const parsedMissingObj = JSON.parse(resMissingObj.body || '{}');
    const test9Passed =
      resMissingObj.statusCode === 400 &&
      parsedMissingObj.error === 'OBJECT_VERIFICATION_FAILED' &&
      parsedMissingObj.message.includes('OBJECT_NOT_FOUND');
    recordTest(
      9,
      'Storage Verification: Phantom/Missing Object in Storage Fails Association (HTTP 400)',
      'Storage Verification',
      test9Passed,
      'HTTP 400 OBJECT_VERIFICATION_FAILED with OBJECT_NOT_FOUND error message',
      `Status: ${resMissingObj.statusCode}, error: ${parsedMissingObj.error}, msg: ${parsedMissingObj.message}`
    );

    // Test 10: Object Verification Failure - Oversized Object (>50MB) Detected
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const oversizedToken = crypto.randomBytes(32).toString('hex');
    const oversizedTokenHash = crypto.createHash('sha256').update(oversizedToken).digest('hex');
    const oversizedStorageKey = `uploads/rfq/oversized_${Date.now()}.step`;

    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        expires_at
      ) VALUES (
        ${oversizedStorageKey},
        ${oversizedTokenHash},
        'oversized_part.step',
        1048576,
        'application/step',
        '.step',
        'PENDING',
        NOW() + INTERVAL '10 minutes'
      );
    `;

    const resOversized = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'oversized',
      },
      body: JSON.stringify({
        customerName: 'Oversized Attacker',
        customerEmail: 'oversized@evil.com',
        projectTitle: 'Bomb Upload Attempt',
        projectDescription: 'Attempting to associate a 55MB file that bypassed presign check.',
        quantity: 1,
        uploadToken: oversizedToken,
      }),
    });
    const parsedOversized = JSON.parse(resOversized.body || '{}');
    const test10Passed =
      resOversized.statusCode === 400 &&
      parsedOversized.error === 'OBJECT_VERIFICATION_FAILED' &&
      parsedOversized.message.includes('OBJECT_TOO_LARGE');
    recordTest(
      10,
      'Storage Verification: Oversized Object Detected by Server HEAD Inspection Fails Association',
      'Storage Verification',
      test10Passed,
      'HTTP 400 OBJECT_VERIFICATION_FAILED with OBJECT_TOO_LARGE',
      `Status: ${resOversized.statusCode}, error: ${parsedOversized.error}`
    );

    // ------------------------------------------------------------------------
    // SECTION 3: Atomic PostgreSQL Transaction Guarantees
    // ------------------------------------------------------------------------
    console.log('\n--- Section 3: Atomic PostgreSQL Transaction Guarantees ---');

    // Test 11: Rollback Verification - Failed Quote Association Leaves Intent Unconsumed
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const rollbackToken = crypto.randomBytes(32).toString('hex');
    const rollbackTokenHash = crypto.createHash('sha256').update(rollbackToken).digest('hex');
    const rollbackStorageKey = `uploads/rfq/rollback_${Date.now()}.step`;

    await sql`
      INSERT INTO public.store_upload_intents (
        storage_key,
        token_hash,
        file_name,
        file_size_bytes,
        mime_type,
        file_extension,
        status,
        expires_at
      ) VALUES (
        ${rollbackStorageKey},
        ${rollbackTokenHash},
        'rollback_test.step',
        1048576,
        'application/step',
        '.step',
        'PENDING',
        NOW() + INTERVAL '10 minutes'
      );
    `;

    // Attempt quote submission with verification failure (triggering rollback)
    await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
        'x-test-mock-upload': 'not_found', // causes rejection before transaction commit
      },
      body: JSON.stringify({
        customerName: 'Rollback Tester',
        customerEmail: 'rollback@test.ae',
        projectTitle: 'Transaction Rollback Test',
        projectDescription: 'Ensures intent remains PENDING when quote fails.',
        quantity: 1,
        uploadToken: rollbackToken,
      }),
    });

    const rollbackIntentRow = await sql`
      SELECT status, quote_id
      FROM public.store_upload_intents
      WHERE token_hash = ${rollbackTokenHash}
      LIMIT 1;
    `;
    const isStillPending =
      rollbackIntentRow.length > 0 &&
      rollbackIntentRow[0].status === 'PENDING' &&
      rollbackIntentRow[0].quote_id === null;

    const noOrphanFile = await sql`
      SELECT id FROM public.store_quote_files WHERE storage_key = ${rollbackStorageKey};
    `;

    const test11Passed = isStillPending && noOrphanFile.length === 0;
    recordTest(
      11,
      'Atomicity: Failed Quote Request Leaves Intent Unconsumed (PENDING) and Zero Orphan Records',
      'Database Integrity',
      test11Passed,
      'Intent status remains PENDING, quote_id is NULL, no orphan quote_files rows created',
      `Intent status: ${rollbackIntentRow[0]?.status}, quote_id: ${rollbackIntentRow[0]?.quote_id}, orphan files: ${noOrphanFile.length}`
    );

    // Test 12: withTransaction rollback verification on thrown error
    let transactionRolledBack = false;
    const testRollbackName = `rollback_probe_${Date.now()}`;
    try {
      await withTransaction(async (client) => {
        await client.query(
          `INSERT INTO public.store_enquiries (customer_name, customer_email, subject, message)
           VALUES ($1, 'probe@test.ae', 'Probe Subject', 'Probe Message');`,
          [testRollbackName]
        );
        // Force an intentional error to trigger rollback
        throw new Error('INTENTIONAL_TEST_ROLLBACK');
      });
    } catch (err: any) {
      if (err.message === 'INTENTIONAL_TEST_ROLLBACK') {
        transactionRolledBack = true;
      }
    }

    const probeCheck = await sql`
      SELECT id FROM public.store_enquiries WHERE customer_name = ${testRollbackName};
    `;
    const test12Passed = transactionRolledBack && probeCheck.length === 0;
    recordTest(
      12,
      'Database Transactions: withTransaction() Rolls Back Cleanly on Thrown Exception',
      'Database Integrity',
      test12Passed,
      'Transaction rolls back on error, zero inserted records persisted',
      `Rolled back: ${transactionRolledBack}, Persisted rows: ${probeCheck.length}`
    );

    // ------------------------------------------------------------------------
    // SECTION 4: Storefront Origin Policy Enforcement
    // ------------------------------------------------------------------------
    console.log('\n--- Section 4: Storefront Origin Policy Enforcement ---');

    // Test 13: Missing Origin Header Rejected on POST (HTTP 403)
    const resNoOrigin = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/enquiries',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        'Content-Type': 'application/json',
        // Origin deliberately omitted
      },
      body: JSON.stringify({
        customerName: 'No Origin Attacker',
        customerEmail: 'no-origin@evil.com',
        subject: 'CSRF Attempt',
        message: 'Attempting submission without Origin header.',
      }),
    });
    const parsedNoOrigin = JSON.parse(resNoOrigin.body || '{}');
    const test13Passed =
      resNoOrigin.statusCode === 403 &&
      parsedNoOrigin.error === 'FORBIDDEN_ORIGIN';
    recordTest(
      13,
      'Origin Policy: Missing Origin Header on Mutation Endpoints Returns HTTP 403 FORBIDDEN_ORIGIN',
      'Origin Security',
      test13Passed,
      'HTTP 403 with FORBIDDEN_ORIGIN error code',
      `Status: ${resNoOrigin.statusCode}, error: ${parsedNoOrigin.error}`
    );

    // Test 14: Untrusted Cross-Origin (https://evil.com) Rejected (HTTP 403)
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'quote_%';`.catch(() => {});
    const resEvilOrigin = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'https://evil-attacker.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerName: 'Evil Cross-Origin',
        customerEmail: 'evil@attacker.com',
        projectTitle: 'Cross-Site Request Forgery',
        projectDescription: 'CSRF attack payload from malicious third-party site.',
        quantity: 1,
      }),
    });
    const parsedEvilOrigin = JSON.parse(resEvilOrigin.body || '{}');
    const test14Passed =
      resEvilOrigin.statusCode === 403 &&
      parsedEvilOrigin.error === 'FORBIDDEN_ORIGIN';
    recordTest(
      14,
      'Origin Policy: Untrusted Third-Party Origin (https://evil-attacker.com) Rejected (HTTP 403)',
      'Origin Security',
      test14Passed,
      'HTTP 403 with FORBIDDEN_ORIGIN error code',
      `Status: ${resEvilOrigin.statusCode}, error: ${parsedEvilOrigin.error}`
    );

    // Test 15: null Origin Rejected (HTTP 403)
    const resNullOrigin = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/quotes/presign',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'null',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: 'test.step', fileSizeBytes: 1024 }),
    });
    const parsedNullOrigin = JSON.parse(resNullOrigin.body || '{}');
    const test15Passed =
      resNullOrigin.statusCode === 403 &&
      parsedNullOrigin.error === 'FORBIDDEN_ORIGIN';
    recordTest(
      15,
      'Origin Policy: Sandboxed / null Origin Rejected (HTTP 403 FORBIDDEN_ORIGIN)',
      'Origin Security',
      test15Passed,
      'HTTP 403 with FORBIDDEN_ORIGIN error code',
      `Status: ${resNullOrigin.statusCode}, error: ${parsedNullOrigin.error}`
    );

    // Test 16: Exact Storefront Origin (http://www.lvh.me:3000) Accepted
    const resAllowedOrigin = await makeRequest({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/store/enquiries',
      method: 'POST',
      headers: {
        Host: 'www.lvh.me:3000',
        Origin: 'http://www.lvh.me:3000',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerName: 'Allowed Origin Customer',
        customerEmail: 'allowed@customer.ae',
        subject: 'Valid Origin Enquiry',
        message: 'This enquiry comes from the trusted storefront domain.',
      }),
    });
    const test16Passed = resAllowedOrigin.statusCode === 201;
    recordTest(
      16,
      'Origin Policy: Exact Storefront Domain (http://www.lvh.me:3000) Allowed Mutation Access',
      'Origin Security',
      test16Passed,
      'HTTP 201 Created',
      `Status: ${resAllowedOrigin.statusCode}`
    );

    // ------------------------------------------------------------------------
    // SECTION 5: Product Image URL Sanitization
    // ------------------------------------------------------------------------
    console.log('\n--- Section 5: Product Image URL Sanitization ---');

    // Test 17: sanitizeImageUrl - Allowed Protocols (https and safe local paths)
    const validHttps = sanitizeImageUrl('https://cdn.printstudio.ae/images/drone_strut.png');
    const validRelative = sanitizeImageUrl('/images/products/bracket.jpg');
    const validHttpDev = sanitizeImageUrl('http://localhost:3000/images/test.png');
    const test17Passed =
      validHttps === 'https://cdn.printstudio.ae/images/drone_strut.png' &&
      validRelative === '/images/products/bracket.jpg' &&
      validHttpDev === 'http://localhost:3000/images/test.png';
    recordTest(
      17,
      'Image Sanitization: Valid https:// and Safe Local Relative / Paths Preserved',
      'Input Sanitization',
      test17Passed,
      'Valid https://, safe relative /, and local dev http:// URLs accepted',
      `https: ${validHttps}, relative: ${validRelative}`
    );

    // Test 18: sanitizeImageUrl - Adversarial Schemes Strictly Stripped
    const badVectors = [
      'javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'file:///etc/passwd',
      '//evil.com/image.png',
      '/\\evil.com/image.png',
      '\\evil.com/image.png',
      'blob:https://evil.com/12345',
      'http://evil-attacker.com/exploit.jpg',
      'https://attacker.com\u0000/exploit.jpg',
    ];
    const strippedResults = badVectors.map((v) => sanitizeImageUrl(v));
    const allVectorsNeutralized = strippedResults.every((r) => r === null);
    recordTest(
      18,
      'Image Sanitization: javascript:, data:, file:, protocol-relative //, and Backslashes Stripped',
      'Input Sanitization',
      allVectorsNeutralized,
      'All 9 malicious/evasive URL vectors resolved strictly to null',
      allVectorsNeutralized ? 'All 9 vectors stripped to null' : JSON.stringify(strippedResults)
    );

    // ------------------------------------------------------------------------
    // SECTION 6: Migration SQL Parser Tokenizer
    // ------------------------------------------------------------------------
    console.log('\n--- Section 6: Migration SQL Parser Tokenizer ---');

    // Test 19: splitSqlStatements handles line comments, nested block comments, quoted semicolons, and dollar quotes
    const complexSql = `
      -- Single line comment at start
      CREATE TABLE test_table (
        id UUID PRIMARY KEY,
        name VARCHAR(100) DEFAULT 'semi;colon in string',
        "quoted;col" INT
      );

      /* Multi-line comment
         /* with nested comment block */
         and a semicolon; inside
      */
      ALTER TABLE test_table ADD COLUMN notes TEXT;

      -- Function with dollar-quoted block containing semicolons
      CREATE OR REPLACE FUNCTION update_test_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Final statement
      SELECT 1;
    `;

    const statements = splitSqlStatements(complexSql);
    const expectedStatements = 4;
    const hasTableCreation = statements[0]?.includes('CREATE TABLE test_table');
    const hasAlterTable = statements[1]?.includes('ALTER TABLE test_table ADD COLUMN notes TEXT');
    const hasDollarQuotedFunc = statements[2]?.includes('CREATE OR REPLACE FUNCTION update_test_timestamp()');
    const hasSelect1 = statements[3]?.includes('SELECT 1');

    const test19Passed =
      statements.length === expectedStatements &&
      hasTableCreation &&
      hasAlterTable &&
      hasDollarQuotedFunc &&
      hasSelect1;

    recordTest(
      19,
      'SQL Migration Parser: splitSqlStatements Correctly Tokenizes Nested Comments, Quotes, and Dollar Blocks',
      'Migration Integrity',
      test19Passed,
      'Exactly 4 clean executable statements extracted without truncation or mis-splitting',
      `Statements extracted: ${statements.length} (expected 4), table: ${hasTableCreation}, func: ${hasDollarQuotedFunc}`
    );

    // ------------------------------------------------------------------------
    // SECTION 7: Manufacturing Baseline Integrity Check
    // ------------------------------------------------------------------------
    console.log('\n--- Section 7: Manufacturing Baseline Integrity ---');

    // Test 20: 371 Baseline Records & Canonical SHA-256 Digest Intact
    const allRows = await sql`
      SELECT collection_name, record_id, data, updated_at
      FROM public.ledger_collections
      ORDER BY collection_name, record_id;
    `;
    const hash = crypto.createHash('sha256');
    for (const r of allRows) {
      hash.update(`${r.collection_name}|${r.record_id}|${JSON.stringify(r.data)}|${new Date(r.updated_at).toISOString()}`);
    }
    const digest = hash.digest('hex');
    const isDbPreserved =
      allRows.length === 371 &&
      digest === 'd39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62';
    recordTest(
      20,
      'Baseline Preservation: Exactly 371 Records & Canonical SHA-256 Digest Unchanged',
      'Preservation',
      isDbPreserved,
      '371 records, SHA-256 matches d39c74285d77c00a33500f02be7595c9e495b999e2956879f2dd134e6232ef62',
      `Rows: ${allRows.length}, SHA-256: ${digest}`
    );

    // ------------------------------------------------------------------------
    // Scorecard
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    console.log('  PHASE 2.4.1 REMEDIATION SCORECARD');
    console.log('========================================================================');

    const passedCount = results.filter((r) => r.status === 'PASS').length;
    const totalCount = results.length;
    const passPercentage = ((passedCount / totalCount) * 100).toFixed(1);

    console.log(`Total Remediation Tests: ${totalCount}`);
    console.log(`Passed:                  ${passedCount}`);
    console.log(`Failed:                  ${totalCount - passedCount}`);
    console.log(`Success Rate:            ${passPercentage}%\n`);

    if (passedCount !== totalCount) {
      console.error('❌ Phase 2.4.1 Remediation Verification FAILED. See failing requirements above.');
      process.exit(1);
    } else {
      console.log('🎉 Phase 2.4.1 Remediation PASSED with 100% success rate.');
      process.exit(0);
    }
  } catch (err: any) {
    console.error('Unhandled verification error:', err);
    process.exit(1);
  } finally {
    await sql`DELETE FROM public.rate_limits WHERE key LIKE 'store_%' OR key LIKE 'quote_%';`.catch(() => {});
  }
}

runPhase241RemediationVerification();
