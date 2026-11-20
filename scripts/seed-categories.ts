import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { seedCategories } from '../src/lib/category-seed';

if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
}

async function main() {
  console.log('========================================================================');
  console.log('  PRODUCT CATEGORIES INITIAL SEED RUNNER');
  console.log('========================================================================\n');

  const args = process.argv.slice(2);
  const overwrite = args.includes('--overwrite');
  const dryRun = args.includes('--dry-run');

  console.log(`Options: overwrite=${overwrite}, dryRun=${dryRun}\n`);

  try {
    const res = await seedCategories({ overwrite, dryRun });
    console.log(`Result: ${res.message}`);
    console.log(`Total Categories: ${res.total}`);
    console.log('Categories list:');
    res.categories.forEach((c) => {
      console.log(` - [#${c.order}] ${c.name} (${c.id}) -> slug: ${c.slug}, published: ${c.isPublished}`);
    });
    console.log('\n✅ Categories seed execution completed successfully.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Failed to seed categories:', err.message);
    process.exit(1);
  }
}

main();
