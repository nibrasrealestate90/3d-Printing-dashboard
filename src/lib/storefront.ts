/**
 * Storefront Business Logic, Type-Safe Whitelisting, and Input Validation
 *
 * Security Invariants:
 * - Public products are strictly whitelisted: zero internal costs, margins, printer tokens, or base64 Bambu thumbnails.
 * - Image URLs are strictly validated to prevent scheme injection (javascript:, data:, file:) and path traversal.
 * - Customer enquiries and quote requests (RFQ) are strictly validated and bounded.
 * - Quote requests use server-issued upload tokens; arbitrary storage keys are strictly rejected.
 */

export interface StorefrontProduct {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  categoryId?: string;
  category: string;
  sellingPrice: number;
  currency: string;
  imageUrl: string | null;
  images: string[];
  material?: string;
  dimensions?: string;
  finish?: string;
  colors?: string[];
  supportsPersonalization: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isAvailable: boolean;
  updatedAt: string;
}

export interface InstagramGalleryItem {
  id: string;
  imageUrl: string;
  caption: string;
  postUrl?: string;
  published: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl: string;
  order: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  storageKey: string;
  url: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  width?: number;
  height?: number;
  uploadedAt: string;
  uploadedBy?: string;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Strict Public Product Image URL Sanitizer
 *
 * Security Requirements:
 * - Allows valid HTTPS URLs.
 * - Allows HTTP URLs in local development / non-production environments.
 * - Allows safe local paths beginning with a single `/` (e.g. `/images/model.png`).
 * - Rejects `javascript:`, `data:`, `file:`, `vbscript:`, and any non-web schemes.
 * - Rejects protocol-relative URLs (`//evil.com`).
 * - Rejects backslashes (`\`) and path traversal (`..`).
 * - Rejects ASCII control characters (0x00-0x1F, 0x7F) and unexpected whitespace.
 * - Rejects malformed URLs.
 */
export function sanitizeImageUrl(rawUrl: unknown): string | null {
  if (typeof rawUrl !== 'string') {
    return null;
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  // Reject ASCII control characters and DEL
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return null;
  }

  // Reject backslashes
  if (trimmed.includes('\\')) {
    return null;
  }

  // Reject protocol-relative URLs
  if (trimmed.startsWith('//')) {
    return null;
  }

  // Reject dangerous schemes explicitly
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('about:')
  ) {
    return null;
  }

  // Safe local path handling (e.g. "/images/products/bracket.png")
  if (trimmed.startsWith('/')) {
    // Must start with a single '/' followed by a non-slash character
    if (trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
      return null;
    }
    // Reject path traversal
    if (trimmed.includes('..')) {
      return null;
    }
    return trimmed;
  }

  // Absolute URL handling
  if (lower.startsWith('http://') || lower.startsWith('https://')) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }

    const host = parsed.hostname.toLowerCase();

    // Reject internal / link-local / cloud metadata hostnames (SSRF & internal exposure protection)
    if (
      host === '169.254.169.254' ||
      host === 'metadata.google.internal' ||
      host.endsWith('.internal') ||
      host.endsWith('.local') ||
      host.endsWith('.lan') ||
      host === '0.0.0.0'
    ) {
      return null;
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // In production, reject all private/loopback IP addresses
    if (isProduction) {
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '::1' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        return null;
      }
    }

    if (parsed.protocol === 'https:') {
      return parsed.toString();
    }
    if (parsed.protocol === 'http:' && !isProduction) {
      if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.lvh.me')) {
        return parsed.toString();
      }
      return null;
    }
    // In production, reject unencrypted http: images
    return null;
  }

  return null;
}

/**
 * Maps raw ledger product rows through an authoritative whitelist.
 * Explicitly redacts:
 * - unitCost, filamentCost, productionCost, materialCost, electricityCost
 * - markup, markupAmount, agentPrice
 * - minStock, openingStock, totalPrinted, minutes
 * - bambuPlateId, printerId, internal notes
 * - base64 Bambu thumbnails (photo)
 */
export function sanitizeProductForStorefront(row: {
  record_id: string;
  data: Record<string, any>;
  updated_at?: string | Date;
}): StorefrontProduct {
  const data = row.data || {};
  const name = String(data.name || 'Precision 3D Print').trim();
  const rawId = String(data.id || row.record_id || '');
  const slug = data.slug
    ? String(data.slug)
    : `${slugify(name)}-${rawId.replace(/^prod_/, '').slice(0, 8) || 'spec'}`;

  // Apply robust scheme and scheme-relative validation
  // Strips base64 Bambu camera captures and dangerous schemes; strictly uses commercial imageUrl
  const imageUrl = sanitizeImageUrl(data.imageUrl);

  // Price resolution: prefer sellingPrice, then directPrice, default to 0
  const rawPrice = Number(data.sellingPrice ?? data.directPrice ?? 0);
  const sellingPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : Number(rawPrice.toFixed(2));

  // Public name and description resolution
  const displayName = typeof data.publicName === 'string' && data.publicName.trim()
    ? data.publicName.trim()
    : name;

  const displayDescription = typeof data.publicDescription === 'string' && data.publicDescription.trim()
    ? data.publicDescription.trim()
    : typeof data.description === 'string'
      ? data.description.trim()
      : '';

  // Strict Gallery images sanitation
  const rawImages: unknown[] = Array.isArray(data.images) ? data.images : [];
  const sanitizedImages: string[] = [];
  for (const item of rawImages) {
    const s = sanitizeImageUrl(item);
    if (s && !sanitizedImages.includes(s)) {
      sanitizedImages.push(s);
    }
  }

  // Ensure imageUrl and images follow the same validation rules
  let resolvedImageUrl = imageUrl;
  if (resolvedImageUrl && !sanitizedImages.includes(resolvedImageUrl)) {
    sanitizedImages.unshift(resolvedImageUrl);
  } else if (!resolvedImageUrl && sanitizedImages.length > 0) {
    resolvedImageUrl = sanitizedImages[0];
  }

  // Specifications
  const material = typeof data.material === 'string' && data.material.trim() ? data.material.trim() : undefined;
  const dimensions = typeof data.dimensions === 'string' && data.dimensions.trim() ? data.dimensions.trim() : undefined;
  const finish = typeof data.finish === 'string' && data.finish.trim() ? data.finish.trim() : undefined;
  const colors = Array.isArray(data.colors)
    ? (data.colors as unknown[]).map((c) => String(c).trim()).filter(Boolean)
    : undefined;

  return {
    id: rawId,
    slug,
    sku: String(data.sku || ''),
    name: displayName,
    description: displayDescription,
    categoryId: data.categoryId ? String(data.categoryId) : undefined,
    category: String(data.publicCategory || data.category || '3D Prints').trim(),
    sellingPrice,
    currency: 'AED',
    imageUrl: resolvedImageUrl,
    images: sanitizedImages,
    material,
    dimensions,
    finish,
    colors: colors && colors.length > 0 ? colors : undefined,
    supportsPersonalization: Boolean(data.supportsPersonalization),
    isFeatured: Boolean(data.isFeatured),
    isBestSeller: Boolean(data.isBestSeller),
    isAvailable: Boolean(data.isAvailable ?? true),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

// ----------------------------------------------------------------------------
// Customer Enquiry Validation
// ----------------------------------------------------------------------------

export interface EnquiryInput {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  subject: string;
  message: string;
  productId?: string;
}

export function validateEnquiryInput(payload: any): {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: EnquiryInput;
} {
  const errors: Record<string, string> = {};

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: { _general: 'Invalid request payload.' } };
  }

  const customerName = String(payload.customerName || '').trim();
  if (!customerName) {
    errors.customerName = 'Full name is required.';
  } else if (customerName.length > 150) {
    errors.customerName = 'Name cannot exceed 150 characters.';
  }

  const customerEmail = String(payload.customerEmail || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customerEmail) {
    errors.customerEmail = 'Email address is required.';
  } else if (!emailRegex.test(customerEmail) || customerEmail.length > 255) {
    errors.customerEmail = 'Please provide a valid email address.';
  }

  const customerPhone = payload.customerPhone ? String(payload.customerPhone).trim() : undefined;
  if (customerPhone && customerPhone.length > 50) {
    errors.customerPhone = 'Phone number cannot exceed 50 characters.';
  }

  const subject = String(payload.subject || '').trim();
  if (!subject) {
    errors.subject = 'Subject is required.';
  } else if (subject.length > 200) {
    errors.subject = 'Subject cannot exceed 200 characters.';
  }

  const message = String(payload.message || '').trim();
  if (!message) {
    errors.message = 'Message is required.';
  } else if (message.length > 5000) {
    errors.message = 'Message cannot exceed 5000 characters.';
  }

  const productId = payload.productId ? String(payload.productId).trim() : undefined;
  if (productId && productId.length > 64) {
    errors.productId = 'Product ID cannot exceed 64 characters.';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      customerName,
      customerEmail,
      customerPhone,
      subject,
      message,
      productId,
    },
  };
}

// ----------------------------------------------------------------------------
// Custom Quote Request (RFQ) Validation
// ----------------------------------------------------------------------------

export interface QuoteInput {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  projectTitle: string;
  projectDescription: string;
  materialPreference?: string;
  colorPreference?: string;
  quantity: number;
  targetDeadline?: string;
  uploadToken?: string;
}

export function validateQuoteInput(payload: any): {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: QuoteInput;
} {
  const errors: Record<string, string> = {};

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: { _general: 'Invalid request payload.' } };
  }

  // Security: Reject arbitrary client-selected storage keys explicitly
  if (payload.storageKey !== undefined) {
    errors.storageKey =
      'CLIENT_STORAGE_KEY_FORBIDDEN: Arbitrary storage keys are prohibited. Provide a valid uploadToken issued by /api/store/quotes/presign.';
  }

  const customerName = String(payload.customerName || '').trim();
  if (!customerName) {
    errors.customerName = 'Customer name is required.';
  } else if (customerName.length > 150) {
    errors.customerName = 'Name cannot exceed 150 characters.';
  }

  const customerEmail = String(payload.customerEmail || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customerEmail) {
    errors.customerEmail = 'Email address is required.';
  } else if (!emailRegex.test(customerEmail) || customerEmail.length > 255) {
    errors.customerEmail = 'Please provide a valid email address.';
  }

  const customerPhone = payload.customerPhone ? String(payload.customerPhone).trim() : undefined;
  if (customerPhone && customerPhone.length > 50) {
    errors.customerPhone = 'Phone number cannot exceed 50 characters.';
  }

  const projectTitle = String(payload.projectTitle || '').trim();
  if (!projectTitle) {
    errors.projectTitle = 'Project title is required.';
  } else if (projectTitle.length > 200) {
    errors.projectTitle = 'Project title cannot exceed 200 characters.';
  }

  const projectDescription = String(payload.projectDescription || '').trim();
  if (!projectDescription) {
    errors.projectDescription = 'Project description is required.';
  } else if (projectDescription.length > 5000) {
    errors.projectDescription = 'Project description cannot exceed 5000 characters.';
  }

  const materialPreference = payload.materialPreference
    ? String(payload.materialPreference).trim().slice(0, 100)
    : undefined;

  const colorPreference = payload.colorPreference
    ? String(payload.colorPreference).trim().slice(0, 100)
    : undefined;

  let quantity = 1;
  if (payload.quantity !== undefined && payload.quantity !== null) {
    const parsedQty = Number(payload.quantity);
    if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
      errors.quantity = 'Quantity must be a positive integer.';
    } else if (parsedQty > 100000) {
      errors.quantity = 'Quantity cannot exceed 100,000 units.';
    } else {
      quantity = parsedQty;
    }
  }

  let targetDeadline: string | undefined;
  if (payload.targetDeadline) {
    const rawDate = String(payload.targetDeadline).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      errors.targetDeadline = 'Deadline must be formatted as YYYY-MM-DD.';
    } else {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) {
        errors.targetDeadline = 'Invalid deadline date.';
      } else {
        targetDeadline = rawDate;
      }
    }
  }

  // Upload token validation (cryptographic capability token issued by server)
  let uploadToken: string | undefined;
  if (payload.uploadToken) {
    const rawToken = String(payload.uploadToken).trim();
    if (!/^[a-zA-Z0-9_-]{32,128}$/.test(rawToken)) {
      errors.uploadToken = 'Malformed upload token format.';
    } else {
      uploadToken = rawToken;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      customerName,
      customerEmail,
      customerPhone,
      projectTitle,
      projectDescription,
      materialPreference,
      colorPreference,
      quantity,
      targetDeadline,
      uploadToken,
    },
  };
}

export function formatRfqReference(seqNumber: number): string {
  const year = new Date().getFullYear();
  const padded = String(seqNumber).padStart(4, '0');
  return `RFQ-${year}-${padded}`;
}

// ----------------------------------------------------------------------------
// Instagram Gallery Item Validation
// ----------------------------------------------------------------------------

export function validateInstagramItem(payload: any): {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: Partial<InstagramGalleryItem>;
} {
  const errors: Record<string, string> = {};
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: { _general: 'Invalid payload.' } };
  }

  const imageUrl = sanitizeImageUrl(payload.imageUrl);
  if (!imageUrl) {
    errors.imageUrl = 'A valid image URL is required (HTTPS or local path, no data: or javascript:).';
  }

  const caption = String(payload.caption || '').trim();
  if (!caption) {
    errors.caption = 'Caption is required.';
  } else if (caption.length > 500) {
    errors.caption = 'Caption cannot exceed 500 characters.';
  }

  let postUrl: string | undefined;
  if (payload.postUrl && typeof payload.postUrl === 'string' && payload.postUrl.trim()) {
    const trimmedUrl = payload.postUrl.trim();
    if (/[\x00-\x1F\x7F]/.test(trimmedUrl) || trimmedUrl.startsWith('javascript:') || trimmedUrl.startsWith('data:')) {
      errors.postUrl = 'Invalid Instagram post URL.';
    } else {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          postUrl = parsed.toString();
        } else {
          errors.postUrl = 'Instagram URL must use http or https protocol.';
        }
      } catch {
        errors.postUrl = 'Malformed post URL.';
      }
    }
  }

  const published = typeof payload.published === 'boolean' ? payload.published : true;
  const order = typeof payload.order === 'number' && Number.isFinite(payload.order) ? Math.round(payload.order) : 0;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      imageUrl: imageUrl!,
      caption,
      postUrl,
      published,
      order,
    },
  };
}

// ----------------------------------------------------------------------------
// Product Category Item Validation
// ----------------------------------------------------------------------------

export function validateCategoryItem(
  payload: any,
  existingCategories: CategoryItem[] = [],
  currentId?: string
): {
  valid: boolean;
  errors: Record<string, string>;
  sanitized?: Partial<CategoryItem>;
} {
  const errors: Record<string, string> = {};
  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: { _general: 'Invalid payload.' } };
  }

  // Name validation
  const name = String(payload.name || '').trim();
  if (!name) {
    errors.name = 'Category name is required.';
  } else if (name.length > 100) {
    errors.name = 'Category name cannot exceed 100 characters.';
  } else {
    const isDuplicateName = existingCategories.some(
      (c) => c.id !== currentId && c.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicateName) {
      errors.name = `A category with the name "${name}" already exists.`;
    }
  }

  // Slug validation
  let slug = String(payload.slug || '').trim().toLowerCase();
  if (!slug && name) {
    slug = slugify(name);
  }
  if (!slug) {
    errors.slug = 'Category slug is required.';
  } else if (slug.length > 100) {
    errors.slug = 'Category slug cannot exceed 100 characters.';
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.slug = 'Category slug must contain only lowercase alphanumeric characters and single hyphens.';
  } else {
    const isDuplicateSlug = existingCategories.some(
      (c) => c.id !== currentId && c.slug.trim().toLowerCase() === slug.toLowerCase()
    );
    if (isDuplicateSlug) {
      errors.slug = `A category with the slug "${slug}" already exists.`;
    }
  }

  // Image URL validation (required)
  const imageUrl = sanitizeImageUrl(payload.imageUrl);
  if (!imageUrl) {
    errors.imageUrl = 'A valid image URL is required (HTTPS or local path, no data: or javascript:).';
  }

  // Description validation (optional)
  let description: string | undefined;
  if (typeof payload.description === 'string' && payload.description.trim()) {
    const trimmedDesc = payload.description.trim();
    if (trimmedDesc.length > 500) {
      errors.description = 'Description cannot exceed 500 characters.';
    } else {
      description = trimmedDesc;
    }
  }

  const isPublished = typeof payload.isPublished === 'boolean'
    ? payload.isPublished
    : typeof payload.published === 'boolean'
      ? payload.published
      : true;

  const order = typeof payload.order === 'number' && Number.isFinite(payload.order)
    ? Math.round(payload.order)
    : 0;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    sanitized: {
      name,
      slug,
      description: description || '',
      imageUrl: imageUrl!,
      order,
      isPublished,
    },
  };
}

// ----------------------------------------------------------------------------
// Public Media File Validation
// ----------------------------------------------------------------------------

export const ALLOWED_MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
export const MAX_MEDIA_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const PROHIBITED_CAD_EXTENSIONS = new Set(['.step', '.stp', '.stl', '.3mf', '.obj']);

export const MEDIA_MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function validateMediaFile(
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
      error: 'File must have a valid image extension (.jpg, .jpeg, .png, .webp).',
    };
  }

  const ext = trimmed.slice(lastDot).toLowerCase();

  // Strict check: Prevent CAD files from entering public media library
  if (PROHIBITED_CAD_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `CAD files (${ext}) are prohibited in the public media library. Use the CAD quote upload system instead.`,
    };
  }

  if (!ALLOWED_MEDIA_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported image format "${ext}". Allowed formats: JPEG, PNG, WebP.`,
    };
  }

  if (typeof fileSizeBytes !== 'number' || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return { valid: false, error: 'File size must be a positive number of bytes.' };
  }

  if (fileSizeBytes > MAX_MEDIA_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 10 MB limit (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB provided).`,
    };
  }

  const canonicalMime = MEDIA_MIME_TYPES[ext] || 'image/jpeg';
  if (mimeType && typeof mimeType === 'string') {
    const cleanMime = mimeType.trim().toLowerCase();
    if (
      cleanMime !== 'image/jpeg' &&
      cleanMime !== 'image/png' &&
      cleanMime !== 'image/webp'
    ) {
      return {
        valid: false,
        error: `MIME type "${mimeType}" is not an accepted image format. Allowed: image/jpeg, image/png, image/webp.`,
      };
    }
  }

  return { valid: true, extension: ext, canonicalMime };
}

/**
 * Verifies actual image file signatures (magic bytes) to prevent disguised files,
 * polyglots, or CAD models renamed with image extensions.
 */
export function validateImageSignature(buffer: Buffer): {
  valid: boolean;
  detectedMime?: string;
  error?: string;
} {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: 'File data is too small to be a valid image.' };
  }

  // Reject CAD text headers
  const headerText = buffer.slice(0, 128).toString('ascii');
  if (
    headerText.startsWith('ISO-10303-21;') ||
    (headerText.includes('HEADER;') && headerText.includes('FILE_DESCRIPTION'))
  ) {
    return { valid: false, error: 'Prohibited CAD file signature detected (STEP model).' };
  }
  if (
    headerText.startsWith('solid ') ||
    headerText.startsWith('solid\n') ||
    headerText.startsWith('solid\r\n')
  ) {
    return { valid: false, error: 'Prohibited CAD file signature detected (ASCII STL model).' };
  }

  // 1. JPEG: 0xFF, 0xD8, 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, detectedMime: 'image/jpeg' };
  }

  // 2. PNG: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, detectedMime: 'image/png' };
  }

  // 3. WebP: RIFF [4 bytes size] WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, detectedMime: 'image/webp' };
  }

  return {
    valid: false,
    error: 'Invalid file signature. File header does not match approved JPEG, PNG, or WebP magic bytes.',
  };
}
