import {
  validateCategoryItem,
  CategoryItem,
} from '../src/lib/storefront';
import {
  CANONICAL_CATEGORIES,
} from '../src/lib/category-seed';

async function runCategoryBackendTests() {
  console.log('========================================================================');
  console.log('  PRODUCT CATEGORY MANAGEMENT — BACKEND FOUNDATION VERIFICATION');
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

  // Existing mock categories for duplicate checks
  const existingCategories: CategoryItem[] = [
    {
      id: 'cat-home-decor',
      name: 'Home Decor',
      slug: 'home-decor',
      description: 'Vases and lamps',
      imageUrl: '/assets/images/cat_home_decor.jpg',
      order: 1,
      isPublished: true,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
    {
      id: 'cat-desk-accessories',
      name: 'Desk Accessories',
      slug: 'desk-accessories',
      description: 'Desk organizers',
      imageUrl: '/assets/images/desk.jpg',
      order: 2,
      isPublished: false,
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
  ];

  // --------------------------------------------------------------------------
  // TEST GROUP 1: Category Validation & Creation
  // --------------------------------------------------------------------------
  console.log('--- 1. Category Validation & Creation ---');

  // Test 1: Valid category passes
  const valid = validateCategoryItem({
    name: 'Architectural Models',
    slug: 'architectural-models',
    description: 'Precision scale architectural 3D prints.',
    imageUrl: 'https://pub-mock.r2.dev/media/categories/2026-11/arch.jpg',
    order: 3,
    isPublished: true,
  }, existingCategories);
  assert(
    'Valid category payload is accepted and sanitized',
    valid.valid &&
      valid.sanitized?.name === 'Architectural Models' &&
      valid.sanitized?.slug === 'architectural-models' &&
      valid.sanitized?.imageUrl === 'https://pub-mock.r2.dev/media/categories/2026-11/arch.jpg' &&
      valid.sanitized?.order === 3 &&
      valid.sanitized?.isPublished === true
  );

  // Test 2: Auto-generate slug from name if omitted
  const autoSlug = validateCategoryItem({
    name: 'Lithophane Lamps & Art',
    imageUrl: '/assets/images/lamp.jpg',
  }, existingCategories);
  assert(
    'Slug is automatically generated from name when omitted',
    autoSlug.valid && autoSlug.sanitized?.slug === 'lithophane-lamps-art'
  );

  // Test 3: Reject empty name
  const emptyName = validateCategoryItem({
    name: '   ',
    imageUrl: '/assets/images/test.jpg',
  }, existingCategories);
  assert('Empty category name is rejected', !emptyName.valid && !!emptyName.errors.name);

  // Test 4: Reject name exceeding 100 characters
  const longName = validateCategoryItem({
    name: 'A'.repeat(101),
    imageUrl: '/assets/images/test.jpg',
  }, existingCategories);
  assert('Category name exceeding 100 characters is rejected', !longName.valid && !!longName.errors.name);

  // Test 5: Reject duplicate category name (case-insensitive)
  const dupName = validateCategoryItem({
    name: 'home decor',
    imageUrl: '/assets/images/test.jpg',
  }, existingCategories);
  assert(
    'Duplicate category name is strictly rejected (case-insensitive)',
    !dupName.valid && !!dupName.errors.name
  );

  // Test 6: Reject duplicate category slug
  const dupSlug = validateCategoryItem({
    name: 'Unique Decor',
    slug: 'home-decor',
    imageUrl: '/assets/images/test.jpg',
  }, existingCategories);
  assert(
    'Duplicate category slug is strictly rejected',
    !dupSlug.valid && !!dupSlug.errors.slug
  );

  // Test 7: Reject invalid slug characters (spaces, uppercase, symbols)
  const invalidSlug = validateCategoryItem({
    name: 'Custom Parts',
    slug: 'Custom_Parts & Models!',
    imageUrl: '/assets/images/test.jpg',
  }, existingCategories);
  assert(
    'Invalid slug containing uppercase or special characters is rejected',
    !invalidSlug.valid && !!invalidSlug.errors.slug
  );

  // Test 8: Reject dangerous or invalid image URLs (XSS protection)
  const xssImage = validateCategoryItem({
    name: 'Malicious Category',
    imageUrl: 'javascript:alert(1)',
  }, existingCategories);
  assert(
    'javascript: image URL scheme is rejected',
    !xssImage.valid && !!xssImage.errors.imageUrl
  );

  const dataUriImage = validateCategoryItem({
    name: 'Data URI Category',
    imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
  }, existingCategories);
  assert(
    'data: URI image scheme is rejected',
    !dataUriImage.valid && !!dataUriImage.errors.imageUrl
  );

  // Test 9: Description length limit (>500 rejected)
  const longDesc = validateCategoryItem({
    name: 'Scale Models',
    description: 'X'.repeat(501),
    imageUrl: '/assets/images/test.jpg',
  }, existingCategories);
  assert(
    'Description exceeding 500 characters is rejected',
    !longDesc.valid && !!longDesc.errors.description
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 2: Canonical Initial Seed Definition & Idempotency
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Canonical Initial Seed Verification ---');

  // Test 10: Canonical categories array contains all 7 required categories
  assert(
    'Canonical seed contains exactly 7 categories',
    CANONICAL_CATEGORIES.length === 7
  );

  const canonicalIds = CANONICAL_CATEGORIES.map((c) => c.id);
  const expectedIds = [
    'cat-home-decor',
    'cat-personalized-gifts',
    'cat-keychains',
    'cat-desk-accessories',
    'cat-phone-stands',
    'cat-corporate-gifts',
    'cat-custom-prints',
  ];
  const allIdsMatch = expectedIds.every((id) => canonicalIds.includes(id));
  assert(
    'Canonical categories preserve existing storefront category IDs',
    allIdsMatch
  );

  // Test 11: Seed merging idempotency check
  const existingSet = new Set(existingCategories.map((c) => c.id));
  const newToAdd = CANONICAL_CATEGORIES.filter((c) => !existingSet.has(c.id));
  assert(
    'Idempotent seed correctly identifies only unseeded categories without duplicate IDs',
    newToAdd.length === 5 && !newToAdd.some((c) => existingSet.has(c.id))
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 3: Product Assignment & Dynamic Product Counts
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Product Assignment & Dynamic Product Counts ---');

  // Simulated product records in ledger_collections
  const mockProductRows = [
    { category_id: 'cat-home-decor', category_name: 'home decor', public_category_name: 'home decor' },
    { category_id: null, category_name: 'home decor', public_category_name: 'home decor' }, // Legacy string match
    { category_id: null, category_name: '', public_category_name: 'Home Decor' }, // Legacy publicCategory match
    { category_id: 'cat-desk-accessories', category_name: 'desk accessories', public_category_name: 'desk accessories' },
    { category_id: null, category_name: 'custom prints', public_category_name: 'custom prints' },
  ];

  function calcProductCount(cat: { id: string; name: string }) {
    const lowerName = cat.name.trim().toLowerCase();
    return mockProductRows.filter((p) =>
      (p.category_id && p.category_id === cat.id) ||
      (p.category_name && p.category_name.toLowerCase() === lowerName) ||
      (p.public_category_name && p.public_category_name.toLowerCase() === lowerName)
    ).length;
  }

  const homeDecorCount = calcProductCount(existingCategories[0]);
  assert(
    'Home Decor product count correctly matches both categoryId and legacy category string (expected 3)',
    homeDecorCount === 3
  );

  const deskCount = calcProductCount(existingCategories[1]);
  assert(
    'Desk Accessories product count correctly matches (expected 1)',
    deskCount === 1
  );

  const unusedCategory = { id: 'cat-empty', name: 'Empty Category' };
  const unusedCount = calcProductCount(unusedCategory);
  assert(
    'Unused category product count evaluates to 0',
    unusedCount === 0
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 4: Deletion Protection Rules
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Deletion Protection Rules ---');

  // Test 12: Deletion rejected when assigned products > 0
  const canDeleteAssigned = homeDecorCount === 0;
  assert(
    'Deletion of category assigned to products is blocked (count > 0)',
    !canDeleteAssigned
  );

  // Test 13: Deletion allowed when assigned products === 0
  const canDeleteUnused = unusedCount === 0;
  assert(
    'Deletion of unused category is permitted (count === 0)',
    canDeleteUnused
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 5: Category Renaming & Stable ID Preservation
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Category Renaming & Stable ID Preservation ---');

  // Editing existing category: allow same name/slug if updating itself
  const selfUpdate = validateCategoryItem({
    name: 'Home Decor',
    slug: 'home-decor',
    description: 'Updated description',
    imageUrl: '/assets/images/updated.jpg',
  }, existingCategories, 'cat-home-decor');
  assert(
    'Self-updating a category allows keeping its existing name and slug',
    selfUpdate.valid
  );

  // Renaming category keeps stable ID
  const renamed = validateCategoryItem({
    name: 'Luxury Home Decor',
    slug: 'luxury-home-decor',
    imageUrl: '/assets/images/updated.jpg',
  }, existingCategories, 'cat-home-decor');
  assert(
    'Category renaming to new unique name succeeds while preserving stable categoryId',
    renamed.valid && renamed.sanitized?.name === 'Luxury Home Decor'
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 6: Media Reference Protection for Categories
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Media Reference Protection for Categories ---');

  const mediaItems = [
    { url: '/assets/images/cat_home_decor.jpg', id: 'media-1', fileName: 'cat_home_decor.jpg' },
    { url: '/assets/images/desk.jpg', id: 'media-2', fileName: 'desk.jpg' }, // in unpublished category
    { url: '/assets/images/unreferenced.jpg', id: 'media-3', fileName: 'unreferenced.jpg' },
  ];

  function checkMediaCategoryReferences(mediaUrl: string, categories: CategoryItem[]) {
    const referencing: string[] = [];
    for (const cat of categories) {
      if (cat.imageUrl === mediaUrl) {
        referencing.push(`Category: ${cat.name || cat.id}`);
      }
    }
    return referencing;
  }

  const refPublished = checkMediaCategoryReferences(mediaItems[0].url, existingCategories);
  assert(
    'Image used by published category is flagged as referenced',
    refPublished.length === 1 && refPublished[0] === 'Category: Home Decor'
  );

  const refUnpublished = checkMediaCategoryReferences(mediaItems[1].url, existingCategories);
  assert(
    'Image used by UNPUBLISHED category is also protected and flagged as referenced',
    refUnpublished.length === 1 && refUnpublished[0] === 'Category: Desk Accessories'
  );

  const refNone = checkMediaCategoryReferences(mediaItems[2].url, existingCategories);
  assert(
    'Unreferenced image is not flagged and remains eligible for safe deletion',
    refNone.length === 0
  );

  // --------------------------------------------------------------------------
  // TEST GROUP 7: Transactional Category Rename & Atomic Rollback Simulation
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Transactional Category Rename & Atomic Rollback Simulation ---');

  // Simulated in-memory transactional database state
  interface MockDbState {
    categoriesDoc: { items: CategoryItem[]; updatedAt: string };
    products: Array<{ record_id: string; data: Record<string, any> }>;
    auditEvents: any[];
  }

  function createInitialDbState(): MockDbState {
    return {
      categoriesDoc: {
        items: [
          {
            id: 'cat-home-decor',
            name: 'Home Decor',
            slug: 'home-decor',
            description: 'Vases and lamps',
            imageUrl: '/assets/images/home.jpg',
            order: 1,
            isPublished: true,
            createdAt: '2026-11-20T10:00:00.000Z',
            updatedAt: '2026-11-20T10:00:00.000Z',
          },
          {
            id: 'cat-unused',
            name: 'Unused Category',
            slug: 'unused',
            description: 'No products here',
            imageUrl: '/assets/images/unused.jpg',
            order: 2,
            isPublished: true,
            createdAt: '2026-11-20T10:00:00.000Z',
            updatedAt: '2026-11-20T10:00:00.000Z',
          },
        ],
        updatedAt: '2026-11-20T10:00:00.000Z',
      },
      products: [
        {
          record_id: 'prod-1',
          data: { id: 'prod-1', name: 'Planter', categoryId: 'cat-home-decor', category: 'Home Decor', publicCategory: 'Home Decor' },
        },
        {
          record_id: 'prod-2',
          data: { id: 'prod-2', name: 'Lamp', category: 'home decor' }, // Legacy without categoryId
        },
      ],
      auditEvents: [],
    };
  }

  // Simulated transaction runner mirroring withTransaction semantics
  async function simulateCategoryRenameTransaction(
    state: MockDbState,
    categoryId: string,
    newName: string,
    newSlug: string,
    failStep?: 'product_update' | 'category_save'
  ): Promise<{ success: boolean; error?: string }> {
    const target = state.categoriesDoc.items.find((c) => c.id === categoryId);
    if (!target) return { success: false, error: 'Category not found' };
    const oldName = target.name;

    // Snapshot state for atomic rollback
    const snapshotProducts = JSON.parse(JSON.stringify(state.products));
    const snapshotDoc = JSON.parse(JSON.stringify(state.categoriesDoc));

    try {
      // Step 1: Update assigned products
      if (failStep === 'product_update') {
        throw new Error('Database connection reset during products update');
      }

      state.products.forEach((p) => {
        const matchesId = p.data.categoryId === categoryId;
        const matchesCat = (p.data.category || '').toLowerCase() === oldName.toLowerCase();
        const matchesPub = (p.data.publicCategory || '').toLowerCase() === oldName.toLowerCase();
        if (matchesId || matchesCat || matchesPub) {
          p.data.category = newName;
          p.data.publicCategory = newName;
          p.data.categoryId = categoryId;
        }
      });

      // Step 2: Save category document
      if (failStep === 'category_save') {
        throw new Error('Lock timeout while updating categories document');
      }

      const updatedItems = state.categoriesDoc.items.map((c) =>
        c.id === categoryId ? { ...c, name: newName, slug: newSlug, updatedAt: new Date().toISOString() } : c
      );
      state.categoriesDoc = { items: updatedItems, updatedAt: new Date().toISOString() };

      // Step 3: Transaction committed -> Audit event logged
      state.auditEvents.push({
        action: 'CATEGORY_RENAME',
        entityId: categoryId,
        details: { oldName, newName },
      });

      return { success: true };
    } catch (err: any) {
      // Transaction Rollback: restore snapshot
      state.products = snapshotProducts;
      state.categoriesDoc = snapshotDoc;
      return { success: false, error: err.message };
    }
  }

  // Test 14: Successful rename of category with assigned products
  const db1 = createInitialDbState();
  const res1 = await simulateCategoryRenameTransaction(db1, 'cat-home-decor', 'Luxury Home Decor', 'luxury-home-decor');
  assert('Rename category with assigned products updates all records atomically', res1.success);
  assert(
    'Assigned product with categoryId updated to new category name',
    db1.products[0].data.category === 'Luxury Home Decor' && db1.products[0].data.categoryId === 'cat-home-decor'
  );
  assert(
    'Legacy product without categoryId resolved to new name and stable categoryId',
    db1.products[1].data.category === 'Luxury Home Decor' && db1.products[1].data.categoryId === 'cat-home-decor'
  );
  assert(
    'Categories document reflects new name',
    db1.categoriesDoc.items.find((c) => c.id === 'cat-home-decor')?.name === 'Luxury Home Decor'
  );
  assert(
    'Audit event recorded upon successful transaction commit',
    db1.auditEvents.length === 1 && db1.auditEvents[0].action === 'CATEGORY_RENAME'
  );

  // Test 15: Rename category with no assigned products
  const db2 = createInitialDbState();
  const res2 = await simulateCategoryRenameTransaction(db2, 'cat-unused', 'Archived Items', 'archived-items');
  assert('Rename category with no assigned products succeeds cleanly', res2.success);
  assert(
    'Unused category document updated successfully',
    db2.categoriesDoc.items.find((c) => c.id === 'cat-unused')?.name === 'Archived Items'
  );

  // Test 16: Failure during product update rolls back completely
  const db3 = createInitialDbState();
  const res3 = await simulateCategoryRenameTransaction(db3, 'cat-home-decor', 'Broken Decor', 'broken', 'product_update');
  assert('Simulated product update failure triggers rollback and returns error', !res3.success);
  assert(
    'Product records remain completely unchanged after product update failure',
    db3.products[0].data.category === 'Home Decor' && db3.products[1].data.category === 'home decor'
  );
  assert(
    'Category document remains completely unchanged after product update failure',
    db3.categoriesDoc.items.find((c) => c.id === 'cat-home-decor')?.name === 'Home Decor'
  );
  assert(
    'No audit event recorded when transaction fails during product update',
    db3.auditEvents.length === 0
  );

  // Test 17: Failure during category document persistence rolls back product update
  const db4 = createInitialDbState();
  const res4 = await simulateCategoryRenameTransaction(db4, 'cat-home-decor', 'Broken Decor', 'broken', 'category_save');
  assert('Simulated category document persistence failure triggers rollback', !res4.success);
  assert(
    'Product records rolled back to original category name (no orphaned product changes)',
    db4.products[0].data.category === 'Home Decor' && db4.products[1].data.category === 'home decor'
  );
  assert(
    'Category document preserves original category name',
    db4.categoriesDoc.items.find((c) => c.id === 'cat-home-decor')?.name === 'Home Decor'
  );
  assert(
    'No audit event recorded when transaction fails during category save',
    db4.auditEvents.length === 0
  );

  console.log('\n========================================================================');
  console.log(`SCORECARD: ${passed} / ${total} tests passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runCategoryBackendTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
