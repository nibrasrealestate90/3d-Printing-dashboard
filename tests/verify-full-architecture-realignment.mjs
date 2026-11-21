import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('=== Running Comprehensive Workspace Architecture Realignment Verification ===\n');

const projectRoot = process.cwd();

// Files to verify
const businessLayoutPath = path.join(projectRoot, 'src/components/admin/BusinessWorkspaceLayout.tsx');
const adminPagePath = path.join(projectRoot, 'src/app/admin/page.tsx');
const ledgerCorePath = path.join(projectRoot, 'src/components/ledgerCore.js');
const printStudioLedgerPath = path.join(projectRoot, 'src/components/PrintStudioLedger.tsx');
const proxyPath = path.join(projectRoot, 'src/proxy.ts');

const businessLayoutCode = fs.readFileSync(businessLayoutPath, 'utf8');
const adminPageCode = fs.readFileSync(adminPagePath, 'utf8');
const ledgerCoreCode = fs.readFileSync(ledgerCorePath, 'utf8');
const printStudioLedgerCode = fs.readFileSync(printStudioLedgerPath, 'utf8');
const proxyCode = fs.readFileSync(proxyPath, 'utf8');

console.log('1. Checking Commercial Dashboard / Admin Scope...');
assert(businessLayoutCode.includes('Website Management'), 'Commercial branding must be Website Management');
assert(!businessLayoutCode.includes('/admin/orders'), 'Commercial sidebar must NOT include /admin/orders');
assert(!businessLayoutCode.includes('/admin/enquiries'), 'Commercial sidebar must NOT include /admin/enquiries');
assert(!businessLayoutCode.includes('/admin/customers'), 'Commercial sidebar must NOT include /admin/customers');
assert(!businessLayoutCode.includes('/admin/reports'), 'Commercial sidebar must NOT include /admin/reports');
assert(businessLayoutCode.includes('Switch to Bambu Production'), 'Commercial switcher must link to Bambu Production');
console.log('   ✓ Commercial Dashboard strictly restricted to Website Management');

console.log('\n2. Checking Commercial Overview KPIs...');
assert(adminPageCode.includes('Published Products'), 'Overview must show Published Products');
assert(adminPageCode.includes('Store Categories'), 'Overview must show Store Categories');
assert(adminPageCode.includes('Media Assets'), 'Overview must show Media Assets');
assert(adminPageCode.includes('Storefront Status') || adminPageCode.includes('Website Status'), 'Overview must show Storefront Status');
assert(!adminPageCode.includes('Total Orders'), 'Overview must NOT show Total Orders');
assert(!adminPageCode.includes('Total Revenue'), 'Overview must NOT show Total Revenue');
console.log('   ✓ Commercial Overview focuses entirely on storefront metrics');

console.log('\n3. Checking Bambu Production Navigation...');
assert(ledgerCoreCode.includes('COMMERCE & FULFILLMENT'), 'Bambu nav must include COMMERCE & FULFILLMENT group');
assert(ledgerCoreCode.includes('FINANCE & OPERATIONS'), 'Bambu nav must include FINANCE & OPERATIONS group');
assert(ledgerCoreCode.includes('Orders & Fulfillment'), 'Bambu nav must include Orders & Fulfillment');
assert(ledgerCoreCode.includes('Enquiries & Quotes'), 'Bambu nav must include Enquiries & Quotes');
assert(ledgerCoreCode.includes('Customers'), 'Bambu nav must include Customers');
assert(ledgerCoreCode.includes('Financial Reports'), 'Bambu nav must include Financial Reports');
assert(printStudioLedgerCode.includes('Switch to Website Management'), 'Bambu switcher must say Switch to Website Management');
console.log('   ✓ Bambu Production App navigation successfully expanded');

console.log('\n4. Checking Native Orders, Enquiries, Customers & Reports in Bambu App...');
assert(ledgerCoreCode.includes('orders: vOrders'), 'Tab router must map orders to vOrders');
assert(ledgerCoreCode.includes('enquiries: vEnquiries'), 'Tab router must map enquiries to vEnquiries');
assert(ledgerCoreCode.includes('customers: vCustomers'), 'Tab router must map customers to vCustomers');
assert(ledgerCoreCode.includes('reports: vReports'), 'Tab router must map reports to vReports');
assert(ledgerCoreCode.includes('/api/admin/orders'), 'Orders must sync via /api/admin/orders');
assert(ledgerCoreCode.includes('/api/admin/enquiries'), 'Enquiries must sync via /api/admin/enquiries');
assert(ledgerCoreCode.includes('/api/admin/customers'), 'Customers must sync via /api/admin/customers');
assert(ledgerCoreCode.includes('OUTPUT VAT') || ledgerCoreCode.includes('5% UAE VAT'), 'Reports must display 5% UAE VAT');
assert(ledgerCoreCode.includes('NET SALES'), 'Reports must display Net Sales (excl. VAT)');
console.log('   ✓ All 4 modules natively integrated in Bambu Production App');

console.log('\n5. Checking Canonical Redirects...');
['orders', 'enquiries', 'customers', 'reports'].forEach(tab => {
  assert(proxyCode.includes(`/admin/${tab}`), `proxy.ts must handle redirect for /admin/${tab}`);
  const pagePath = path.join(projectRoot, `src/app/admin/${tab}/page.tsx`);
  assert(fs.existsSync(pagePath), `Admin page file must exist: ${pagePath}`);
  const code = fs.readFileSync(pagePath, 'utf8');
  assert(code.includes(`/?tab=${tab}`), `${pagePath} must redirect to /?tab=${tab}`);
});
console.log('   ✓ All legacy commercial and reporting URLs redirect to Bambu Production tabs');

console.log('\n🎉 ALL WORKSPACE ARCHITECTURE REALIGNMENT ASSERTIONS PASSED! 🎉');
