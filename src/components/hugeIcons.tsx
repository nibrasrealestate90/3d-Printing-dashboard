import React from "react";
import {
  Layers01Icon,
  ArrowLeft01Icon,
  Refresh01Icon,
  Delete02Icon,
  Menu01Icon,
  Moon02Icon,
  Sun03Icon,
  DashboardSquare01Icon,
  Invoice01Icon,
  PackageIcon,
  DiscIcon,
  Calculator01Icon,
  PrinterIcon,
  Coins01Icon,
  Analytics01Icon,
  Settings01Icon,
  Search01Icon,
  TrendingUpIcon,
  Clock01Icon,
  GiftIcon,
  CreditCardIcon,
  AlertCircleIcon,
  Activity01Icon,
  CheckmarkCircle02Icon,
  Add01Icon,
  Pdf02Icon,
  Table01Icon,
  FloppyDiskIcon,
  Download04Icon,
  Edit01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";

export type HugeIconData = readonly (readonly [string, { readonly [key: string]: any }])[];

/**
 * React Component for rendering HugeIcons in JSX
 */
export function HugeIcon({
  icon,
  size = 20,
  strokeWidth = 1.8,
  color,
  className,
  id,
  style,
}: {
  icon: HugeIconData;
  size?: number | string;
  strokeWidth?: number | string;
  color?: string;
  className?: string;
  id?: string;
  style?: React.CSSProperties;
}) {
  if (!icon || !Array.isArray(icon)) return null;
  const computedStyle: React.CSSProperties = color ? { color, ...style } : (style || {});
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      className={className}
      id={id}
      style={computedStyle}
    >
      {icon.map(([Tag, attrs], i) => {
        const TagName = Tag as any;
        const { key: attrKey, ...restAttrs } = (attrs || {}) as any;
        return <TagName key={attrKey ?? i} {...restAttrs} />;
      })}
    </svg>
  );
}

function toKebab(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Creates an icon callable function whose .toString() also renders the SVG,
 * preventing accidental function stringification in template literals.
 */
function iconFn(icon: HugeIconData, defaultSize = 18, defaultSw = 2) {
  const fn = (size = defaultSize, sw = defaultSw) => hugeSvg(icon, size, sw);
  fn.toString = () => hugeSvg(icon, defaultSize, defaultSw);
  return fn;
}

/**
 * Generates an SVG string from HugeIcons data for use in HTML template literals
 */
export function hugeSvg(
  icon: HugeIconData,
  size: number | string = 20,
  strokeWidth: number | string = 1.8,
  extraClass: string = "",
  extraAttrs: string = ""
): string {
  if (!icon || !Array.isArray(icon)) return "";
  const children = icon
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => {
          if (k === "key") return "";
          return `${toKebab(k)}="${v}"`;
        })
        .filter(Boolean)
        .join(" ");
      return `<${tag} ${attrStr} />`;
    })
    .join("");
  const cls = extraClass ? ` class="${extraClass}"` : "";
  const extra = extraAttrs ? ` ${extraAttrs}` : "";
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}"${cls}${extra}>${children}</svg>`;
}

export {
  Layers01Icon,
  ArrowLeft01Icon,
  Refresh01Icon,
  Delete02Icon,
  Menu01Icon,
  Moon02Icon,
  Sun03Icon,
  DashboardSquare01Icon,
  Invoice01Icon,
  PackageIcon,
  DiscIcon,
  Calculator01Icon,
  PrinterIcon,
  Coins01Icon,
  Analytics01Icon,
  Settings01Icon,
  Search01Icon,
  TrendingUpIcon,
  Clock01Icon,
  GiftIcon,
  CreditCardIcon,
  AlertCircleIcon,
  Activity01Icon,
  CheckmarkCircle02Icon,
};

export const APP_ICONS = {
  // Brand & Sidebar
  brand: (size = 22, sw = 2.2) => hugeSvg(Layers01Icon, size, sw),
  collapse: (size = 16, sw = 2) => hugeSvg(ArrowLeft01Icon, size, sw),
  reset: (size = 16, sw = 2) => hugeSvg(Refresh01Icon, size, sw),
  delete: (size = 16, sw = 2) => hugeSvg(Delete02Icon, size, sw),
  menu: (size = 20, sw = 2.2) => hugeSvg(Menu01Icon, size, sw),
  moon: (size = 18, sw = 2) => hugeSvg(Moon02Icon, size, sw, "", 'id="moonIcon"'),
  sun: (size = 18, sw = 2) => hugeSvg(Sun03Icon, size, sw, "", 'id="sunIcon" style="display:none"'),

  // Navigation Tabs (Consistent Lucide Standard)
  navDashboard: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>`,
  navProducts: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`,
  navFilaments: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
  navStock: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>`,
  navPrints: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/></svg>`,
  navCalc: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>`,
  navCustomers: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  navOrders: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
  navKyc: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
  navQuotes: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
  navInvoices: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  navExpenses: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M14 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/></svg>`,
  navReports: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
  navReminders: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  navAutomation: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
  navAccounts: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  navSettings: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`,

  // Search
  search: hugeSvg(Search01Icon, 16, 2, "search-icon"),

  // Metric Cards
  metricProducts: iconFn(Layers01Icon, 20, 1.8),
  metricStock: iconFn(PackageIcon, 20, 1.8),
  metricPrinted: iconFn(PrinterIcon, 20, 1.8),
  metricFilament: iconFn(DiscIcon, 20, 1.8),
  metricTime: iconFn(Clock01Icon, 20, 1.8),
  metricSales: iconFn(Coins01Icon, 20, 1.8),
  metricProfit: iconFn(TrendingUpIcon, 20, 1.8),
  metricCollect: iconFn(Clock01Icon, 20, 1.8),
  metricFoc: iconFn(GiftIcon, 20, 1.8),
  metricExpenses: iconFn(CreditCardIcon, 20, 1.8),

  // Calculator
  calcHeader: hugeSvg(Calculator01Icon, 20, 2),
  calcBatch: hugeSvg(PrinterIcon, 16, 2),

  // Dashboard Grid Panels
  bestSellers: iconFn(TrendingUpIcon, 18, 2),
  lowestMovers: iconFn(Clock01Icon, 18, 2),
  attentionAlert: iconFn(AlertCircleIcon, 18, 2),
  recentActivity: iconFn(Activity01Icon, 18, 2),
  checkSuccess: iconFn(CheckmarkCircle02Icon, 18, 2),

  // Activity & Attention Specific
  feedPrint: iconFn(PrinterIcon, 14, 2),
  feedSale: iconFn(Invoice01Icon, 14, 2),
  feedOffer: iconFn(Coins01Icon, 14, 2),
  feedFoc: iconFn(GiftIcon, 14, 2),
  feedAlert: iconFn(AlertCircleIcon, 14, 2),
  feedPackage: iconFn(PackageIcon, 14, 2),
  feedSpool: iconFn(DiscIcon, 14, 2),

  // Action Buttons (Topbar & Modals)
  btnExcel: iconFn(Table01Icon, 15, 2),
  btnPdf: iconFn(Pdf02Icon, 15, 2),
  btnAdd: iconFn(Add01Icon, 15, 2.2),
  btnSave: iconFn(FloppyDiskIcon, 15, 2),
  btnDownload: iconFn(Download04Icon, 15, 2),
  btnView: iconFn(ViewIcon, 14, 2),
  btnEdit: iconFn(Edit01Icon, 14, 2),
  btnDelete: iconFn(Delete02Icon, 14, 2),
};
