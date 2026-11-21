import fs from "fs";
import path from "path";
import assert from "assert";

const filePath = path.resolve("src/app/admin/page.tsx");
const content = fs.readFileSync(filePath, "utf8");

console.log("=== Verifying Website Management Overview Redesign ===");

// 1. Assert removed order/revenue sales metrics are NOT present
assert.strictEqual(content.includes('label="Total Orders"'), false, "Total Orders metric should be removed");
assert.strictEqual(content.includes('label="Total Revenue"'), false, "Total Revenue metric should be removed");
assert.strictEqual(content.includes('Recent Commercial Orders'), false, "Recent Commercial Orders section should be removed");
assert.strictEqual(content.includes('href="/admin/orders"'), false, "Links to /admin/orders should be removed");

// 2. Assert website-centric metrics ARE present
assert.ok(content.includes("Published Products") || content.includes("Store Catalog"), "Should have Published Products/Catalog metric");
assert.ok(content.includes("Store Categories") || content.includes("Categories"), "Should have Store Categories metric");
assert.ok(content.includes("Media Assets") || content.includes("Media Library"), "Should have Media Assets metric");

// 3. Assert breadcrumbs update
assert.ok(content.includes('breadcrumbs="Website Management"') || content.includes('breadcrumbs="Website"'), "Breadcrumbs should say Website Management");

console.log("All website overview assertions passed! ✅");
