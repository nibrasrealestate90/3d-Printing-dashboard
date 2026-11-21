import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('=== Verifying Enquiries & Quotes Tab Implementation ===');

const projectRoot = process.cwd();
const ledgerCorePath = path.join(projectRoot, 'src/components/ledgerCore.js');
const ledgerCoreCode = fs.readFileSync(ledgerCorePath, 'utf8');

// 1. Verify fn dictionary maps enquiries to vEnquiries
assert(
  ledgerCoreCode.includes('enquiries: vEnquiries') || ledgerCoreCode.includes('enquiries: renderEnquiriesTab'),
  'ledgerCore.js fn dictionary must map "enquiries" to vEnquiries or renderEnquiriesTab'
);
assert(
  !ledgerCoreCode.includes('enquiries: () => vRedirectModule'),
  'ledgerCore.js must NOT redirect enquiries to Business Suite'
);

// 2. Verify KPI cards exist for enquiries
assert(ledgerCoreCode.includes('NEW REQUESTS') || ledgerCoreCode.includes('New Requests') || ledgerCoreCode.includes('New Enquiries'), 'vEnquiries must display New Requests KPI');
assert(ledgerCoreCode.includes('IN REVIEW') || ledgerCoreCode.includes('In Review'), 'vEnquiries must display In Review KPI');
assert(ledgerCoreCode.includes('RESPONDED') || ledgerCoreCode.includes('Responded'), 'vEnquiries must display Responded KPI');

// 3. Verify WhatsApp direct link capability
assert(
  ledgerCoreCode.includes('wa.me') || ledgerCoreCode.includes('api.whatsapp.com'),
  'vEnquiries must provide direct WhatsApp link for customer contact'
);

// 4. Verify API communication for fetching or updating enquiries
assert(
  ledgerCoreCode.includes('/api/admin/enquiries'),
  'ledgerCore.js must interact with /api/admin/enquiries for customer requests & quotes'
);

console.log('All Enquiries & Quotes assertions passed! ✅');
