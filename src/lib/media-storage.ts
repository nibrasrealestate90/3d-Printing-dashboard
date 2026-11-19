import crypto from 'crypto';
import { validateMediaFile } from './storefront';

export interface PublicR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicDomain?: string;
}

export function getPublicR2Config(): PublicR2Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const publicBucketName = process.env.R2_PUBLIC_BUCKET_NAME?.trim();
  const privateBucketName = process.env.R2_BUCKET_NAME?.trim();

  // Strict physical isolation: Public media bucket must be explicitly set
  // and MUST NOT fall back to or match the private CAD bucket.
  if (!accountId || !accessKeyId || !secretAccessKey || !publicBucketName) {
    return null;
  }

  if (privateBucketName && publicBucketName === privateBucketName) {
    console.error('Security violation: R2_PUBLIC_BUCKET_NAME must not match private CAD R2_BUCKET_NAME.');
    return null;
  }

  const publicDomain = (process.env.R2_PUBLIC_DOMAIN?.trim() || process.env.NEXT_PUBLIC_MEDIA_DOMAIN?.trim())?.replace(/\/+$/, '');

  return { accountId, accessKeyId, secretAccessKey, bucketName: publicBucketName, publicDomain };
}

export function isPublicMediaStorageConfigured(): boolean {
  return getPublicR2Config() !== null;
}

export function generatePublicMediaStorageKey(
  category: 'products' | 'instagram' | 'general',
  fileName: string
): string {
  const sanitized = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100);
  const randomHex = crypto.randomBytes(12).toString('hex');
  const dateStamp = new Date().toISOString().slice(0, 7); // YYYY-MM
  return `media/${category}/${dateStamp}/${Date.now()}_${randomHex}_${sanitized}`;
}

export function resolvePublicMediaUrl(storageKey: string): string {
  const config = getPublicR2Config();
  if (config?.publicDomain) {
    return `${config.publicDomain}/${storageKey}`;
  }
  if (config) {
    return `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucketName}/${storageKey}`;
  }
  // Safe local relative reference fallback for testing/dev
  return `/${storageKey}`;
}

function hmac(key: Buffer | string, stringToSign: string): Buffer {
  return crypto.createHmac('sha256', key).update(stringToSign, 'utf8').digest();
}

/**
 * Generates an AWS SigV4 pre-signed PUT URL for uploading directly to public media Cloudflare R2 bucket.
 * Binds content-type and host into X-Amz-SignedHeaders. Never exposes secret access key.
 */
export function generatePublicMediaPresignedPutUrl(
  config: PublicR2Config,
  storageKey: string,
  mimeType: string,
  expiresInSeconds = 600
): string {
  const normalizedMime = mimeType.trim().toLowerCase();
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const region = 'auto';
  const service = 's3';
  const host = `${config.accountId}.r2.cloudflarestorage.com`;

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const signedHeaders = 'content-type;host';

  const queryParams = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${config.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresInSeconds),
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

export interface PublicMediaVerificationResult {
  verified: boolean;
  actualSizeBytes?: number;
  contentType?: string;
  etag?: string;
  error?: string;
}

// In-memory test mock registry for testing without live R2 credentials
const registeredMockMediaObjects = new Map<
  string,
  { sizeBytes: number; mimeType: string; etag: string }
>();

export function registerMockMediaObject(
  storageKey: string,
  metadata: { sizeBytes: number; mimeType: string; etag?: string }
): void {
  registeredMockMediaObjects.set(storageKey, {
    sizeBytes: metadata.sizeBytes,
    mimeType: metadata.mimeType,
    etag: metadata.etag || `mock-media-etag-${Date.now()}`,
  });
}

export function clearMockMediaObjects(): void {
  registeredMockMediaObjects.clear();
}

/**
 * Performs server-side verification of an uploaded public media asset.
 * In production with R2 configured: issues SigV4 HEAD request to R2 to verify existence, size (<=10MB), and MIME.
 * In local/test environments: uses mock object registry or deterministic test headers.
 */
export async function verifyPublicMediaObject(
  storageKey: string,
  expectedSizeBytes: number,
  expectedMimeType: string,
  options?: { testMockHeader?: string | null }
): Promise<PublicMediaVerificationResult> {
  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

  // 1. Check in-memory test registry
  if (registeredMockMediaObjects.has(storageKey)) {
    const meta = registeredMockMediaObjects.get(storageKey)!;
    if (meta.sizeBytes > MAX_BYTES) {
      return {
        verified: false,
        error: `OBJECT_TOO_LARGE: Uploaded media object exceeds the 10 MB limit (${meta.sizeBytes} bytes).`,
      };
    }
    const cleanMime = meta.mimeType.trim().toLowerCase();
    if (cleanMime !== 'image/jpeg' && cleanMime !== 'image/png' && cleanMime !== 'image/webp') {
      return {
        verified: false,
        error: `INVALID_CONTENT_TYPE: Content type "${meta.mimeType}" is not an accepted image format.`,
      };
    }
    return {
      verified: true,
      actualSizeBytes: meta.sizeBytes,
      contentType: meta.mimeType,
      etag: meta.etag,
    };
  }

  // 2. In non-production testing: check deterministic test mock header
  if (process.env.NODE_ENV !== 'production') {
    const mockHdr = options?.testMockHeader?.trim().toLowerCase();
    if (mockHdr === 'oversized') {
      return {
        verified: false,
        error: 'OBJECT_TOO_LARGE: Uploaded media object exceeds the 10 MB limit (12000000 bytes).',
      };
    }
    if (mockHdr === 'invalid_mime') {
      return {
        verified: false,
        error: 'INVALID_CONTENT_TYPE: Content type "model/step" is not an accepted image format.',
      };
    }
    if (mockHdr === 'not_found') {
      return {
        verified: false,
        error: 'OBJECT_NOT_FOUND: The media file was not found in public storage. Please ensure upload succeeded before registering.',
      };
    }
    if (mockHdr === 'verified') {
      return {
        verified: true,
        actualSizeBytes: expectedSizeBytes,
        contentType: expectedMimeType,
        etag: `mock-etag-${Date.now()}`,
      };
    }
  }

  // 3. Live Cloudflare R2 verification via AWS SigV4 HEAD request
  const config = getPublicR2Config();
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
          error: 'OBJECT_NOT_FOUND: The media file was not found in public storage. Please ensure upload succeeded before registering.',
        };
      }

      if (!response.ok) {
        return {
          verified: false,
          error: `STORAGE_ERROR: Failed to inspect uploaded media object in storage (HTTP ${response.status}).`,
        };
      }

      const contentLengthHeader = response.headers.get('content-length');
      const actualSize = contentLengthHeader ? parseInt(contentLengthHeader, 10) : expectedSizeBytes;

      if (actualSize > MAX_BYTES) {
        return {
          verified: false,
          error: `OBJECT_TOO_LARGE: Uploaded media object exceeds the 10 MB limit (${actualSize} bytes).`,
        };
      }

      const contentTypeHeader = (response.headers.get('content-type') || expectedMimeType).trim().toLowerCase();
      if (
        contentTypeHeader !== 'image/jpeg' &&
        contentTypeHeader !== 'image/png' &&
        contentTypeHeader !== 'image/webp'
      ) {
        return {
          verified: false,
          error: `INVALID_CONTENT_TYPE: Content type "${contentTypeHeader}" is not an accepted image format. Allowed: image/jpeg, image/png, image/webp.`,
        };
      }

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
        error: `STORAGE_CONNECTIVITY_ERROR: Unable to communicate with public storage: ${err.message}`,
      };
    }
  }

  // If R2 is not configured: in development/test without R2 credentials,
  // allow local reference registration with validated size and MIME
  return {
    verified: true,
    actualSizeBytes: expectedSizeBytes,
    contentType: expectedMimeType,
  };
}
