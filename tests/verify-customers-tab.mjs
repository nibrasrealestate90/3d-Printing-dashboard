import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('=== Verifying Customer Directory Tab Implementation ===');

const projectRoot = process.cwd();
const ledgerCorePath = path.join(projectRoot, 'src/components/ledgerCore.js');
const ledgerCoreCode = fs.readFileSync(ledgerCorePath, 'utf8');

// 1. Verify fn dictionary maps customers to vCustomers
assert(
  ledgerCoreCode.includes('customers: vCustomers') || ledgerCoreCode.includes('customers: renderCustomersTab'),
  'ledgerCore.js fn dictionary must map "customers" to vCustomers or renderCustomersTab'
);
assert(
  !ledgerCoreCode.includes('customers: () => vRedirectModule'),
  'ledgerCore.js must NOT redirect customers to Business Suite'
);

// 2. Verify KPI cards exist for customers
assert(ledgerCoreCode.includes('TOTAL CLIENTS') || ledgerCoreCode.includes('Total Clients') || ledgerCoreCode.includes('TOTAL CUSTOMERS'), 'vCustomers must display Total Clients KPI');
assert(ledgerCoreCode.includes('REPEAT CLIENTS') || ledgerCoreCode.includes('Repeat Clients') || ledgerCoreCode.includes('REPEAT CUSTOMERS'), 'vCustomers must display Repeat Clients KPI');
assert(ledgerCoreCode.includes('CUMULATIVE') || ledgerCoreCode.includes('Cumulative'), 'vCustomers must display Cumulative Sales / Lifetime Value KPI');

// 3. Verify WhatsApp clickable link for customers
assert(
  ledgerCoreCode.includes('wa.me') || ledgerCoreCode.includes('api.whatsapp.com'),
  'vCustomers must provide WhatsApp direct link for customer communication'
);

// 4. Verify API communication for fetching customers
assert(
  ledgerCoreCode.includes('/api/admin/customers'),
  'ledgerCore.js must interact with /api/admin/customers for directory and order history'
);

console.log('All Customer Directory assertions passed! ✅');
