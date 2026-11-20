import { NextRequest, NextResponse } from 'next/server';
import { verifyServerSession } from '@/lib/server-auth';
import { validateMediaFile } from '@/lib/storefront';
import {
  getPublicR2Config,
  generatePublicMediaStorageKey,
  generatePublicMediaPresignedPutUrl,
  resolvePublicMediaUrl,
} from '@/lib/media-storage';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/website/media/presign
 * Generates an authenticated pre-signed PUT URL for uploading public images to R2.
 * Strictly validates image MIME types and rejects CAD files.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyServerSession();
    if (auth.status !== 'authenticated' || !auth.user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Administrator session required.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Invalid JSON payload.' },
        { status: 400 }
      );
    }

    const fileName = String(body.fileName || '').trim();
    const fileSizeBytes = Number(body.fileSizeBytes);
    const mimeType = String(body.mimeType || '').trim();
    const category = body.category === 'instagram'
      ? 'instagram'
      : body.category === 'categories'
        ? 'categories'
        : 'products';

    const validation = validateMediaFile(fileName, fileSizeBytes, mimeType);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'INVALID_FILE', message: validation.error },
        { status: 400 }
      );
    }

    const storageKey = generatePublicMediaStorageKey(category, fileName);
    const publicUrl = resolvePublicMediaUrl(storageKey);
    const config = getPublicR2Config();

    if (!config) {
      // Storage credentials not yet configured
      return NextResponse.json(
        {
          success: true,
          storageConfigured: false,
          storageKey,
          publicUrl,
          message: 'Cloudflare R2 public storage credentials not configured. Operating in local reference mode.',
        },
        { status: 200 }
      );
    }

    const uploadUrl = generatePublicMediaPresignedPutUrl(
      config,
      storageKey,
      validation.canonicalMime || 'image/jpeg',
      600 // 10 minutes TTL
    );

    return NextResponse.json({
      success: true,
      storageConfigured: true,
      uploadUrl,
      publicUrl,
      storageKey,
      mimeType: validation.canonicalMime,
      expiresInSeconds: 600,
    });
  } catch (err: any) {
    console.error('Error in POST /api/admin/website/media/presign:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to generate media upload URL.' },
      { status: 500 }
    );
  }
}
