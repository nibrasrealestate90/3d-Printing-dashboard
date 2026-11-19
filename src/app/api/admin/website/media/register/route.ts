import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyServerSession } from '@/lib/server-auth';
import { logAuditEvent, extractClientIp } from '@/lib/auth';
import { sanitizeImageUrl, validateMediaFile, MediaItem } from '@/lib/storefront';
import { verifyPublicMediaObject } from '@/lib/media-storage';
import { getMediaLibraryItems, saveMediaLibraryItems } from '../route';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/website/media/register
 * Registers an uploaded media asset into the media library catalog.
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

    const url = sanitizeImageUrl(body.url);
    if (!url) {
      return NextResponse.json(
        { error: 'INVALID_URL', message: 'A valid public HTTPS or local image URL is required.' },
        { status: 400 }
      );
    }

    const fileName = String(body.fileName || '').trim().slice(0, 255);
    const storageKey = String(body.storageKey || '').trim();
    const fileSizeBytes = Number(body.fileSizeBytes) || 0;
    const mimeType = String(body.mimeType || '').trim();
    const width = Number(body.width) || undefined;
    const height = Number(body.height) || undefined;

    // 1. Strict validation of storage key format (must start with media/ and prevent path traversal)
    if (!storageKey || !storageKey.startsWith('media/') || storageKey.includes('..')) {
      return NextResponse.json(
        { error: 'INVALID_STORAGE_KEY', message: 'Storage key must begin with "media/" and contain no path traversal characters.' },
        { status: 400 }
      );
    }

    // 2. Validate file metadata (name, size, MIME)
    const validation = validateMediaFile(fileName, fileSizeBytes, mimeType);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'INVALID_FILE', message: validation.error },
        { status: 400 }
      );
    }

    // 3. Post-upload storage verification (verifies actual R2 object or test mock)
    const testMockHeader = req.headers.get('x-test-media-verify');
    const verification = await verifyPublicMediaObject(
      storageKey,
      fileSizeBytes,
      validation.canonicalMime || mimeType,
      { testMockHeader }
    );

    if (!verification.verified) {
      return NextResponse.json(
        { error: 'VERIFICATION_FAILED', message: verification.error },
        { status: 400 }
      );
    }

    const newItem: MediaItem = {
      id: `med_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      storageKey,
      url,
      fileName,
      fileSizeBytes: verification.actualSizeBytes || fileSizeBytes,
      mimeType: verification.contentType || validation.canonicalMime || mimeType,
      width,
      height,
      uploadedAt: new Date().toISOString(),
      uploadedBy: auth.user.email || 'admin@printstudio.ae',
    };

    const currentItems = await getMediaLibraryItems();
    currentItems.unshift(newItem);
    await saveMediaLibraryItems(currentItems);

    const clientIp = extractClientIp(req);
    await logAuditEvent({
      userId: auth.user.id,
      action: 'MEDIA_UPLOAD',
      entityType: 'media_asset',
      entityId: newItem.id,
      ipAddress: clientIp,
      details: {
        fileName,
        fileSizeBytes,
        storageKey,
        url,
      },
    });

    return NextResponse.json({
      success: true,
      item: newItem,
    }, { status: 201 });
  } catch (err: any) {
    console.error('Error in POST /api/admin/website/media/register:', err);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to register media asset.' },
      { status: 500 }
    );
  }
}
