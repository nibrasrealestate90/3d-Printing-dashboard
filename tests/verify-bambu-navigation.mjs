import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('=== Verifying Bambu Production App Navigation & Tab Routing ===');

const projectRoot = process.cwd();
const ledgerCorePath = path.join(projectRoot, 'src/components/ledgerCore.js');
const printStudioLedgerPath = path.join(projectRoot, 'src/components/PrintStudioLedger.tsx');
const hugeIconsPath = path.join(projectRoot, 'src/components/hugeIcons.tsx');

const ledgerCoreCode = fs.readFileSync(ledgerCorePath, 'utf8');
const printStudioLedgerCode = fs.readFileSync(printStudioLedgerPath, 'utf8');
const hugeIconsCode = fs.readFileSync(hugeIconsPath, 'utf8');

// 1. Verify APP_ICONS has navEnquiries, navOrders, navCustomers, navReports
assert(hugeIconsCode.includes('navOrders'), 'hugeIcons.tsx must define navOrders icon');
assert(hugeIconsCode.includes('navEnquiries'), 'hugeIcons.tsx must define navEnquiries icon');
assert(hugeIconsCode.includes('navCustomers'), 'hugeIcons.tsx must define navCustomers icon');
assert(hugeIconsCode.includes('navReports'), 'hugeIcons.tsx must define navReports icon');

// 2. Verify NAV_GROUPS in ledgerCore.js
assert(ledgerCoreCode.includes('COMMERCE & FULFILLMENT'), 'ledgerCore.js must define COMMERCE & FULFILLMENT navigation group');
assert(ledgerCoreCode.includes('FINANCE & OPERATIONS'), 'ledgerCore.js must define FINANCE & OPERATIONS navigation group');
assert(ledgerCoreCode.includes('Orders & Fulfillment'), 'ledgerCore.js must contain Orders & Fulfillment item');
assert(ledgerCoreCode.includes('Enquiries & Quotes'), 'ledgerCore.js must contain Enquiries & Quotes item');
assert(ledgerCoreCode.includes('Customers'), 'ledgerCore.js must contain Customers item');
assert(ledgerCoreCode.includes('Financial Reports'), 'ledgerCore.js must contain Financial Reports item');

// 3. Verify allowedTabs includes orders, enquiries, customers, reports
const allowedTabsMatch = ledgerCoreCode.match(/const allowedTabs = \[([\s\S]*?)\];/);
assert(allowedTabsMatch, 'ledgerCore.js must declare const allowedTabs');
const allowedTabsContent = allowedTabsMatch[1];
['orders', 'enquiries', 'customers', 'reports'].forEach(tabKey => {
  assert(allowedTabsContent.includes(`"${tabKey}"`) || allowedTabsContent.includes(`'${tabKey}'`), `allowedTabs must include ${tabKey}`);
});

// 4. Verify PrintStudioLedger.tsx switcher button text
assert(printStudioLedgerCode.includes('Switch to Website Management'), 'PrintStudioLedger.tsx must have button text "Switch to Website Management"');
assert(!printStudioLedgerCode.includes('Switch to Business'), 'PrintStudioLedger.tsx must NOT have outdated "Switch to Business"');

console.log('All Bambu Production navigation assertions passed! ✅');
