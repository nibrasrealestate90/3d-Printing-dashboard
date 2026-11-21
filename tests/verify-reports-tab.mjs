import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('=== Verifying Financial & Sales Reports Tab Implementation ===');

const projectRoot = process.cwd();
const ledgerCorePath = path.join(projectRoot, 'src/components/ledgerCore.js');
const ledgerCoreCode = fs.readFileSync(ledgerCorePath, 'utf8');

// 1. Verify fn dictionary maps reports to vReports
assert(
  ledgerCoreCode.includes('reports: vReports') || ledgerCoreCode.includes('reports: renderReportsTab'),
  'ledgerCore.js fn dictionary must map "reports" to vReports or renderReportsTab'
);
assert(
  !ledgerCoreCode.includes('reports: () => vRedirectModule'),
  'ledgerCore.js must NOT redirect reports to Business Suite'
);

// 2. Verify KPI cards exist for financial metrics
assert(
  ledgerCoreCode.includes('GROSS BILLED') || ledgerCoreCode.includes('Gross Sales') || ledgerCoreCode.includes('GROSS SALES'),
  'vReports must display Gross Billed / Gross Sales KPI'
);
assert(
  ledgerCoreCode.includes('NET SALES') || ledgerCoreCode.includes('Net Sales'),
  'vReports must display Net Sales (excl. VAT) KPI'
);
assert(
  ledgerCoreCode.includes('OUTPUT VAT') || ledgerCoreCode.includes('5% VAT') || ledgerCoreCode.includes('5% UAE VAT'),
  'vReports must display 5% UAE VAT KPI'
);

// 3. Verify Invoice Breakdown table with UAE VAT
assert(ledgerCoreCode.includes('VAT (5%)') || ledgerCoreCode.includes('5% VAT'), 'vReports invoice table or summary must display 5% UAE VAT breakdown');
assert(ledgerCoreCode.includes('xlsAll') || ledgerCoreCode.includes('exportXlsx'), 'vReports must support Excel export');
assert(ledgerCoreCode.includes('pdfReport') || ledgerCoreCode.includes('reportPdf'), 'vReports must support PDF report export');

console.log('All Financial Reports assertions passed! ✅');
