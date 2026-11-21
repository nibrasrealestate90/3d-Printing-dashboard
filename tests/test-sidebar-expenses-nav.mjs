import fs from "fs";
import path from "path";
import assert from "assert";

console.log("=== RUNNING TASK 2 NAVIGATION & SIDEBAR VERIFICATION ===");

const repoRoot = process.cwd();
const hugeIconsPath = path.join(repoRoot, "src/components/hugeIcons.tsx");
const ledgerCorePath = path.join(repoRoot, "src/components/ledgerCore.js");

const hugeIconsContent = fs.readFileSync(hugeIconsPath, "utf-8");
const ledgerCoreContent = fs.readFileSync(ledgerCorePath, "utf-8");

// --- TEST 1: APP_ICONS.navExpenses in hugeIcons.tsx ---
console.log("\n[TEST 1] Verifying APP_ICONS.navExpenses in hugeIcons.tsx...");
assert(hugeIconsContent.includes("navExpenses:"), "APP_ICONS.navExpenses must be exported in hugeIcons.tsx");
assert(
  hugeIconsContent.includes('<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">') &&
  hugeIconsContent.includes('d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"'),
  "APP_ICONS.navExpenses must use the clean Lucide receipt outline SVG specification"
);
console.log("✓ PASS: APP_ICONS.navExpenses is present, clean, and matches design tokens.");

// --- TEST 2: Manufacturing NAV_GROUPS in ledgerCore.js ---
console.log("\n[TEST 2] Verifying Manufacturing NAV_GROUPS in ledgerCore.js...");
const navGroupMatch = ledgerCoreContent.match(/group:\s*"MANUFACTURING",\s*items:\s*\[([\s\S]*?)\]/);
assert(navGroupMatch, "Manufacturing NAV_GROUP must be found in ledgerCore.js");
const manufacturingItemsBlock = navGroupMatch[1];

assert(manufacturingItemsBlock.includes('key: "expenses"'), "Manufacturing group must contain key: 'expenses'");
assert(manufacturingItemsBlock.includes('label: "Expenses"'), "Expenses item must have label: 'Expenses'");
assert(manufacturingItemsBlock.includes('icon: APP_ICONS.navExpenses'), "Expenses item must use APP_ICONS.navExpenses");
assert(!manufacturingItemsBlock.includes('key: "stock"'), "Manufacturing group must NOT contain key: 'stock'");
assert(!manufacturingItemsBlock.includes('label: "Stock Management"'), "Manufacturing group must NOT display 'Stock Management'");

// Verify item order
const keyMatches = [...manufacturingItemsBlock.matchAll(/key:\s*"([^"]+)"/g)].map(m => m[1]);
console.log("Found Manufacturing keys in order:", keyMatches);
assert.deepStrictEqual(
  keyMatches,
  ["dashboard", "products", "prints", "filaments", "expenses", "calc"],
  "Manufacturing keys must be in exact order: dashboard, products, prints, filaments, expenses, calc"
);
console.log("✓ PASS: Manufacturing NAV_GROUPS has 'expenses' in exact slot and no 'stock'.");

// --- TEST 3: Other Workspace Groups Untouched ---
console.log("\n[TEST 3] Verifying OPERATIONS group untouched...");
const opsMatch = ledgerCoreContent.match(/group:\s*"OPERATIONS",\s*items:\s*\[([\s\S]*?)\]/);
assert(opsMatch, "OPERATIONS NAV_GROUP must be found in ledgerCore.js");
const opsKeys = [...opsMatch[1].matchAll(/key:\s*"([^"]+)"/g)].map(m => m[1]);
assert.deepStrictEqual(opsKeys, ["automation-history", "settings"], "OPERATIONS keys must remain unchanged");
console.log("✓ PASS: Operations navigation items remain intact.");

// --- TEST 4: TABS Array Registration ---
console.log("\n[TEST 4] Verifying TABS array registration...");
const tabsMatch = ledgerCoreContent.match(/const TABS = \[([\s\S]*?)\];/);
assert(tabsMatch, "TABS array must be found");
const tabsBlock = tabsMatch[1];
assert(tabsBlock.includes('["expenses", "Expenses"]'), "TABS array must register ['expenses', 'Expenses']");
assert(!tabsBlock.includes('["stock", "Stock Management"]'), "TABS array must not contain ['stock', 'Stock Management']");
console.log("✓ PASS: TABS array registers 'expenses' and removes 'stock'.");

// --- TEST 5: tabTitles and tabCrumbs ---
console.log("\n[TEST 5] Verifying tabTitles and tabCrumbs...");
assert(ledgerCoreContent.includes('expenses: "Expenses"'), "tabTitles must include expenses: 'Expenses'");
assert(ledgerCoreContent.includes('expenses: "MANUFACTURING :"'), "tabCrumbs must set expenses: 'MANUFACTURING :'");
assert(ledgerCoreContent.includes('stock: "Expenses"'), "tabTitles must alias stock: 'Expenses'");
assert(ledgerCoreContent.includes('stock: "MANUFACTURING :"'), "tabCrumbs must alias stock: 'MANUFACTURING :'");
console.log("✓ PASS: tabTitles and tabCrumbs correctly configured for expenses with stock legacy alias.");

// --- TEST 6: allowedTabs and legacy stock alias ---
console.log("\n[TEST 6] Verifying allowedTabs and legacy stock routing...");
assert(ledgerCoreContent.includes('"expenses"'), "allowedTabs must include 'expenses'");
assert(ledgerCoreContent.includes('savedTab === "stock"'), "savedTab check must catch legacy 'stock'");
assert(ledgerCoreContent.includes('tab === "stock"'), "tab check must catch legacy 'stock'");
console.log("✓ PASS: Legacy stock redirection and allowedTabs correctly configured.");

// --- TEST 7: Legacy vStock Preserved ---
console.log("\n[TEST 7] Verifying legacy vStock function preserved...");
assert(ledgerCoreContent.includes("function vStock()"), "Legacy vStock() function must be preserved");
console.log("✓ PASS: Legacy vStock() implementation is preserved and not destructively deleted.");

console.log("\n=== ALL NAVIGATION & SIDEBAR TESTS PASSED (7/7) ===");
