import fs from "fs";
import path from "path";
import assert from "assert";

const filePath = path.resolve("src/components/admin/BusinessWorkspaceLayout.tsx");
const content = fs.readFileSync(filePath, "utf8");

console.log("=== Verifying Commercial Dashboard Navigation Realignment ===");

// 1. Assert removed items are NOT present in navigation items
const hasOrdersNav = content.includes('path: "/admin/orders"') && content.includes('label: "Orders"');
const hasEnquiriesNav = content.includes('path: "/admin/enquiries"') && content.includes('label: "Enquiries"');
const hasCustomersNav = content.includes('path: "/admin/customers"') && content.includes('label: "Customers"');
const hasReportsNav = content.includes('path: "/admin/reports"') && content.includes('label: "Reports"');

assert.strictEqual(hasOrdersNav, false, "Orders should NOT be in Commercial navigation");
assert.strictEqual(hasEnquiriesNav, false, "Enquiries should NOT be in Commercial navigation");
assert.strictEqual(hasCustomersNav, false, "Customers should NOT be in Commercial navigation");
assert.strictEqual(hasReportsNav, false, "Reports should NOT be in Commercial navigation");

// 2. Assert kept website items ARE present
assert.ok(content.includes('path: "/admin/products"'), "Products should be in Commercial navigation");
assert.ok(content.includes('path: "/admin/categories"'), "Categories should be in Commercial navigation");
assert.ok(content.includes('path: "/admin/media"'), "Media Library should be in Commercial navigation");
assert.ok(content.includes('path: "/admin/instagram"'), "Instagram should be in Commercial navigation");
assert.ok(content.includes('path: "/admin/settings"'), "Settings should be in Commercial navigation");

// 3. Assert header / brand text is Website Management
assert.ok(
  content.includes("Website Management") || content.includes("Website Console"),
  "Header should reference Website Management"
);

// 4. Assert bottom switcher references Bambu Production & Operations
assert.ok(
  content.includes("Switch to Bambu Production") || content.includes("Switch to Bambu"),
  "Bottom switcher should reference Bambu Production"
);

console.log("All navigation assertions passed! ✅");
