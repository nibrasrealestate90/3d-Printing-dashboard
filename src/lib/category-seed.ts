import { sql } from '@/lib/db';
import { CategoryItem } from '@/lib/storefront';

/**
 * Canonical initial categories matching the 7 existing dashboard categories
 * and preserving existing storefront category IDs wherever applicable.
 */
export const CANONICAL_CATEGORIES: Omit<CategoryItem, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'cat-home-decor',
    name: 'Home Decor',
    slug: 'home-decor',
    description: 'Sculptural vases, ambient Voronoi lamps, and architectural planters.',
    imageUrl: '/assets/images/cat_home_decor_1794842128662.jpg',
    order: 1,
    isPublished: true,
  },
  {
    id: 'cat-personalized-gifts',
    name: 'Personalized Gifts',
    slug: 'personalized-gifts',
    description: 'Monogrammed keepsakes, bespoke gift boxes, and custom-engraved sets.',
    imageUrl: '/assets/images/prod_gift_box_1794842128070.jpg',
    order: 2,
    isPublished: true,
  },
  {
    id: 'cat-keychains',
    name: 'Keychains & Accessories',
    slug: 'keychains-accessories',
    description: 'Custom raised-letter name tags, bag charms, and tactile hardware.',
    imageUrl: '/assets/images/prod_name_keychain_1794842125460.jpg',
    order: 3,
    isPublished: true,
  },
  {
    id: 'cat-desk-accessories',
    name: 'Desk Accessories',
    slug: 'desk-accessories',
    description: 'Executive desk nameplates, skyline organizers, and studio catchalls.',
    imageUrl: '/assets/images/prod_desk_nameplate_1794842127254.jpg',
    order: 4,
    isPublished: true,
  },
  {
    id: 'cat-phone-stands',
    name: 'Phone Stands',
    slug: 'phone-stands',
    description: 'Minimalist weighted desk docks with acoustic and charging channels.',
    imageUrl: '/assets/images/prod_phone_stand_1794842126145.jpg',
    order: 5,
    isPublished: true,
  },
  {
    id: 'cat-corporate-gifts',
    name: 'Corporate Gifts',
    slug: 'corporate-gifts',
    description: 'Branded Dubai skyline awards, event trophies, and executive gifting.',
    imageUrl: '/assets/images/cat_corporate_gifts_1794842127953.jpg',
    order: 6,
    isPublished: true,
  },
  {
    id: 'cat-custom-prints',
    name: 'Custom Prints',
    slug: 'custom-prints',
    description: 'One-off bespoke fabrication, functional engineering parts, and custom client briefs.',
    imageUrl: '/assets/images/cat_home_decor_1794842128662.jpg',
    order: 7,
    isPublished: true,
  },
];

export interface SeedCategoriesOptions {
  overwrite?: boolean;
  dryRun?: boolean;
}

export interface SeedCategoriesResult {
  success: boolean;
  inserted: number;
  retained: number;
  total: number;
  categories: CategoryItem[];
  message: string;
}

/**
 * Idempotent, repeatable seed mechanism.
 * Safe to execute multiple times:
 * - Does not duplicate categories.
 * - Does not overwrite existing administrator customizations unless overwrite === true.
 * - Leaves existing products intact.
 */
export async function seedCategories(
  options: SeedCategoriesOptions = {}
): Promise<SeedCategoriesResult> {
  if (!sql) {
    throw new Error('Database connection is not configured.');
  }

  const { overwrite = false, dryRun = false } = options;

  // 1. Fetch current categories document from public.ledger_collections
  const rows = await sql`
    SELECT data
    FROM public.ledger_collections
    WHERE collection_name = 'website_content' AND record_id = 'categories'
    LIMIT 1;
  `;

  const existingItems: CategoryItem[] = Array.isArray(rows[0]?.data?.items)
    ? rows[0].data.items
    : [];

  const now = new Date().toISOString();
  let inserted = 0;
  let retained = 0;
  const merged: CategoryItem[] = [];

  if (overwrite) {
    // Replace completely with canonical seed
    CANONICAL_CATEGORIES.forEach((canon, idx) => {
      merged.push({
        ...canon,
        order: idx + 1,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    });
  } else {
    // Preserve all existing items
    const existingIds = new Set(existingItems.map((c) => c.id));
    const existingNames = new Set(existingItems.map((c) => c.name.trim().toLowerCase()));
    const existingSlugs = new Set(existingItems.map((c) => c.slug.trim().toLowerCase()));

    // Keep existing items
    existingItems.forEach((item) => {
      merged.push(item);
      retained++;
    });

    // Append canonical categories only if they don't conflict with existing ID, name, or slug
    for (const canon of CANONICAL_CATEGORIES) {
      const idConflict = existingIds.has(canon.id);
      const nameConflict = existingNames.has(canon.name.trim().toLowerCase());
      const slugConflict = existingSlugs.has(canon.slug.trim().toLowerCase());

      if (!idConflict && !nameConflict && !slugConflict) {
        merged.push({
          ...canon,
          order: merged.length + 1,
          createdAt: now,
          updatedAt: now,
        });
        existingIds.add(canon.id);
        existingNames.add(canon.name.trim().toLowerCase());
        existingSlugs.add(canon.slug.trim().toLowerCase());
        inserted++;
      }
    }
  }

  // Ensure items are ordered by order ASC
  merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!dryRun) {
    await sql`
      INSERT INTO public.ledger_collections (collection_name, record_id, data, updated_at)
      VALUES (
        'website_content',
        'categories',
        ${JSON.stringify({ items: merged, updatedAt: now })}::jsonb,
        NOW()
      )
      ON CONFLICT (collection_name, record_id)
      DO UPDATE SET
        data = EXCLUDED.data,
        updated_at = NOW();
    `;
  }

  return {
    success: true,
    inserted,
    retained,
    total: merged.length,
    categories: merged,
    message: dryRun
      ? `Dry-run completed: would insert ${inserted}, retain ${retained} (total: ${merged.length})`
      : `Successfully seeded categories: ${inserted} inserted, ${retained} retained (total: ${merged.length})`,
  };
}
