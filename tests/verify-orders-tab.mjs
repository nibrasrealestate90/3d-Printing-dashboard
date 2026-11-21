import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('=== Verifying Orders & Fulfillment Tab Implementation ===');

const projectRoot = process.cwd();
const ledgerCorePath = path.join(projectRoot, 'src/components/ledgerCore.js');
const ledgerCoreCode = fs.readFileSync(ledgerCorePath, 'utf8');

// 1. Verify that 'orders' tab routes to vOrders, not vRedirectModule
assert(
  ledgerCoreCode.includes('orders: vOrders') || ledgerCoreCode.includes('orders: renderOrdersTab'),
  'ledgerCore.js fn dictionary must map "orders" to vOrders or renderOrdersTab'
);
assert(
  !ledgerCoreCode.includes('orders: () => vRedirectModule'),
  'ledgerCore.js must NOT redirect orders to Business Suite'
);

// 2. Verify KPI cards exist in vOrders
assert(ledgerCoreCode.includes('TOTAL ORDERS') || ledgerCoreCode.includes('Total Orders'), 'vOrders must calculate and display Total Orders KPI');
assert(ledgerCoreCode.includes('IN PRODUCTION') || ledgerCoreCode.includes('In Production'), 'vOrders must calculate and display In Production KPI');
assert(ledgerCoreCode.includes('READY FOR') || ledgerCoreCode.includes('Ready for'), 'vOrders must calculate and display Ready KPI');
assert(ledgerCoreCode.includes('TOTAL BILLED') || ledgerCoreCode.includes('Total Revenue') || ledgerCoreCode.includes('GROSS VALUE'), 'vOrders must display billed revenue in AED');

// 3. Verify fulfillment status options and updates
['IN_PRODUCTION', 'READY', 'DELIVERED'].forEach(status => {
  assert(ledgerCoreCode.includes(status), `vOrders must support fulfillment status: ${status}`);
});

// 4. Verify API communication for updating order status
assert(
  ledgerCoreCode.includes('/api/admin/orders'),
  'ledgerCore.js must interact with /api/admin/orders for order management and fulfillment'
);

console.log('All Orders & Fulfillment assertions passed! ✅');
