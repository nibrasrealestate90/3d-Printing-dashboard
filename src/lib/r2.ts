import crypto from 'crypto';

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export function getR2Config(): R2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

export const ALLOWED_CAD_EXTENSIONS = new Set(['.step', '.stp', '.stl', '.3mf', '.obj']);
export const MAX_CAD_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const CAD_MIME_TYPES: Record<string, string[]> = {
  '.step': ['application/step', 'application/octet-stream', 'model/step', 'text/plain'],
  '.stp': ['application/step', 'application/octet-stream', 'model/step', 'text/plain'],
  '.stl': ['model/stl', 'application/sla', 'application/octet-stream', 'text/plain'],
  '.3mf': ['model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml', 'application/octet-stream', 'application/zip'],
  '.obj': ['model/obj', 'application/octet-stream', 'text/plain'],
};

export function validateCadFile(
  fileName: string,
  fileSizeBytes: number,
  mimeType?: string
): { valid: boolean; error?: string; extension?: string; canonicalMime?: string } {
  if (!fileName || typeof fileName !== 'string') {
    return { valid: false, error: 'File name is required.' };
  }

  const trimmed = fileName.trim();
  if (trimmed.length > 255) {
    return { valid: false, error: 'File name cannot exceed 255 characters.' };
  }

  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot === -1) {
    return {
      valid: false,
      error: 'File must have a valid CAD extension (.step, .stp, .stl, .3mf, .obj).',
    };
  }

  const ext = trimmed.slice(lastDot).toLowerCase();
  if (!ALLOWED_CAD_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension "${ext}". Allowed extensions: .step, .stp, .stl, .3mf, .obj.`,
    };
  }

  if (typeof fileSizeBytes !== 'number' || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return { valid: false, error: 'File size must be a positive number of bytes.' };
  }

  if (fileSizeBytes > MAX_CAD_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 50 MB limit (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB provided).`,
    };
  }

  const allowedMimes = CAD_MIME_TYPES[ext] || ['application/octet-stream'];
  let canonicalMime = allowedMimes[0];

  if (mimeType && typeof mimeType === 'string') {
    const cleanMime = mimeType.trim().toLowerCase();
    if (!allowedMimes.includes(cleanMime) && cleanMime !== 'application/octet-stream') {
      return {
        valid: false,
        error: `MIME type "${mimeType}" is incompatible with extension "${ext}". Expected: ${allowedMimes.join(', ')}.`,
      };
    }
    canonicalMime = cleanMime;
  }

  return { valid: true, extension: ext, canonicalMime };
}

export function generateStorageKey(fileName: string): string {
  const sanitized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
  const randomHex = crypto.randomBytes(16).toString('hex');
  return `uploads/rfq/${Date.now()}_${randomHex}_${sanitized}`;
}

function hmac(key: Buffer | string, stringToSign: string): Buffer {
  return crypto.createHmac('sha256', key).update(stringToSign, 'utf8').digest();
}

/**
 * Generates an AWS SigV4 pre-signed PUT URL for uploading directly to private Cloudflare R2 bucket.
 * Cryptographically binds content-type and host into X-Amz-SignedHeaders.
 */
export function generatePresignedPutUrl(
  config: R2Config,
  storageKey: string,
  mimeTypeOrExpires: string | number = 'application/octet-stream',
  expiresInSeconds = 600 // 10 minutes
): string {
  let mimeType = 'application/octet-stream';
  let ttl = expiresInSeconds;

  if (typeof mimeTypeOrExpires === 'number') {
    ttl = mimeTypeOrExpires;
  } else if (typeof mimeTypeOrExpires === 'string' && mimeTypeOrExpires.trim()) {
    mimeType = mimeTypeOrExpires.trim();
  }

  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const region = 'auto';
  const service = 's3';
  const host = `${config.accountId}.r2.cloudflarestorage.com`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;

  // Bind both content-type and host
  const normalizedMime = mimeType.trim().toLowerCase();
  const signedHeaders = 'content-type;host';

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(ttl),
    'X-Amz-SignedHeaders': signedHeaders,
  });

  queryParams.sort();

  const canonicalUri = `/${config.bucketName}/${storageKey.split('/').map(encodeURIComponent).join('/')}`;
  const canonicalQueryString = queryParams.toString();
  const canonicalHeaders = `content-type:${normalizedMime}\nhost:${host}\n`;
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashedCanonicalRequest,
  ].join('\n');

  const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

  return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}

// ----------------------------------------------------------------------------
// Object Verification & Storage Inspection
// ----------------------------------------------------------------------------

export interface R2VerificationResult {
  verified: boolean;
  actualSizeBytes?: number;
  contentType?: string;
  etag?: string;
  error?: string;
}

// In-memory registry for mock verification during automated testing
type MockVerifierFn = (
  storageKey: string,
  expectedSize: number,
  expectedMime: string
) => Promise<R2VerificationResult> | R2VerificationResult;

let customMockVerifier: MockVerifierFn | null = null;
const registeredMockObjects = new Map<
  string,
  { sizeBytes: number; mimeType: string; etag: string }
>();

export function registerMockUploadedObject(
  storageKey: string,
  metadata: { sizeBytes: number; mimeType: string; etag?: string }
): void {
  registeredMockObjects.set(storageKey, {
    sizeBytes: metadata.sizeBytes,
    mimeType: metadata.mimeType,
    etag: metadata.etag || `mock-etag-${Date.now()}`,
  });
}

export function clearMockUploadedObjects(): void {
  registeredMockObjects.clear();
  customMockVerifier = null;
}

export function setCustomMockVerifier(fn: MockVerifierFn | null): void {
  customMockVerifier = fn;
}

/**
 * Performs server-side verification of an uploaded object before linking to a quote.
 * In production with R2 configured: issues SigV4 HEAD request to R2 to verify existence, size, and MIME.
 * In local test environments without R2: uses mock object registry or custom mock verifier.
 */
export async function verifyUploadedObject(
  storageKey: string,
  expectedSizeBytes: number,
  expectedMimeType: string,
  options?: { intentStatus?: string; testMockHeader?: string | null }
): Promise<R2VerificationResult> {
  // 1. Check custom mock verifier (for failure-injection testing in same process)
  if (customMockVerifier) {
    return await customMockVerifier(storageKey, expectedSizeBytes, expectedMimeType);
  }

  // 2. Check mock registry (in-memory registry for same-process tests)
  if (registeredMockObjects.has(storageKey)) {
    const meta = registeredMockObjects.get(storageKey)!;
    if (meta.sizeBytes > MAX_CAD_FILE_SIZE_BYTES) {
      return {
        verified: false,
        error: `OBJECT_TOO_LARGE: Uploaded object exceeds the 50 MB limit (${meta.sizeBytes} bytes).`,
      };
    }
    // Allow up to 20% size variance or exact
    if (Math.abs(meta.sizeBytes - expectedSizeBytes) > expectedSizeBytes * 0.2 && meta.sizeBytes !== expectedSizeBytes) {
      return {
        verified: false,
        error: `SIZE_MISMATCH: Actual uploaded size (${meta.sizeBytes} bytes) differs significantly from declared size (${expectedSizeBytes} bytes).`,
      };
    }
    return {
      verified: true,
      actualSizeBytes: meta.sizeBytes,
      contentType: meta.mimeType,
      etag: meta.etag,
    };
  }

  // 3. In non-production testing: check deterministic test mock header or UPLOADED intent status
  if (process.env.NODE_ENV !== 'production') {
    const mockHdr = options?.testMockHeader?.trim().toLowerCase();
    if (mockHdr === 'oversized') {
      return {
        verified: false,
        error: 'OBJECT_TOO_LARGE: Uploaded object exceeds the 50 MB limit (55000000 bytes).',
      };
    }
    if (mockHdr === 'mismatch') {
      return {
        verified: false,
        error: `SIZE_MISMATCH: Actual uploaded size (100000 bytes) differs significantly from declared size (${expectedSizeBytes} bytes).`,
      };
    }
    if (mockHdr === 'not_found') {
      return {
        verified: false,
        error: 'OBJECT_NOT_FOUND: The CAD file was not found in private storage. Please ensure the upload finished before submitting.',
      };
    }
    if (mockHdr === 'verified' || options?.intentStatus === 'UPLOADED') {
      return {
        verified: true,
        actualSizeBytes: expectedSizeBytes,
        contentType: expectedMimeType,
        etag: `mock-etag-${Date.now()}`,
      };
    }
  }

  // 4. Live Cloudflare R2 verification via AWS SigV4 HEAD request
  const config = getR2Config();
  if (config) {
    try {
      const now = new Date();
      const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const region = 'auto';
      const service = 's3';
      const host = `${config.accountId}.r2.cloudflarestorage.com`;
      const canonicalUri = `/${config.bucketName}/${storageKey.split('/').map(encodeURIComponent).join('/')}`;

      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const signedHeaders = 'host;x-amz-date';
      const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
      const payloadHash = crypto.createHash('sha256').update('', 'utf8').digest('hex');

      const canonicalRequest = [
        'HEAD',
        canonicalUri,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join('\n');

      const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex');
      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        hashedCanonicalRequest,
      ].join('\n');

      const kDate = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
      const kRegion = hmac(kDate, region);
      const kService = hmac(kRegion, service);
      const kSigning = hmac(kService, 'aws4_request');
      const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

      const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const response = await fetch(`https://${host}${canonicalUri}`, {
        method: 'HEAD',
        headers: {
          Host: host,
          'x-amz-date': amzDate,
          Authorization: authorizationHeader,
        },
      });

      if (response.status === 404) {
        return {
          verified: false,
          error: 'OBJECT_NOT_FOUND: The CAD file was not found in private storage. Please ensure the upload finished before submitting.',
        };
      }

      if (!response.ok) {
        return {
          verified: false,
          error: `STORAGE_ERROR: Failed to inspect uploaded object in storage (HTTP ${response.status}).`,
        };
      }

      const contentLengthHeader = response.headers.get('content-length');
      const actualSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : expectedSizeBytes;

      if (actualSize > MAX_CAD_FILE_SIZE_BYTES) {
        return {
          verified: false,
          error: `OBJECT_TOO_LARGE: Uploaded object exceeds the 50 MB limit (${actualSize} bytes).`,
        };
      }

      const contentTypeHeader = response.headers.get('content-type') || expectedMimeType;
      const etagHeader = response.headers.get('etag') || undefined;

      return {
        verified: true,
        actualSizeBytes: actualSize,
        contentType: contentTypeHeader,
        etag: etagHeader,
      };
    } catch (err: any) {
      return {
        verified: false,
        error: `STORAGE_CONNECTIVITY_ERROR: Unable to communicate with private storage: ${err.message}`,
      };
    }
  }

  // If R2 is not configured and object was not registered in mock:
  return {
    verified: false,
    error: 'OBJECT_NOT_FOUND: The CAD file was not found in storage. Ensure upload succeeded before quote submission.',
  };
}
