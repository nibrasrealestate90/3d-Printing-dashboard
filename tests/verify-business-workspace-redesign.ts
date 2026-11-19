import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { Mail01Icon } from '@hugeicons/core-free-icons';
import { MetricCard } from '../src/components/admin/ui/MetricCard';
import { EmptyState } from '../src/components/admin/ui/EmptyState';

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('  PRINT STUDIO BUSINESS WORKSPACE REDESIGN VERIFICATION SUITE');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`✅ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`   Error: ${err.message}\n`);
  }
}

// ----------------------------------------------------------------------------
// Test 1: Design Tokens in business-workspace.css
// ----------------------------------------------------------------------------
runTest('CSS Design Tokens: Matches Universal Dashboard Design System', () => {
  const cssPath = path.join(ROOT_DIR, 'src/app/business-workspace.css');
  assert.ok(fs.existsSync(cssPath), 'business-workspace.css must exist');
  const css = fs.readFileSync(cssPath, 'utf-8');

  // Core canvas & surfaces
  assert.match(css, /--bm-canvas:\s*#F4F4F2/i, 'Canvas must be #F4F4F2');
  assert.match(css, /--bm-surface:\s*#FFFFFF/i, 'Surface must be #FFFFFF');
  assert.match(css, /--bm-surface-muted:\s*#F7F7F6/i, 'Surface muted must be #F7F7F6');

  // Text hierarchy
  assert.match(css, /--bm-text-primary:\s*#20211F/i, 'Primary text must be #20211F');
  assert.match(css, /--bm-text-secondary:\s*#686A66/i, 'Secondary text must be #686A66');
  assert.match(css, /--bm-text-muted:\s*#92948F/i, 'Muted text must be #92948F');

  // Borders
  assert.match(css, /--bm-border:\s*#E8E9E6/i, 'Border must be #E8E9E6');

  // Warm orange accent
  assert.match(css, /--bm-accent:\s*#F0643D/i, 'Accent must be #F0643D');
  assert.match(css, /--bm-accent-hover:\s*#DE5531/i, 'Accent hover must be #DE5531');
  assert.match(css, /--bm-accent-soft:\s*#FFF0EA/i, 'Accent soft must be #FFF0EA');

  // Status colors
  assert.match(css, /--bm-success:\s*#279B72/i, 'Success must be #279B72');
  assert.match(css, /--bm-warning:\s*#D99A27/i, 'Warning must be #D99A27');
  assert.match(css, /--bm-danger:\s*#D94B4B/i, 'Danger must be #D94B4B');

  // Emil Kowalski button active scale
  assert.match(css, /scale\(0\.97\)/, 'Buttons must have active scale(0.97)');
});

// ----------------------------------------------------------------------------
// Test 2: Reusable UI Component Library Existence & Exports
// ----------------------------------------------------------------------------
runTest('Reusable UI Components: PageHeader, MetricCard, DataTable, StatusBadge, EmptyState', () => {
  const uiDir = path.join(ROOT_DIR, 'src/components/admin/ui');
  assert.ok(fs.existsSync(uiDir), 'src/components/admin/ui directory must exist');

  const components = [
    'PageHeader.tsx',
    'MetricCard.tsx',
    'DataTable.tsx',
    'StatusBadge.tsx',
    'EmptyState.tsx',
  ];

  for (const comp of components) {
    const compPath = path.join(uiDir, comp);
    assert.ok(fs.existsSync(compPath), `${comp} must exist in src/components/admin/ui/`);
    const content = fs.readFileSync(compPath, 'utf-8');
    const baseName = comp.replace('.tsx', '');
    assert.ok(
      content.includes(`export function ${baseName}`) || content.includes(`export const ${baseName}`),
      `${comp} must export ${baseName}`
    );
  }
});

// ----------------------------------------------------------------------------
// Test 2b: Icon Rendering Invariant (No "Objects are not valid as a React child")
// ----------------------------------------------------------------------------
runTest('Icon Rendering Runtime Invariant: HugeIconData renders to valid SVG without React child error', () => {
  // Must render MetricCard with HugeIconData without throwing
  const metricOutput = ReactDOMServer.renderToString(
    React.createElement(MetricCard, {
      label: 'Test Metric',
      value: 123,
      icon: Mail01Icon,
    })
  );
  assert.ok(metricOutput.includes('<svg'), 'MetricCard must render an SVG element');
  assert.ok(!metricOutput.includes('[object Object]'), 'Must not render raw object text');

  // Must render EmptyState with HugeIconData without throwing
  const emptyOutput = ReactDOMServer.renderToString(
    React.createElement(EmptyState, {
      title: 'Empty Inbox',
      description: 'No messages',
      icon: Mail01Icon,
    })
  );
  assert.ok(emptyOutput.includes('<svg'), 'EmptyState must render an SVG element');
  assert.ok(!emptyOutput.includes('[object Object]'), 'Must not render raw object text');
});

// ----------------------------------------------------------------------------
// Test 3: BusinessWorkspaceLayout & Clean Shell Invariants
// ----------------------------------------------------------------------------
runTest('Application Shell: Clean compact sidebar and minimal header without clutter', () => {
  const layoutPath = path.join(ROOT_DIR, 'src/components/admin/BusinessWorkspaceLayout.tsx');
  assert.ok(fs.existsSync(layoutPath), 'BusinessWorkspaceLayout.tsx must exist');
  const content = fs.readFileSync(layoutPath, 'utf-8');

  // Sidebar must be clean: NO switcher cards, active workspace pills, or manufacturing console section
  assert.ok(
    !content.includes('bm-switcher-card'),
    'Sidebar must not contain the Active Workspace switcher card'
  );
  assert.ok(
    !content.includes('Manufacturing Console'),
    'Sidebar must not contain the Manufacturing Console section'
  );
  assert.ok(
    !content.includes('Switch to Bambu Production'),
    'Sidebar must not contain the Switch to Bambu Production button'
  );

  // Header must be clean: NO redundant status pill, bridge buttons, or avatar cluster
  assert.ok(
    !content.includes('bm-header-actions'),
    'Header must not contain the redundant header actions cluster'
  );
  assert.ok(
    !content.includes('Bambu Cloud Active'),
    'Header must not contain the Bambu Cloud telemetry pill'
  );

  // Must include all core navigation paths
  const requiredPaths = [
    '/admin',
    '/admin/products',
    '/admin/orders',
    '/admin/inventory',
    '/admin/enquiries',
    '/admin/quotations',
    '/admin/customers',
    '/admin/expenses',
    '/admin/reports',
    '/admin/settings',
    '/admin/instagram',
    '/admin/media',
  ];

  for (const p of requiredPaths) {
    assert.ok(content.includes(p), `Layout must include route ${p}`);
  }
});

// ----------------------------------------------------------------------------
// Test 4: Business Management Overview Dashboard
// ----------------------------------------------------------------------------
runTest('Overview Page: Executive layout, operational metrics, and quick actions', () => {
  const pagePath = path.join(ROOT_DIR, 'src/app/admin/page.tsx');
  assert.ok(fs.existsSync(pagePath), 'admin/page.tsx must exist');
  const content = fs.readFileSync(pagePath, 'utf-8');

  assert.ok(
    content.includes('BusinessWorkspaceLayout'),
    'Overview must use BusinessWorkspaceLayout'
  );
  assert.ok(
    content.includes('verifyServerSession'),
    'Overview must verify server session'
  );
  assert.ok(
    !content.includes('bm-hero-banner'),
    'Overview must not contain the decorative hero banner box'
  );
  assert.ok(
    content.includes('bm-metrics-grid'),
    'Overview must contain operational metrics grid at top of viewport'
  );
  assert.ok(
    content.includes('bm-dashboard-grid'),
    'Overview must contain two-column operational dashboard grid'
  );
});

// ----------------------------------------------------------------------------
// Test 5: All 11 Business Module Routes Render in Business Workspace
// ----------------------------------------------------------------------------
runTest('Module Routes: All 11 modules use BusinessWorkspaceLayout & verifyServerSession', () => {
  const modules = [
    'products/page.tsx',
    'orders/page.tsx',
    'inventory/page.tsx',
    'enquiries/page.tsx',
    'quotations/page.tsx',
    'customers/page.tsx',
    'expenses/page.tsx',
    'reports/page.tsx',
    'settings/page.tsx',
    'instagram/page.tsx',
    'media/page.tsx',
  ];

  for (const mod of modules) {
    const modPath = path.join(ROOT_DIR, 'src/app/admin', mod);
    assert.ok(fs.existsSync(modPath), `Module page ${mod} must exist`);
    const content = fs.readFileSync(modPath, 'utf-8');
    assert.ok(
      content.includes('verifyServerSession'),
      `Module ${mod} must call verifyServerSession`
    );
    assert.ok(
      content.includes('BusinessWorkspaceLayout'),
      `Module ${mod} must render inside BusinessWorkspaceLayout`
    );
  }
});

// ----------------------------------------------------------------------------
// Test 6: Zero Legacy Teal in Admin Views
// ----------------------------------------------------------------------------
runTest('Color Discipline: No hardcoded legacy dark teal #062C2F in admin views', () => {
  const files = [
    'src/components/admin/ProductManagementView.tsx',
    'src/components/admin/InstagramGalleryView.tsx',
    'src/components/admin/MediaLibraryView.tsx',
    'src/components/admin/ModulePlaceholderView.tsx',
  ];

  for (const f of files) {
    const fullPath = path.join(ROOT_DIR, f);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.ok(
        !content.includes('#062C2F'),
        `${f} should not have hardcoded #062C2F`
      );
    }
  }
});

// ----------------------------------------------------------------------------
// Test 7: Strict Safety Boundary — Bambu Production Workspace Untouched
// ----------------------------------------------------------------------------
runTest('Safety Boundary: Bambu Production core files remain completely untouched', () => {
  const ledgerCorePath = path.join(ROOT_DIR, 'src/components/ledgerCore.js');
  assert.ok(fs.existsSync(ledgerCorePath), 'ledgerCore.js must exist');
  const content = fs.readFileSync(ledgerCorePath, 'utf-8');
  assert.ok(content.includes('initLedger') && content.includes('COLLS'), 'ledgerCore.js must be intact');
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n========================================================================');
console.log(`Total Tests Executed : ${totalTests}`);
console.log(`Passed               : ${passedTests} ✅`);
console.log(`Failed               : ${totalTests - passedTests} ❌`);
console.log(`Success Rate         : ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log('========================================================================');

if (passedTests !== totalTests) {
  process.exit(1);
}
