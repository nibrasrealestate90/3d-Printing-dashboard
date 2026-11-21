// @ts-nocheck
import { APP_ICONS } from "./hugeIcons";
import { STUDIO_LOGO_BASE64 } from "./studioLogoAsset";
import { renderFilamentSpool, EXACT_FILAMENT_COLORS } from "./FilamentSpool";
import { mountExpenses, unmountExpenses } from "./expenses/mountExpenses";

/* ==========================================================================
   TASK 3 — EXPENSE DATA STATE, DATE FILTERING & KPI ENGINE
   ========================================================================== */

export const MAX_EXPENSE_AMOUNT = 10_000_000.00;

export const DEFAULT_EXPENSE_CATEGORY_DEFINITIONS = [
  { id: "cat_default_filament_materials", name: "Filament & Materials", order: 1, isDefault: true },
  { id: "cat_default_electricity_utilities", name: "Electricity & Utilities", order: 2, isDefault: true },
  { id: "cat_default_printer_maintenance_repairs", name: "Printer Maintenance & Repairs", order: 3, isDefault: true },
  { id: "cat_default_spare_parts_accessories", name: "Spare Parts & Accessories", order: 4, isDefault: true },
  { id: "cat_default_packaging_delivery", name: "Packaging & Delivery", order: 5, isDefault: true },
  { id: "cat_default_marketing_advertising", name: "Marketing & Advertising", order: 6, isDefault: true },
  { id: "cat_default_software_subscriptions", name: "Software & Subscriptions", order: 7, isDefault: true },
  { id: "cat_default_rent_workspace", name: "Rent & Workspace", order: 8, isDefault: true },
  { id: "cat_default_transportation", name: "Transportation", order: 9, isDefault: true },
  { id: "cat_default_other_expenses", name: "Other Expenses", order: 10, isDefault: true }
];

export function getExpenseCategories(customCategories) {
  let source = customCategories;
  if (source === undefined) {
    if (typeof S !== "undefined" && Array.isArray(S.expense_categories)) {
      source = S.expense_categories;
    } else if (typeof window !== "undefined" && window.S && Array.isArray(window.S.expense_categories)) {
      source = window.S.expense_categories;
    }
  }
  if (Array.isArray(source) && source.length > 0) {
    const valid = source.filter(c => c && typeof c === "object" && typeof c.name === "string" && c.name.trim().length > 0);
    if (valid.length > 0) {
      return valid;
    }
  }
  return DEFAULT_EXPENSE_CATEGORY_DEFINITIONS;
}

export function parseExpenseAmountToCents(raw) {
  if (raw === undefined || raw === null || raw === "") {
    return { valid: false, error: "Amount is required" };
  }

  const str = String(raw).trim();
  if (!str) {
    return { valid: false, error: "Amount is required" };
  }

  // Reject non-numeric format: digits, optional decimal point with digits
  if (!/^\d+(\.\d+)?$/.test(str)) {
    return { valid: false, error: "Amount must be a valid positive numeric monetary value" };
  }

  const parts = str.split(".");
  if (parts.length > 1 && parts[1].length > 2) {
    return {
      valid: false,
      error: "Amount cannot have more than two decimal places. Do not provide fractional cents."
    };
  }

  const wholeStr = parts[0].replace(/^0+/, "") || "0";
  const fracStr = (parts[1] || "").padEnd(2, "0").slice(0, 2);

  const cents = BigInt(wholeStr) * BigInt(100) + BigInt(fracStr);

  if (cents <= BigInt(0)) {
    return { valid: false, error: "Amount must be greater than zero" };
  }

  const maxCents = BigInt(10_000_000) * BigInt(100);
  if (cents > maxCents) {
    return {
      valid: false,
      error: "Amount cannot exceed the maximum supported limit of 10,000,000.00 AED"
    };
  }

  const amount = Number(cents) / 100;
  const formatted = `${wholeStr}.${fracStr}`;

  return {
    valid: true,
    cents,
    amount,
    formatted
  };
}

export function expenseCentsToAmount(cents) {
  if (cents === undefined || cents === null) return 0;
  try {
    const b = typeof cents === "bigint" ? cents : BigInt(Math.round(Number(cents) || 0));
    return Number(b) / 100;
  } catch (_) {
    return 0;
  }
}

export function formatExpenseAED(centsOrAmount, isCents = false) {
  let amt = 0;
  if (isCents) {
    amt = expenseCentsToAmount(centsOrAmount);
  } else {
    amt = typeof centsOrAmount === "number" ? centsOrAmount : Number(centsOrAmount) || 0;
  }
  return `AED ${amt.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseYMD(dateStrOrObj) {
  if (!dateStrOrObj) return null;
  if (dateStrOrObj instanceof Date) {
    if (isNaN(dateStrOrObj.getTime())) return null;
    const y = dateStrOrObj.getFullYear();
    const m = String(dateStrOrObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateStrOrObj.getDate()).padStart(2, "0");
    return { year: y, month: dateStrOrObj.getMonth() + 1, day: dateStrOrObj.getDate(), str: `${y}-${m}-${d}` };
  }
  const str = String(dateStrOrObj).trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return null;

  return { year, month, day, str };
}

function formatYMD(year, month, day) {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDays(ymd, deltaDays) {
  const d = new Date(ymd.year, ymd.month - 1, ymd.day, 12, 0, 0);
  d.setDate(d.getDate() + deltaDays);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    str: formatYMD(d.getFullYear(), d.getMonth() + 1, d.getDate())
  };
}

export function getStartEndForPeriod(range = "30d", customStart = "", customEnd = "", referenceDate = null) {
  const ref = parseYMD(referenceDate) || parseYMD(new Date());

  switch (range) {
    case "today": {
      return {
        startDate: ref.str,
        endDate: ref.str,
        isValid: true
      };
    }

    case "7d": {
      const start = shiftDays(ref, -6);
      return {
        startDate: start.str,
        endDate: ref.str,
        isValid: true
      };
    }

    case "30d": {
      const start = shiftDays(ref, -29);
      return {
        startDate: start.str,
        endDate: ref.str,
        isValid: true
      };
    }

    case "this_month": {
      const startStr = formatYMD(ref.year, ref.month, 1);
      const lastDay = new Date(ref.year, ref.month, 0).getDate();
      const endStr = formatYMD(ref.year, ref.month, lastDay);
      return {
        startDate: startStr,
        endDate: endStr,
        isValid: true
      };
    }

    case "last_month": {
      const prevYear = ref.month === 1 ? ref.year - 1 : ref.year;
      const prevMonth = ref.month === 1 ? 12 : ref.month - 1;
      const lastDay = new Date(prevYear, prevMonth, 0).getDate();
      const startStr = formatYMD(prevYear, prevMonth, 1);
      const endStr = formatYMD(prevYear, prevMonth, lastDay);
      return {
        startDate: startStr,
        endDate: endStr,
        isValid: true
      };
    }

    case "custom": {
      const startParsed = parseYMD(customStart);
      const endParsed = parseYMD(customEnd);
      if (!startParsed || !endParsed) {
        return { startDate: customStart || "", endDate: customEnd || "", isValid: false };
      }
      if (startParsed.str > endParsed.str) {
        return { startDate: startParsed.str, endDate: endParsed.str, isValid: false };
      }
      return {
        startDate: startParsed.str,
        endDate: endParsed.str,
        isValid: true
      };
    }

    case "all":
    default: {
      return {
        startDate: "",
        endDate: "9999-12-31",
        isValid: true
      };
    }
  }
}

export function isDateInPeriod(expenseDate, startDate, endDate) {
  const parsed = parseYMD(expenseDate);
  if (!parsed) return false;
  if (startDate && parsed.str < startDate) return false;
  if (endDate && parsed.str > endDate) return false;
  return true;
}

export function getFilteredExpenses(expensesList, options = {}) {
  const source = Array.isArray(expensesList)
    ? expensesList
    : (typeof S !== "undefined" && Array.isArray(S.expenses) ? S.expenses : []);
  if (!Array.isArray(source) || source.length === 0) return [];

  const {
    range = "all",
    category = "all",
    search = "",
    customStart = "",
    customEnd = "",
    referenceDate = null
  } = options;

  const period = getStartEndForPeriod(range, customStart, customEnd, referenceDate);
  if (range === "custom" && !period.isValid) {
    return [];
  }

  const query = search ? String(search).trim().toLowerCase() : "";
  const catFilter = category && category !== "all" ? String(category).trim().toLowerCase() : "";

  return source.filter(e => {
    if (!e || typeof e !== "object") return false;

    // 1. Date filter
    const expDate = e.expenseDate || e.date;
    if (!isDateInPeriod(expDate, period.startDate, period.endDate)) {
      return false;
    }

    // 2. Category filter (matches by categoryId or category name, case-insensitive)
    if (catFilter) {
      const eCat = String(e.category || "").trim().toLowerCase();
      const eCatId = String(e.categoryId || "").trim().toLowerCase();
      const matchesName = eCat === catFilter;
      const matchesId = eCatId === catFilter;

      // Also check if catFilter matches default category ID -> name mapping
      const defaultMatch = DEFAULT_EXPENSE_CATEGORY_DEFINITIONS.find(
        d => d.id.toLowerCase() === catFilter || d.name.toLowerCase() === catFilter
      );
      const matchesDefaultName = defaultMatch && eCat === defaultMatch.name.toLowerCase();
      const matchesDefaultId = defaultMatch && eCatId === defaultMatch.id.toLowerCase();

      if (!matchesName && !matchesId && !matchesDefaultName && !matchesDefaultId) {
        return false;
      }
    }

    // 3. Search filter (title, vendor, description)
    if (query) {
      const title = String(e.title || "").toLowerCase();
      const vendor = String(e.vendor || "").toLowerCase();
      const desc = String(e.description || e.desc || e.notes || "").toLowerCase();

      if (!title.includes(query) && !vendor.includes(query) && !desc.includes(query)) {
        return false;
      }
    }

    return true;
  });
}

export function calculateExpenseKPIs(filteredExpenses = [], allExpenses = [], referenceDate = null) {
  const filtered = Array.isArray(filteredExpenses) ? filteredExpenses : [];
  const all = Array.isArray(allExpenses) ? allExpenses : (typeof S !== "undefined" && Array.isArray(S.expenses) ? S.expenses : filtered);

  let totalExpensesCents = BigInt(0);
  let transactionsCount = 0;
  const categoryCentsMap = new Map();

  for (const e of filtered) {
    if (!e || typeof e !== "object") continue;
    const parsed = parseExpenseAmountToCents(e.amount);
    if (!parsed.valid || parsed.cents === undefined) continue;

    totalExpensesCents += parsed.cents;
    transactionsCount++;

    const catName = String(e.category || "Other Expenses").trim() || "Other Expenses";
    const current = categoryCentsMap.get(catName) || BigInt(0);
    categoryCentsMap.set(catName, current + parsed.cents);
  }

  // Calculate current calendar month baseline (This Month's Expenses)
  const ref = parseYMD(referenceDate) || parseYMD(new Date());
  const currentMonthPrefix = `${ref.year}-${String(ref.month).padStart(2, "0")}`;
  let thisMonthCents = BigInt(0);
  let thisMonthFilteredCents = BigInt(0);

  for (const e of all) {
    if (!e || typeof e !== "object") continue;
    const expDate = String(e.expenseDate || e.date || "").slice(0, 10);
    if (expDate.startsWith(currentMonthPrefix)) {
      const parsed = parseExpenseAmountToCents(e.amount);
      if (parsed.valid && parsed.cents !== undefined) {
        thisMonthCents += parsed.cents;
      }
    }
  }

  for (const e of filtered) {
    if (!e || typeof e !== "object") continue;
    const expDate = String(e.expenseDate || e.date || "").slice(0, 10);
    if (expDate.startsWith(currentMonthPrefix)) {
      const parsed = parseExpenseAmountToCents(e.amount);
      if (parsed.valid && parsed.cents !== undefined) {
        thisMonthFilteredCents += parsed.cents;
      }
    }
  }

  // Find highest expense category
  let highestCategory = null;
  if (categoryCentsMap.size > 0) {
    let maxCents = BigInt(0);
    let bestCat = "";

    for (const [cat, cents] of categoryCentsMap.entries()) {
      if (cents > maxCents) {
        maxCents = cents;
        bestCat = cat;
      }
    }

    if (maxCents > BigInt(0)) {
      highestCategory = {
        name: bestCat,
        amount: expenseCentsToAmount(maxCents),
        cents: maxCents,
        formatted: formatExpenseAED(maxCents, true)
      };
    }
  }

  const totalAmount = expenseCentsToAmount(totalExpensesCents);
  const thisMonthAmount = expenseCentsToAmount(thisMonthCents);
  const thisMonthFilteredAmount = expenseCentsToAmount(thisMonthFilteredCents);

  return {
    totalExpenses: totalAmount,
    totalExpensesCents,
    totalExpensesFormatted: formatExpenseAED(totalExpensesCents, true),
    thisMonthExpenses: thisMonthAmount,
    thisMonthExpensesCents: thisMonthCents,
    thisMonthExpensesFormatted: formatExpenseAED(thisMonthCents, true),
    thisMonthFilteredExpenses: thisMonthFilteredAmount,
    thisMonthFilteredExpensesCents: thisMonthFilteredCents,
    thisMonthFilteredExpensesFormatted: formatExpenseAED(thisMonthFilteredCents, true),
    transactionsCount,
    highestCategory
  };
}

export function initLedger() {

"use strict";

const COLLS = ["filaments", "filament_stock", "products", "prints", "invoices", "expenses", "expense_categories"];
const S = { filaments: [], filament_stock: [], products: [], prints: [], invoices: [], expenses: [], expense_categories: [], settings: {} };

const DEF = {
  bizName: "Print Studio",
  phone: "",
  email: "",
  address: "",
  trn: "",
  currency: "AED",
  vatPct: 5,
  kw: 0.12,
  elecRate: 0.38,
  machineRate: 1.5,
  laborRate: 30,
  failPct: 8,
  agentMarkup: 60,
  directMarkup: 120,
  locations: "Shelf A, Shelf B, Display, Storage box 1, Agent stock",
  invoiceTerms: "Payment due within 7 days. Thank you for your business.",
  bambuToken: ""
};

let booted = false, db = null, dl = null, tab = "dashboard", period = "month", q = {}, chartRange = "30d";
let chartPrintTimeInstance = null, chartFilamentUsageInstance = null, chartMostInstance = null, chartLeastInstance = null;

const HOST = !!(window.claude && window.claude.use);
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const safeColor = v => /^#[0-9a-f]{3,8}$/i.test(String(v || "")) ? String(v) : "#999";
const photoSrc = v => { const s = String(v ?? ""); return /^(data:image\/|https?:\/\/|\/)/i.test(s) ? esc(s) : ""; };
const N = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const today = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const set_ = () => Object.assign({}, DEF, S.settings);
const cur = () => set_().currency || "AED";
const money = v => cur() + " " + N(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const m0 = v => N(v).toLocaleString("en-US", { maximumFractionDigits: 0 });
const m1 = v => N(v).toLocaleString("en-US", { maximumFractionDigits: 1 });
const byId = (c, id) => {
  const list = S[c];
  let item = list ? list.find(x => x.id === id) : undefined;
  if (!item && c === "filaments" && S.filament_stock) {
    item = S.filament_stock.find(x => x.id === id);
  } else if (!item && c === "filament_stock" && S.filaments) {
    item = S.filaments.find(x => x.id === id);
  }
  return item;
};

/* ==========================================================================
   Smart Pop-Up Notification Engine (Modern SaaS Standard)
   ========================================================================== */
function getToastContainer() {
  let c = document.getElementById("smartToastContainer");
  if (!c) {
    c = document.createElement("div");
    c.id = "smartToastContainer";
    c.className = "smart-toast-container";
    c.setAttribute("role", "region");
    c.setAttribute("aria-label", "Notifications");
    document.body.appendChild(c);
  }
  return c;
}

function notify(options) {
  if (!options) return;
  if (typeof options === "string") {
    const str = options;
    let type = "info";
    let title = "Notice";
    const low = str.toLowerCase();
    if (low.includes("delete") || low.includes("removed")) {
      type = "delete";
      title = "Deleted";
    } else if (low.includes("saved") || low.includes("added") || low.includes("created")) {
      type = "success";
      title = "Saved";
    } else if (low.includes("couldn't") || low.includes("error") || low.includes("failed") || low.includes("unavailable")) {
      type = "warn";
      title = "Notice";
    }
    options = { type, title, message: str };
  }

  const {
    type = "info",
    title = "Notice",
    message = "",
    duration = 3800,
    action = null
  } = options;

  const container = getToastContainer();

  const ICONS = {
    success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    delete: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`,
    info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    warn: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  const iconSvg = ICONS[type] || ICONS.info;

  const toastEl = document.createElement("div");
  toastEl.className = `smart-toast smart-toast--${type}`;
  toastEl.setAttribute("role", "status");

  toastEl.innerHTML = `
    <div class="smart-toast-icon">${iconSvg}</div>
    <div class="smart-toast-body">
      <div class="smart-toast-title">${title}</div>
      ${message ? `<div class="smart-toast-msg">${message}</div>` : ""}
    </div>
    ${action ? `<button type="button" class="smart-toast-action-btn">${action.label}</button>` : ""}
    <button type="button" class="smart-toast-close" aria-label="Dismiss notification">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    <div class="smart-toast-progress-track">
      <div class="smart-toast-progress-bar" style="animation-duration: ${duration}ms;"></div>
    </div>
  `;

  if (action && typeof action.onClick === "function") {
    const actBtn = toastEl.querySelector(".smart-toast-action-btn");
    if (actBtn) {
      actBtn.onclick = (e) => {
        e.stopPropagation();
        action.onClick();
        dismiss();
      };
    }
  }

  let isDismissing = false;
  let remainingTime = duration;
  let startTime = Date.now();
  let timerId = null;

  function dismiss() {
    if (isDismissing) return;
    isDismissing = true;
    if (timerId) clearTimeout(timerId);

    toastEl.classList.add("smart-toast-leaving");
    setTimeout(() => {
      toastEl.remove();
      if (container && container.children.length === 0) {
        container.remove();
      }
    }, 220);
  }

  function startTimer() {
    startTime = Date.now();
    timerId = setTimeout(dismiss, remainingTime);
  }

  function pauseTimer() {
    if (timerId) clearTimeout(timerId);
    remainingTime -= (Date.now() - startTime);
    if (remainingTime < 400) remainingTime = 400;
  }

  toastEl.addEventListener("mouseenter", pauseTimer);
  toastEl.addEventListener("mouseleave", startTimer);

  const closeBtn = toastEl.querySelector(".smart-toast-close");
  if (closeBtn) closeBtn.onclick = dismiss;

  while (container.children.length >= 4) {
    const oldest = container.firstElementChild;
    if (oldest) oldest.remove();
  }

  container.appendChild(toastEl);
  startTimer();

  return { dismiss };
}

function toast(t) {
  return notify(t);
}

if (typeof window !== "undefined") {
  window.notify = notify;
  window.toast = toast;
}

/* ---------- 3D Print Studio Clean Seed Data (Clean Production Mode) ---------- */
function getSampleRecords() {
  return {
    filaments: [],
    filament_stock: [],
    products: [],
    prints: [],
    invoices: [],
    expenses: []
  };
}

/* ---------- data layer & realtime sync ---------- */
let neonConnected = false;
let lastSyncVersion = "";
let syncPollingTimer = null;
const syncChannel = typeof window !== "undefined" && typeof window.BroadcastChannel !== "undefined" 
  ? new BroadcastChannel("psl_realtime_sync") 
  : null;

function setSyncNeon(status) {
  const dot = $("#syncDot");
  const txt = $("#syncTxt");
  if (!dot || !txt) return;
  if (status === "live" || status === true) {
    dot.className = "dot on";
    txt.textContent = "Synced with Neon Postgres";
  } else if (status === "syncing") {
    dot.className = "dot on";
    txt.textContent = "Syncing with Neon...";
  } else {
    dot.className = "dot off";
    txt.textContent = "Saved locally · Offline";
  }
}

// Listen to instant mutations across open tabs in same browser
if (syncChannel) {
  syncChannel.onmessage = e => {
    const msg = e.data;
    if (!msg || !msg.type) return;
    if (msg.type === "save" && msg.coll && msg.data) {
      const a = S[msg.coll];
      if (Array.isArray(a)) {
        const i = a.findIndex(x => x.id === msg.id);
        if (i >= 0) a[i] = msg.data; else a.push(msg.data);
        store.persist(msg.coll);
        render();
      }
    } else if (msg.type === "del" && msg.coll && msg.id) {
      const a = S[msg.coll];
      if (Array.isArray(a)) {
        const i = a.findIndex(x => x.id === msg.id);
        if (i >= 0) {
          a.splice(i, 1);
          store.persist(msg.coll);
          render();
        }
      }
    } else if (msg.type === "settings" && msg.data) {
      S.settings = msg.data;
      store.persist("settings");
      render();
    }
  };
}

async function save(coll, id, data) {
  data = Object.assign({}, data, { id, updatedAt: new Date().toISOString() });
  if (db) {
    try {
      await db.collection(coll).doc(id).set(data);
    } catch(e) {
      toast(e.code === "quota_exceeded" ? "Storage is full — delete old records to add new ones." : e.code === "invalid_argument" ? "You have view-only access, so changes can't be saved." : "Couldn't save — check your connection and try again.");
      throw e;
    }
    return "host";
  }
  const a = S[coll];
  const i = a.findIndex(x => x.id === id);
  if (i >= 0) a[i] = data; else a.push(data);
  if (HOST) { render(); return "host"; }
  const ok = store.persist(coll);

  // Broadcast instantly to sibling tabs
  if (syncChannel) {
    try { syncChannel.postMessage({ type: "save", coll, id, data }); } catch(_) {}
  }

  if (neonConnected) {
    setSyncNeon("syncing");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: coll, id, data })
    }).then(r => {
      if (r.ok) {
        setSyncNeon("live");
      } else {
        setSyncNeon(false);
      }
    }).catch(() => setSyncNeon(false));
  } else {
    setSyncNeon(false);
  }
  render();
  return ok ? "local" : "temp";
}

async function del(coll, id) {
  if (db) {
    try {
      await db.collection(coll).doc(id).delete();
      return "host";
    } catch(e) {
      toast("Couldn't delete — try again.");
      return "error";
    }
  }
  const a = S[coll], i = a.findIndex(x => x.id === id), dead = i >= 0 ? a.splice(i, 1)[0] : null;
  if (HOST) { render(); return "host"; }
  const ok = store.persist(coll);
  if (!ok) {
    if (dead) a.splice(i, 0, dead);
    render();
    return "failed";
  }

  // Broadcast instantly to sibling tabs
  if (syncChannel) {
    try { syncChannel.postMessage({ type: "del", coll, id }); } catch(_) {}
  }

  if (neonConnected) {
    setSyncNeon("syncing");
    fetch("/api/data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: coll, id })
    }).then(r => {
      if (r.ok) {
        setSyncNeon("live");
      } else {
        setSyncNeon(false);
      }
    }).catch(() => setSyncNeon(false));
  } else {
    setSyncNeon(false);
  }
  render();
  return "local";
}

async function saveSettings(data) {
  if (db) {
    try {
      await db.doc("meta/settings").set(data);
    } catch(e) {
      toast("Couldn't save settings.");
      throw e;
    }
    return "host";
  }
  S.settings = data;
  if (HOST) { render(); return "host"; }
  const ok = store.persist("settings");

  // Broadcast instantly to sibling tabs
  if (syncChannel) {
    try { syncChannel.postMessage({ type: "settings", data }); } catch(_) {}
  }

  if (neonConnected) {
    setSyncNeon("syncing");
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collection: "settings", id: "app-settings", data })
    }).then(r => {
      if (r.ok) {
        setSyncNeon("live");
      } else {
        setSyncNeon(false);
      }
    }).catch(() => setSyncNeon(false));
  } else {
    setSyncNeon(false);
  }
  render();
  return ok ? "local" : "temp";
}

/* ---------- standalone local storage (no host) ---------- */
const store = (() => {
  const P = "psl.v1.";
  let status = "ok";
  function probe() {
    try {
      localStorage.setItem(P + "probe", "1");
      localStorage.removeItem(P + "probe");
      return true;
    } catch(e) {
      return false;
    }
  }
  function load() {
    const corrupt = [];
    if (!probe()) { status = "unavailable"; return { corrupt }; }
    COLLS.forEach(k => {
      try {
        const raw = localStorage.getItem(P + k);
        if (!raw) return;
        const v = JSON.parse(raw);
        if (Array.isArray(v)) S[k] = v; else corrupt.push(k);
      } catch(e) { corrupt.push(k); }
    });
    try {
      const raw = localStorage.getItem(P + "settings");
      if (raw) {
        const v = JSON.parse(raw);
        if (v && typeof v === "object" && !Array.isArray(v)) S.settings = v; else corrupt.push("settings");
      }
    } catch(e) { corrupt.push("settings"); }
    return { corrupt };
  }
  function persist(key) {
    let val = "";
    if (key === "settings") {
      const cleanSettings = { ...(S.settings || {}) };
      delete cleanSettings.bambuToken;
      delete cleanSettings.hasBambuToken;
      val = JSON.stringify(cleanSettings);
    } else if (key === "products") {
      // Strip large Base64 photos when saving to localStorage to eliminate QuotaExceededError (5MB browser limit)
      const stripped = (S.products || []).map(p => {
        if (!p.photo) return p;
        const { photo, ...rest } = p;
        return rest;
      });
      val = JSON.stringify(stripped);
    } else {
      val = JSON.stringify(S[key] || []);
    }
    try {
      localStorage.setItem(P + key, val);
      if (status !== "ok") status = "ok";
      return true;
    } catch(e) {
      status = "degraded";
      return false;
    }
  }
  return { load, persist, ok: () => status === "ok" };
})();

/* ---------- derived numbers ---------- */
const BAMBU_COLOR_MAP = {
  "#C1C1C1": "Basic Gray",
  "#F98C36": "Orange",
  "#F95D73": "Coral Pink",
  "#A03CF7": "Purple",
  "#161616": "Basic Black",
  "#0ACC38": "Bambu Green",
  "#76D9F4": "Light Blue",
  "#46A8F9": "Sky Blue",
  "#FFFFFF": "Jade White",
  "#0A2989": "Dark Blue",
  "#000000": "Matte Black",
  "#0033CC": "Cobalt Blue"
};

function normalizeFilMat(m) {
  return String(m || "PLA").trim().toUpperCase();
}

function normalizeFilHex(c) {
  if (!c) return "#888888";
  let h = String(c).trim().toUpperCase();
  if (!h.startsWith("#")) h = "#" + h;
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h;
}

function filPurchasedStock(f) {
  if (!f) return { spools: 0, grams: 0, totalCost: 0, avgCostKg: 75, matchingSpools: [] };
  const fMat = normalizeFilMat(f.material);
  const fCol = normalizeFilHex(f.color);

  const matchingSpools = (S.filament_stock || []).filter(s => {
    if (s.filamentId && s.filamentId === f.id) return true;
    return normalizeFilMat(s.material) === fMat && normalizeFilHex(s.color) === fCol;
  });

  let spools = 0;
  let grams = 0;
  let totalCost = 0;

  matchingSpools.forEach(s => {
    const qty = Math.max(1, N(s.spoolQty || 1));
    const wt = N(s.weightG) || 1000;
    const cost = s.costPerSpool !== undefined ? N(s.costPerSpool) : (s.price !== undefined ? N(s.price) : 75);
    spools += qty;
    grams += qty * wt;
    totalCost += qty * cost;
  });

  const avgCostKg = grams > 0 ? (totalCost / grams) * 1000 : (N(f.price) || 75);

  return {
    spools,
    grams,
    totalCost,
    avgCostKg: Number(avgCostKg.toFixed(2)),
    matchingSpools
  };
}

function filRemainingGrams(f) {
  const p = filPurchasedStock(f);
  const used = filTotalUsed(f);
  return p.grams - used;
}

function filUnitCostKg(f) {
  if (!f) return 75;
  if (f.costKg && N(f.costKg) > 0) return N(f.costKg);
  const p = filPurchasedStock(f);
  if (p.grams > 0) return p.avgCostKg;
  const cost = N(f.price !== undefined ? f.price : (f.costPerSpool !== undefined ? f.costPerSpool : 75));
  const wt = N(f.weightG) || 1000;
  if (cost > 0 && wt > 0) return (cost / wt) * 1000;
  return 75;
}

function filStockValue(f) {
  const remG = Math.max(0, filRemainingGrams(f));
  const rate = filUnitCostKg(f);
  return Number(((remG / 1000) * rate).toFixed(2));
}

function filCostKg(f) {
  return filUnitCostKg(f);
}

function filTotalUsed(f) {
  if (!f) return 0;
  if (f.totalUsedGrams !== undefined && f.totalUsedGrams !== null) return N(f.totalUsedGrams);
  return S.prints.filter(p => p.filamentId === f.id).reduce((a, p) => a + N(p.grams), 0);
}

function filUsed(f) {
  return filTotalUsed(f);
}

function filAllocated(f) {
  if (!f) return 1000;
  const used = filTotalUsed(f);
  return N(f.allocatedGrams) || Math.max(1000, Math.ceil(used / 1000) * 1000);
}

function filRemaining(f) {
  if (!f) return 0;
  const p = filPurchasedStock(f);
  const used = filTotalUsed(f);
  if (p.grams > 0) {
    return Math.max(0, p.grams - used);
  }
  const allocated = filAllocated(f);
  return Math.max(0, allocated - used + N(f.adjustG));
}

function filLeft(f) {
  return filRemaining(f);
}

function filActiveSpoolLeft(f) {
  const rem = filRemaining(f);
  return Math.min(1000, Math.max(0, Math.round(rem * 10) / 10));
}

function filStatus(f) {
  const rem = filActiveSpoolLeft(f);
  if (rem > 200) return "active";
  if (rem > 0) return "low";
  return "depleted";
}

function costParts(o) {
  const st = set_(), h = N(o.minutes) / 60;
  const material = N(o.grams) * (1 + N(st.failPct) / 100) * N(o.costKg) / 1000;
  const power = h * N(st.kw) * N(st.elecRate);
  const machine = h * N(st.machineRate);
  const labor = (N(o.laborMin) / 60) * N(st.laborRate);
  const pack = N(o.packaging);
  const total = material + power + machine + labor + pack;
  return { material, power, machine, labor, pack, total, agent: total * (1 + N(st.agentMarkup) / 100), direct: total * (1 + N(st.directMarkup) / 100) };
}

function unitCost(p) {
  if (!p) return 0;
  return costParts({
    grams: p.grams,
    minutes: p.minutes,
    laborMin: p.laborMin,
    packaging: p.packaging,
    costKg: filCostKg(byId("filaments", p.filamentId)) || N(p.costKgOverride)
  }).total;
}

const liveInv = () => S.invoices.filter(i => i.type !== "quote" && i.status !== "void");

function stockOf(p) {
  const made = S.prints.filter(x => x.productId === p.id).reduce((a, x) => a + N(x.qty), 0);
  const out = liveInv().reduce((a, i) => a + (i.lines || []).filter(l => l.productId === p.id).reduce((b, l) => b + N(l.qty), 0), 0);
  return N(p.openingStock) + made - out;
}

function invTotals(i) {
  const st = set_();
  const sub = (i.lines || []).reduce((a, l) => a + N(l.qty) * N(l.price), 0);
  if (i.type === "foc") return { sub, disc: sub, vat: 0, total: 0, paid: 0, bal: 0 };
  const disc = Math.min(sub, N(i.discount));
  const vatPct = i.vatPct != null && i.vatPct !== "" ? N(i.vatPct) : N(st.vatPct);
  const vat = ((sub - disc) * vatPct) / 100;
  const total = sub - disc + vat;
  const paid = N(i.paid);
  return { sub, disc, vat, vatPct, total, paid, bal: Math.max(0, total - paid) };
}

function lineCost(l) {
  const p = byId("products", l.productId);
  return l.unitCost != null ? N(l.unitCost) : (p ? unitCost(p) : null);
}

function invCost(i) {
  return (i.lines || []).reduce((a, l) => {
    const c = lineCost(l);
    return a + N(l.qty) * (c == null ? 0 : c);
  }, 0);
}

function invNoCostLines(i) {
  return (i.lines || []).filter(l => lineCost(l) == null).length;
}

function inPeriod(d) {
  if (!d) return false;
  const now = new Date(), dt = new Date(d + "T00:00:00");
  if (period === "all") return true;
  if (period === "month") return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
  if (period === "30") return (now - dt) / 864e5 <= 30;
  if (period === "year") return dt.getFullYear() === now.getFullYear();
  return true;
}

function nextNo(type) {
  const pre = { sale: "INV", quote: "QT", foc: "FOC" }[type];
  const max = S.invoices.filter(i => i.type === type).reduce((a, i) => Math.max(a, parseInt(String(i.no || "").replace(/\D/g, "")) || 0), 0);
  return pre + "-" + String(max + 1).padStart(4, "0");
}

function payStatus(i) {
  if (i.status === "void") return ["Void", "neu"];
  if (i.type === "quote") return [i.converted ? "Converted" : "Open offer", "acc"];
  if (i.type === "foc") return ["FOC given", "warn"];
  const t = invTotals(i);
  if (t.bal <= 0.005) return ["Paid", "good"];
  if (t.paid > 0) return ["Part paid", "warn"];
  return ["Unpaid", "bad"];
}

/* ---------- tabs ---------- */
const TABS = [
  ["dashboard", "Dashboard"],
  ["prints", "Print Jobs"],
  ["products", "Product Catalogue"],
  ["filaments", "Filament Inventory"],
  ["calc", "Cost Calculator"],
  ["orders", "Orders & Fulfillment"],
  ["enquiries", "Enquiries & Quotes"],
  ["customers", "Customers"],
  ["reports", "Financial Reports"],
  ["expenses", "Expenses"],
  ["settings", "Settings"]
];

/* ---------- Navigation Groups (Universal 3D Studio Architecture) ---------- */
const NAV_GROUPS = [
  {
    group: "MANUFACTURING",
    items: [
      { key: "dashboard", label: "Dashboard", icon: APP_ICONS.navDashboard },
      { key: "prints", label: "Print Jobs", icon: APP_ICONS.navPrints },
      { key: "products", label: "Product Catalogue", icon: APP_ICONS.navProducts },
      { key: "filaments", label: "Filament Inventory", icon: APP_ICONS.navFilaments },
      { key: "calc", label: "Cost Calculator", icon: APP_ICONS.navCalc }
    ]
  },
  {
    group: "COMMERCE & FULFILLMENT",
    items: [
      { key: "orders", label: "Orders & Fulfillment", icon: APP_ICONS.navOrders },
      { key: "enquiries", label: "Enquiries & Quotes", icon: APP_ICONS.navEnquiries },
      { key: "customers", label: "Customers", icon: APP_ICONS.navCustomers }
    ]
  },
  {
    group: "FINANCE & OPERATIONS",
    items: [
      { key: "reports", label: "Financial Reports", icon: APP_ICONS.navReports },
      { key: "expenses", label: "Expenses", icon: APP_ICONS.navExpenses },
      { key: "settings", label: "Settings", icon: APP_ICONS.navSettings }
    ]
  }
];

function drawTabs() {
  const nav = $("#sidebarNav");
  if (!nav) return;
  nav.innerHTML = NAV_GROUPS.map(g => `
    <div class="nav-group">
      <div class="nav-group-label">${g.group}</div>
      ${g.items.map(item => {
        let badge = "";
        if (item.key === "products") {
          const count = (S.products || []).length;
          badge = `<span class="nav-badge">${count}</span>`;
        }
        if (item.key === "prints") {
          const count = (S.prints || []).length;
          badge = `<span class="nav-badge">${count}</span>`;
        }
        if (item.key === "filaments") {
          const count = (S.filament_stock || S.filaments || []).length;
          badge = `<span class="nav-badge">${count}</span>`;
        }
        if (item.key === "orders") {
          const count = (S.orders || []).length;
          if (count > 0) badge = `<span class="nav-badge">${count}</span>`;
        }
        if (item.key === "enquiries") {
          const count = (S.enquiries || []).length;
          if (count > 0) badge = `<span class="nav-badge">${count}</span>`;
        }
        return `
          <button role="tab" type="button" class="nav-item ${item.key === tab ? 'active' : ''}" data-tab="${item.key}" aria-selected="${item.key === tab}">
            ${item.icon}
            <span class="nav-text">${item.label}</span>
            ${badge}
          </button>
        `;
      }).join("")}
    </div>
  `).join("");
}

function bannerHtml() {
  if (db || !booted) return "";
  if (HOST) return `<div class="banner">Offline preview — changes stay in this browser tab only and are not shared with your team.</div>`;
  if (!store.ok()) return `<div class="banner">Browser storage is unavailable — further changes are kept for this session only and will be lost on reload. Nothing is shared with other people or computers.</div>`;
  return "";
}

function syncThemeIcons() {
  const isDark = document.documentElement.classList.contains("dark");
  const moon = $("#moonIcon"), sun = $("#sunIcon");
  if (moon && sun) {
    moon.style.display = isDark ? "none" : "block";
    sun.style.display = isDark ? "block" : "none";
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme_preference", isDark ? "dark" : "light");
  syncThemeIcons();
  if (tab === "dashboard") {
    bindChart();
  }
}

function vRedirectModule(tabKey, tabLabel, adminRoute) {
  return `
    <div class="card" style="max-width: 680px; margin: 40px auto; padding: 40px 32px; text-align: center; border-radius: 20px; box-shadow: 0 4px 20px rgba(6, 44, 47, 0.06);">
      <div style="width: 56px; height: 56px; border-radius: 16px; background: var(--color-pastel-mint, #D8F2EE); color: #062C2F; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
        ${APP_ICONS.navProducts(28, 2)}
      </div>
      <h2 style="font-size: 20px; font-weight: 700; color: var(--color-text-primary, #062C2F); margin-bottom: 10px;">${tabLabel} has moved to Business Management</h2>
      <p style="font-size: 14px; color: var(--color-text-secondary, #506867); line-height: 1.6; max-width: 480px; margin: 0 auto 24px;">
        To streamline the manufacturing workspace, commercial operations (${tabLabel.toLowerCase()}) are now managed centrally in the dedicated Business Workspace.
      </p>
      <div style="display: flex; gap: 12px; justify-content: center; align-items: center;">
        <a href="${adminRoute}" class="btn pri btn-pill-primary" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none; padding: 10px 20px; font-weight: 600;">
          Open in Business Suite &rarr;
        </a>
        <button type="button" class="btn btn-pill" data-tab-link="dashboard" style="padding: 10px 18px;">
          Return to Dashboard
        </button>
      </div>
    </div>
  `;
}

function render() {
  try {
    let savedTab = localStorage.getItem("ps_tab");
    if (savedTab === "stock") {
      savedTab = "expenses";
      try { localStorage.setItem("ps_tab", "expenses"); } catch(_) {}
    }
    if (savedTab === "automation-history") {
      savedTab = "dashboard";
      try { localStorage.setItem("ps_tab", "dashboard"); } catch(_) {}
    }
    const allowedTabs = [
      "dashboard", "prints", "products", "filaments", "calc",
      "orders", "enquiries", "customers", "reports",
      "expenses", "reminders", "settings"
    ];
    if (savedTab && (allowedTabs.includes(savedTab) || savedTab === "stock")) {
      tab = savedTab === "stock" ? "expenses" : savedTab;
    } else if (savedTab && !allowedTabs.includes(savedTab)) {
      tab = "dashboard";
    }
  } catch(_) {}
  if (tab === "stock") {
    tab = "expenses";
  }
  if (tab === "automation-history") {
    tab = "dashboard";
  }
  const st = set_();
  const tabTitles = {
    dashboard: "Dashboard",
    prints: "Print Jobs",
    products: "Product Catalogue",
    filaments: "Filament Inventory",
    calc: "Cost Calculator",
    orders: "Orders & Fulfillment",
    enquiries: "Enquiries & Quotes",
    customers: "Customers Directory",
    reports: "Financial Reports",
    expenses: "Expenses",
    stock: "Expenses",
    reminders: "Maintenance Reminders",
    "automation-history": "Sync History",
    settings: "Settings",
    // Aliases
    kyc: "Customers Directory",
    quotes: "Enquiries & Quotes",
    invoices: "Financial Reports",
    accounts: "Settings"
  };
  const tabCrumbs = {
    dashboard: "MANUFACTURING :",
    prints: "MANUFACTURING :",
    products: "MANUFACTURING :",
    filaments: "MANUFACTURING :",
    calc: "MANUFACTURING :",
    orders: "COMMERCE & FULFILLMENT :",
    enquiries: "COMMERCE & FULFILLMENT :",
    customers: "COMMERCE & FULFILLMENT :",
    reports: "FINANCE & OPERATIONS :",
    expenses: "FINANCE & OPERATIONS :",
    stock: "FINANCE & OPERATIONS :",
    reminders: "OPERATIONS :",
    "automation-history": "OPERATIONS :",
    settings: "OPERATIONS :",
    kyc: "COMMERCE & FULFILLMENT :",
    quotes: "COMMERCE & FULFILLMENT :",
    invoices: "FINANCE & OPERATIONS :",
    accounts: "OPERATIONS :"
  };

  $("#pageTitleText").textContent = tabTitles[tab] || "Dashboard";
  $("#crumbText").textContent = tabCrumbs[tab] || "MANUFACTURING :";
  if ($("#bizName")) $("#bizName").textContent = (st.bizName || "Print Studio").toUpperCase();
  if ($("#bizSub")) $("#bizSub").textContent = `0.20 mm layers · ${cur()}${st.phone ? " · " + st.phone : ""}`;
  syncThemeIcons();
  drawTabs();
  renderTopbarActions(tab);

  const fn = {
    dashboard: vDash,
    products: vProducts,
    prints: vPrints,
    filaments: vFil,
    expenses: () => '<div class="module-page-wrapper expenses-page-wrapper" id="expensesPageRoot"></div>',
    stock: () => '<div class="module-page-wrapper expenses-page-wrapper" id="expensesPageRoot"></div>',
    calc: vCalc,
    reminders: vReminders,
    "automation-history": vAutomationHistory,
    settings: vSettings,
    customers: vCustomers,
    orders: vOrders,
    kyc: vCustomers,
    quotes: vEnquiries,
    enquiries: vEnquiries,
    invoices: vReports,
    reports: vReports,
    accounts: vSettings
  }[tab] || vDash;

  const focusId = document.activeElement && document.activeElement.id;
  $("#main").innerHTML = bannerHtml() + fn();

  if (tab === "dashboard") bindChart();
  if (tab === "calc") bindCalc();
  if (tab === "expenses") bindExpenses();
  else unmountExpenses();
  if (tab === "orders") bindOrders();
  if (tab === "enquiries" || tab === "quotes") bindEnquiries();
  if (tab === "customers" || tab === "kyc") bindCustomers();

  if (focusId && document.getElementById(focusId) && /^(q|c)_/.test(focusId)) {
    const el = document.getElementById(focusId);
    el.focus();
    try { el.setSelectionRange(el.value.length, el.value.length); } catch(_) {}
  }
}

function bindExpenses() {
  const rootEl = document.getElementById("expensesPageRoot");
  if (rootEl) {
    mountExpenses(rootEl);
  }
}

let isSyncingBambu = false;
let lastBambuSyncTime = null;
let pendingManualSync = false;

async function loadLedgerData(forceRender = true) {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.collections) {
      neonConnected = true;
      COLLS.forEach(k => {
        if (json.collections[k]) {
          S[k] = (json.collections[k] || []).filter(x => !x.example);
          store.persist(k);
        }
      });
      if (json.collections.settings && json.collections.settings.length > 0) {
        S.settings = json.collections.settings[0];
        store.persist("settings");
      }
      setSyncNeon("live");
      if (forceRender) {
        render();
      }
      try {
        const stRes = await fetch("/api/data?status=1", { cache: "no-store" });
        if (stRes.ok) {
          const stJson = await stRes.json();
          if (stJson.version) lastSyncVersion = stJson.version;
        }
      } catch (_) {}
      return true;
    }
  } catch (err) {
    console.warn("loadLedgerData error:", err);
  }
  return false;
}

async function syncBambu(manual = false) {
  if (isSyncingBambu) {
    if (manual) {
      pendingManualSync = true;
      notify({
        type: "info",
        title: "Sync in Progress",
        message: "Fetching latest tasks from Bambu Lab Cloud..."
      });
    }
    return;
  }
  isSyncingBambu = true;
  if (manual) pendingManualSync = true;
  updateSyncButtonUI(true);

  try {
    const res = await fetch("/api/bambu/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000)
    });

    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      throw new Error(`Server returned HTTP ${res.status} (${res.statusText || "Invalid response"})`);
    }

    if (!res.ok) {
      const errorMsg = data.error || `Sync failed with status ${res.status}`;
      console.warn("Bambu sync error:", res.status, errorMsg);
      notify({
        type: "warn",
        title: res.status === 401 ? "Bambu Token Expired" : "Bambu Sync Failed",
        message: errorMsg
      });
      return;
    }

    lastBambuSyncTime = Date.now();
    
    // Only refresh data if new tasks were actually recorded
    const newCount = Number(data.newTasksCount ?? 0);
    if (newCount > 0) {
      await loadLedgerData(true);
    }

    if (pendingManualSync) {
      const statusToast = newCount > 0
        ? `Synced • ${newCount} new task${newCount === 1 ? '' : 's'} recorded`
        : `Up to date • ${data.totalChecked || 0} tasks verified`;
      notify({
        type: "success",
        title: "Bambu Synced",
        message: statusToast
      });
    }
  } catch (err) {
    console.error("Bambu sync error:", err);
    const msg = err.name === "TimeoutError" 
      ? "Sync request timed out. Please check your network connection."
      : (err.message || "Network error while syncing.");
    notify({
      type: "warn",
      title: "Bambu Sync Error",
      message: msg
    });
  } finally {
    isSyncingBambu = false;
    pendingManualSync = false;
    updateSyncButtonUI(false);
  }
}

const handleSync = syncBambu;
try {
  window.S = S;
  window.render = render;
  window.syncBambu = syncBambu;
  window.handleSync = syncBambu;
  window.loadLedgerData = loadLedgerData;
  window.calculateExpenseKPIs = calculateExpenseKPIs;
  window.getFilteredExpenses = getFilteredExpenses;
  window.getExpenseCategories = getExpenseCategories;
  window.parseExpenseAmountToCents = parseExpenseAmountToCents;
  window.expenseCentsToAmount = expenseCentsToAmount;
  window.formatExpenseAED = formatExpenseAED;
  window.getStartEndForPeriod = getStartEndForPeriod;
  window.isDateInPeriod = isDateInPeriod;
  window.DEFAULT_EXPENSE_CATEGORY_DEFINITIONS = DEFAULT_EXPENSE_CATEGORY_DEFINITIONS;
  window.persistExpenseData = function(coll) {
    try {
      if (coll) {
        store.persist(coll);
      } else {
        store.persist("expenses");
        store.persist("expense_categories");
      }
    } catch (_) {}
  };
} catch (_) {}

function updateSyncButtonUI(syncing) {
  const btns = document.querySelectorAll("#syncBambuBtn");
  btns.forEach(btn => {
    const icon = btn.querySelector(".sync-bambu-icon");
    const text = btn.querySelector(".sync-bambu-text");
    if (syncing) {
      btn.disabled = true;
      btn.classList.add("syncing");
      if (icon) icon.classList.add("spinning");
      if (text) text.textContent = "Syncing...";
    } else {
      btn.disabled = false;
      btn.classList.remove("syncing");
      if (icon) icon.classList.remove("spinning");
      if (text) text.textContent = "Sync Bambu";
    }
  });
}

function renderSyncBambuBtn(isPrimary = true) {
  const btnClass = isPrimary ? "btn pri btn-pill-primary" : "btn btn-pill";
  return `
    <button class="${btnClass} ${isSyncingBambu ? "syncing" : ""}" id="syncBambuBtn" type="button" ${isSyncingBambu ? "disabled" : ""} title="Live sync latest prints & models from Bambu Lab Cloud">
      <svg class="sync-bambu-icon ${isSyncingBambu ? "spinning" : ""}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
        <path d="M21 3v5h-5"></path>
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
        <path d="M8 16H3v5"></path>
      </svg>
      <span class="sync-bambu-text">${isSyncingBambu ? "Syncing..." : "Sync Bambu"}</span>
    </button>
  `;
}

function renderTopbarActions(t) {
  const container = $("#topbarActions");
  if (!container) return;

  switch (t) {
    case "dashboard":
      container.innerHTML = `
        <div class="segmented-control" id="echartRangeSwitch" role="group" aria-label="Timeframe Filter">
          <button type="button" class="segment-btn ${chartRange === '24h' ? 'active' : ''}" data-crange="24h">24H</button>
          <button type="button" class="segment-btn ${chartRange === '7d' ? 'active' : ''}" data-crange="7d">7D</button>
          <button type="button" class="segment-btn ${chartRange === '30d' ? 'active' : ''}" data-crange="30d">30D</button>
          <button type="button" class="segment-btn ${chartRange === '12m' ? 'active' : ''}" data-crange="12m">12M</button>
          <button type="button" class="segment-btn ${chartRange === 'all' ? 'active' : ''}" data-crange="all">ALL</button>
        </div>
        <button class="btn btn-pill" id="xlsAll" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn btn-pill" id="pdfReport" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
        ${renderSyncBambuBtn(true)}
      `;
      break;

    case "products":
    case "filaments":
    case "prints":
    case "stock":
      container.innerHTML = `
        <button class="btn btn-pill" data-xls="${t === 'stock' ? 'products' : t}" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn btn-pill" data-pdf="${t === 'stock' ? 'products' : t}" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
        ${renderSyncBambuBtn(true)}
      `;
      break;

    case "calc":
      container.innerHTML = `
        <button class="btn btn-pill" id="calcXls" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn btn-pill" id="calcPdf" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
        <button class="btn pri btn-pill-primary" id="calcSave" type="button">${APP_ICONS.btnSave()} <span>Save as product</span></button>
      `;
      break;

    case "customers":
    case "orders":
    case "kyc":
    case "quotes":
      container.innerHTML = `
        <button class="btn btn-pill" data-xls="invoices" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn pri btn-pill-primary" data-new="invoices" data-type="${t === 'quotes' ? 'quote' : 'sale'}" type="button">${APP_ICONS.btnAdd()} <span>${t === 'quotes' ? 'New quotation' : (t === 'orders' ? 'New order' : 'New customer')}</span></button>
      `;
      break;

    case "invoices":
      container.innerHTML = `
        <button class="btn btn-pill" data-xls="invoices" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn btn-pill" data-pdf="invoices" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
        <button class="btn btn-pill" data-new="invoices" data-type="quote" type="button">${APP_ICONS.btnAdd()} <span>New offer</span></button>
        <button class="btn btn-pill" data-new="invoices" data-type="foc" type="button">${APP_ICONS.btnAdd()} <span>New FOC</span></button>
        <button class="btn pri btn-pill-primary" id="topNewInvoiceBtn" data-new="invoices" data-type="sale" type="button">${APP_ICONS.btnAdd()} <span>New invoice</span></button>
      `;
      break;

    case "expenses":
      container.innerHTML = `
        <button class="btn btn-pill" data-xls="expenses" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn btn-pill" data-pdf="expenses" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
        <button class="btn pri btn-pill-primary" data-new="expenses" type="button">${APP_ICONS.btnAdd()} <span>Add expense</span></button>
      `;
      break;

    case "reports":
      container.innerHTML = `
        <button class="btn btn-pill" id="xlsAll" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn pri btn-pill-primary" id="pdfReport" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
      `;
      break;

    case "reminders":
    case "automation-history":
      container.innerHTML = `
        ${renderSyncBambuBtn(true)}
      `;
      break;

    case "accounts":
      container.innerHTML = `
        <button class="btn btn-pill" id="accXls" data-xls="accounts" type="button">${APP_ICONS.btnExcel()} <span>Export Excel</span></button>
        <button class="btn btn-pill" id="accPdf" data-pdf="accounts" type="button">${APP_ICONS.btnPdf()} <span>Report PDF</span></button>
        <button class="btn pri btn-pill-primary" data-new="accounts" type="button">${APP_ICONS.btnAdd()} <span>Add account</span></button>
      `;
      break;

    case "settings":
      container.innerHTML = `
        <button class="btn pri btn-pill-primary" id="saveSettings" type="button">${APP_ICONS.btnSave()} <span>Save settings</span></button>
      `;
      break;

    default:
      container.innerHTML = "";
      break;
  }
}

const hdr = (t, p, tools) => {
  if (!tools) return "";
  const d = document.createElement("div");
  d.innerHTML = tools;
  const filters = [];
  Array.from(d.children).forEach(el => {
    if (el.tagName !== "BUTTON") filters.push(el.outerHTML);
  });
  if (!filters.length) return "";
  return `<div class="sec-head"><div class="tools"><div class="tools-filter-group">${filters.join("")}</div></div></div>`;
};
const search = (k, ph = "Search…") => `
  <div class="search-wrap">
    ${APP_ICONS.search}
    <input class="search" id="q_${k}" placeholder="${ph}" value="${esc(q[k] || "")}" data-q="${k}" aria-label="${ph}">
    ${q[k] ? `<button type="button" class="search-clear" data-qclr="${k}" title="Clear search">✕</button>` : ""}
  </div>
`;
const match = (k, ...vals) => !q[k] || vals.join(" ").toLowerCase().includes(q[k].toLowerCase());

let searchDebounceTimer = null;
const handleDocInput = e => {
  const k = e.target.dataset && e.target.dataset.q;
  if (k) {
    q[k] = e.target.value;
    if (k === "p") prodPage = 1;
    if (k === "pr") printPage = 1;
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      render();
      const input = $(`#q_${k}`);
      if (input) {
        input.focus();
        try { input.setSelectionRange(input.value.length, input.value.length); } catch(_) {}
      }
    }, 150);
  }
};
document.addEventListener("input", handleDocInput);

const exMark = o => o.example ? `<span class="pill neu sample-pill">Sample</span>` : "";
const actBtns = (coll, id, extra) => `<td class="act"><div class="tbl-actions-group">${extra || ""}<button class="btn sm btn-action-icon" data-edit="${coll}" data-id="${id}" title="Edit">${APP_ICONS.btnEdit(13, 2)}</button><button class="btn sm btn-action-icon danger" data-del="${coll}" data-id="${id}" title="Delete">${APP_ICONS.btnDelete(13, 2)}</button></div></td>`;
const table = (heads, rows, emptyMsg) => `<div class="tbl-wrap"><table><thead><tr>${heads.map(h => `<th class="${h.startsWith("#") ? "n" : ""}">${h.replace(/^#/, "")}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.join("") : `<tr><td colspan="${heads.length}" class="empty">${emptyMsg}</td></tr>`}</tbody></table></div>`;

/* ==========================================================================
   Dashboard View (Ditto Copy Text + Medsathi Quick Actions & Apache ECharts)
   ========================================================================== */
const pastelCard = (variant, iconSvg, label, value, subtitle, barHeights = [40, 65, 50, 90, 75], trend = null) => {
  const trendHtml = trend ? `
    <div class="kpi-trend-pill ${trend.dir}" title="${esc(trend.title || trend.label || '')}">
      <span class="trend-icon" aria-hidden="true">${trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '→'}</span>
      <span class="trend-value">${trend.text}</span>
      <span class="trend-label">${trend.label}</span>
    </div>
  ` : '';

  return `
  <div class="metric-card metric-card--${variant}">
    <div class="card-top-row">
      <div class="card-icon-container">${iconSvg}</div>
      ${trendHtml}
    </div>
    <div class="card-body">
      <div class="card-label">${label}</div>
      <div class="card-value">${value}</div>
      <div class="card-subtitle" title="${esc(subtitle)}">${subtitle}</div>
    </div>
    <div class="card-bar-viz" aria-hidden="true">
      ${barHeights.map(h => `<span style="transform: scaleY(${h / 100});"></span>`).join("")}
    </div>
  </div>
  `;
};

function formatDateShort(d) {
  if (!d) return "—";
  try {
    const parts = String(d).split("-");
    if (parts.length < 3) return d;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const mIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return `${day} ${months[mIdx] || parts[1]}`;
  } catch (_) {
    return d;
  }
}

function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts).slice(0, 19).replace("T", " ");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[d.getUTCMonth()] || "";
    const day = d.getUTCDate();
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, "0");
    const minutes = String(d.getUTCMinutes()).padStart(2, "0");
    return `${day} ${month} ${year}, ${hours}:${minutes} UTC`;
  } catch (_) {
    return String(ts).slice(0, 19).replace("T", " ");
  }
}

function cleanProfileName(name) {
  if (!name) return "";
  return String(name)
    .replace(/\s*@(BBL|Bambu)[^\n,;]*/gi, "")
    .trim();
}

function cleanModelTitle(raw) {
  if (!raw) return "";
  let title = String(raw).trim();
  title = title.replace(/\.gcode\.3mf$/i, "");
  title = title.replace(/\.3mf$/i, "");
  title = title.replace(/\.gcode$/i, "");
  title = title.replace(/\s*[-–—/\\|:]*\s*[\(\[\{]?\s*print[\s-]+in[\s-]+place\s*[\)\]\}]?\s*[-–—/\\|:]*/gi, " ");
  title = title.replace(/\s*[-–—/\\|:]+\s*$/, "");
  title = title.replace(/^\s*[-–—/\\|:]+\s*/, "");
  return title.replace(/\s+/g, " ").trim();
}

/* ---------- Timeframe Filtering & Production Overview Aggregator ---------- */
function getPrintTimestamp(p) {
  if (!p) return 0;
  const raw = p.startTime || p.endTime || p.updatedAt || p.date;
  if (!raw) return 0;
  if (typeof raw === "number") return raw > 0 ? (raw < 1e11 ? raw * 1000 : raw) : 0;
  const parsed = new Date(raw).getTime();
  if (!isNaN(parsed) && parsed > 0) return parsed;
  const parts = String(raw).split("-");
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!isNaN(d.getTime()) && d.getTime() > 0) return d.getTime();
  }
  return 0;
}

function getPrintsInTimeframe(range = chartRange) {
  const prints = S.prints || [];
  if (range === "all") return [...prints];
  const now = Date.now();
  let ms = 30 * 24 * 3600 * 1000;
  if (range === "24h") ms = 24 * 3600 * 1000;
  else if (range === "7d") ms = 7 * 24 * 3600 * 1000;
  else if (range === "30d") ms = 30 * 24 * 3600 * 1000;
  else if (range === "12m") ms = 365 * 24 * 3600 * 1000;
  return prints.filter(p => {
    const ts = getPrintTimestamp(p);
    return ts >= (now - ms);
  });
}

function getPrintsInPreviousTimeframe(range = chartRange) {
  if (range === "all") return [];
  const prints = S.prints || [];
  const now = Date.now();
  let ms = 30 * 24 * 3600 * 1000;
  if (range === "24h") ms = 24 * 3600 * 1000;
  else if (range === "7d") ms = 7 * 24 * 3600 * 1000;
  else if (range === "30d") ms = 30 * 24 * 3600 * 1000;
  else if (range === "12m") ms = 365 * 24 * 3600 * 1000;
  return prints.filter(p => {
    const ts = getPrintTimestamp(p);
    return ts >= (now - 2 * ms) && ts < (now - ms);
  });
}

function calcTrend(current, previous, range = chartRange) {
  if (range === "all") return null;
  const rangeShortLabels = { "24h": "24h", "7d": "7d", "30d": "30d", "12m": "12m" };
  const labelSuffix = rangeShortLabels[range] || range;
  const cur = N(current);
  const prev = N(previous);

  if (prev === 0 && cur === 0) {
    return { text: "0%", dir: "flat", label: `vs prior ${labelSuffix}`, title: "No change vs previous period" };
  }
  if (prev === 0 && cur > 0) {
    return { text: "New", dir: "flat", label: `vs prior ${labelSuffix}`, title: `New activity (${cur} in current period, 0 in prior ${labelSuffix})` };
  }
  if (cur === 0 && prev > 0) {
    return { text: "-100%", dir: "down", label: `vs prior ${labelSuffix}`, title: `Decreased from ${prev} to 0 vs prior ${labelSuffix}` };
  }

  const diff = cur - prev;
  const pct = Math.round((diff / prev) * 100);
  if (pct === 0) {
    return { text: "0%", dir: "flat", label: `vs prior ${labelSuffix}`, title: "No change vs previous period" };
  }
  const dir = pct > 0 ? "up" : "down";
  const sign = pct > 0 ? "+" : "";
  return {
    text: `${sign}${pct}%`,
    dir,
    label: `vs prior ${labelSuffix}`,
    title: `${sign}${pct}% (${diff > 0 ? '+' : ''}${diff % 1 === 0 ? diff : diff.toFixed(1)} vs prior ${labelSuffix})`
  };
}

function formatSmartFilament(grams, withSpace = true) {
  const g = N(grams);
  if (g < 1000) {
    const formatted = g % 1 === 0 ? g.toFixed(0) : g.toFixed(1);
    return `${formatted}${withSpace ? " " : ""}g`;
  }
  const kg = g / 1000;
  const formatted = kg.toFixed(1);
  return `${formatted}${withSpace ? " " : ""}kg`;
}

/**
 * Safe Display Normalization for Material Breakdown
 *
 * In Bambu Studio / Bambu Cloud telemetry:
 * - p.grams represents the overall sliced print job weight (e.g. 511.8g).
 * - p.filamentsUsed[].weightG contains per-slot telemetry from AMS slots (e.g. 511.7g).
 * Minor rounding variances (0.1g) frequently occur between AMS slot telemetry and top-level slicer weights.
 *
 * Invariant Guarantees:
 * 1. Non-destructive: Never mutates p.grams or p.filamentsUsed on the source record.
 * 2. Proportional Scaling: When declared job grams (p.grams) and AMS slots both exist and differ slightly,
 *    scales each slot proportionally so that the sum of materials displayed matches p.grams exactly.
 * 3. Fallback Safety: Safely handles missing/empty filamentsUsed arrays, zero/missing weights,
 *    and unmapped materials without NaN, division-by-zero, or exceptions.
 */
function getMaterialsForPrint(p) {
  if (!p) return [{ mat: "PLA", weight: 0 }];
  const totalGrams = N(p.grams);

  if (p.filamentsUsed && Array.isArray(p.filamentsUsed) && p.filamentsUsed.length > 0) {
    const rawItems = p.filamentsUsed.map(f => ({
      mat: (f && f.type ? String(f.type) : "PLA").toUpperCase().trim(),
      weight: N(f && f.weightG)
    }));
    const rawSum = rawItems.reduce((acc, item) => acc + item.weight, 0);

    // If total declared weight differs slightly from raw sum of AMS slot weights,
    // scale slot weights proportionally for display so that total material breakdown matches total print grams.
    if (totalGrams > 0 && rawSum > 0 && Math.abs(rawSum - totalGrams) > 0.0001) {
      const scale = totalGrams / rawSum;
      return rawItems.map(item => ({
        mat: item.mat,
        weight: item.weight * scale
      }));
    } else if (totalGrams > 0 && rawSum === 0) {
      // Slot weights were omitted: distribute totalGrams equally across declared slots
      const perSlot = totalGrams / rawItems.length;
      return rawItems.map(item => ({
        mat: item.mat,
        weight: perSlot
      }));
    }
    return rawItems;
  }

  // Fallback when no AMS breakdown is available: use linked filament material or default to PLA
  const fil = p.filamentId ? byId("filaments", p.filamentId) : null;
  const matName = ((fil && fil.material) || "PLA").toUpperCase().trim();
  return [{
    mat: matName || "PLA",
    weight: totalGrams
  }];
}

function getProductionTimeSeries(range = chartRange) {
  const now = new Date();
  let labels = [];
  let printHours = [];
  let filamentGrams = [];
  let materialMap = {};
  const allFilteredPrints = getPrintsInTimeframe(range);

  const activeMaterialsSet = new Set();
  allFilteredPrints.forEach(p => {
    getMaterialsForPrint(p).forEach(item => {
      if (item.mat) activeMaterialsSet.add(item.mat);
    });
  });
  const activeMaterials = Array.from(activeMaterialsSet).sort();
  if (activeMaterials.length === 0) activeMaterials.push("PLA");

  if (range === "24h") {
    // 6 chronological 4-hour intervals counting back from now
    labels = [];
    for (let k = 5; k >= 0; k--) {
      const bucketStart = new Date(now.getTime() - (k + 1) * 4 * 3600 * 1000);
      labels.push(String(bucketStart.getHours()).padStart(2, "0") + ":00");
    }
    printHours = new Array(6).fill(0);
    filamentGrams = new Array(6).fill(0);
    activeMaterials.forEach(m => { materialMap[m] = new Array(6).fill(0); });

    allFilteredPrints.forEach(p => {
      const ts = getPrintTimestamp(p);
      if (ts <= 0) return;
      const hoursAgo = (now.getTime() - ts) / 36e5;
      if (hoursAgo < 0) return;
      const b = Math.min(5, Math.max(0, 5 - Math.floor(hoursAgo / 4)));
      const h = N(p.hours);
      const g = N(p.grams);
      printHours[b] += h;
      filamentGrams[b] += g;
      getMaterialsForPrint(p).forEach(item => {
        if (materialMap[item.mat]) materialMap[item.mat][b] += item.weight;
      });
    });
  } else if (range === "7d") {
    // Calendar-day boundaries (midnight to midnight)
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    labels = [];
    for (let k = 6; k >= 0; k--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k);
      labels.push(dayNames[d.getDay()]);
    }
    printHours = new Array(7).fill(0);
    filamentGrams = new Array(7).fill(0);
    activeMaterials.forEach(m => { materialMap[m] = new Array(7).fill(0); });

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    allFilteredPrints.forEach(p => {
      const ts = getPrintTimestamp(p);
      if (ts <= 0) return;
      const printDate = new Date(ts);
      const printMidnight = new Date(printDate.getFullYear(), printDate.getMonth(), printDate.getDate()).getTime();
      const calDaysDiff = Math.round((todayMidnight - printMidnight) / 864e5);
      if (calDaysDiff < 0 || calDaysDiff > 6) return;
      const b = 6 - calDaysDiff;
      const h = N(p.hours);
      const g = N(p.grams);
      printHours[b] += h;
      filamentGrams[b] += g;
      getMaterialsForPrint(p).forEach(item => {
        if (materialMap[item.mat]) materialMap[item.mat][b] += item.weight;
      });
    });
  } else if (range === "30d") {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    labels = [];
    for (let k = 4; k >= 0; k--) {
      const dStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((k + 1) * 6 - 1));
      const dEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (k * 6));
      labels.push(`${dStart.getDate()} ${monthNames[dStart.getMonth()]} - ${dEnd.getDate()} ${monthNames[dEnd.getMonth()]}`);
    }
    printHours = new Array(5).fill(0);
    filamentGrams = new Array(5).fill(0);
    activeMaterials.forEach(m => { materialMap[m] = new Array(5).fill(0); });

    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    allFilteredPrints.forEach(p => {
      const ts = getPrintTimestamp(p);
      if (ts <= 0) return;
      const printDate = new Date(ts);
      const printMidnight = new Date(printDate.getFullYear(), printDate.getMonth(), printDate.getDate()).getTime();
      const calDaysDiff = Math.round((todayMidnight - printMidnight) / 864e5);
      const b = Math.min(4, Math.max(0, 4 - Math.floor(calDaysDiff / 6)));
      const h = N(p.hours);
      const g = N(p.grams);
      printHours[b] += h;
      filamentGrams[b] += g;
      getMaterialsForPrint(p).forEach(item => {
        if (materialMap[item.mat]) materialMap[item.mat][b] += item.weight;
      });
    });
  } else {
    // 12m or all:
    const isAll = range === "all";
    let useYearlyBuckets = false;
    let oldestTs = now.getTime();
    let hasValidPrints = false;

    if (isAll && allFilteredPrints.length > 0) {
      allFilteredPrints.forEach(p => {
        const ts = getPrintTimestamp(p);
        if (ts > 0) {
          hasValidPrints = true;
          if (ts < oldestTs) oldestTs = ts;
        }
      });
    }

    const oldestDate = new Date(oldestTs);
    const monthsSpan = hasValidPrints
      ? (now.getFullYear() - oldestDate.getFullYear()) * 12 + (now.getMonth() - oldestDate.getMonth()) + 1
      : 12;

    // Use monthly buckets for shorter history (<= 24 months); switch to yearly buckets for multi-year history (> 24 months)
    if (isAll && hasValidPrints && monthsSpan > 24) {
      useYearlyBuckets = true;
    }

    if (useYearlyBuckets) {
      const startYear = oldestDate.getFullYear();
      const endYear = now.getFullYear();
      const yearCount = endYear - startYear + 1;

      labels = [];
      for (let y = startYear; y <= endYear; y++) {
        labels.push(String(y));
      }

      printHours = new Array(yearCount).fill(0);
      filamentGrams = new Array(yearCount).fill(0);
      activeMaterials.forEach(m => { materialMap[m] = new Array(yearCount).fill(0); });

      allFilteredPrints.forEach(p => {
        const ts = getPrintTimestamp(p);
        if (ts <= 0) return;
        const d = new Date(ts);
        const y = d.getFullYear();
        const b = Math.min(yearCount - 1, Math.max(0, y - startYear));
        const h = N(p.hours);
        const g = N(p.grams);
        printHours[b] += h;
        filamentGrams[b] += g;
        getMaterialsForPrint(p).forEach(item => {
          if (materialMap[item.mat]) materialMap[item.mat][b] += item.weight;
        });
      });
    } else {
      // Monthly buckets: min 12 rolling months, expanding to encompass all historical prints without arbitrary cap
      const monthCount = isAll ? Math.max(12, monthsSpan) : 12;

      labels = [];
      const keys = [];
      for (let k = monthCount - 1; k >= 0; k--) {
        const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
        const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        keys.push(key);
        const mStr = d.toLocaleString("en-US", { month: "short" });
        labels.push(d.getMonth() === 0 ? `${mStr} '${String(d.getFullYear()).slice(-2)}` : mStr);
      }

      printHours = new Array(monthCount).fill(0);
      filamentGrams = new Array(monthCount).fill(0);
      activeMaterials.forEach(m => { materialMap[m] = new Array(monthCount).fill(0); });

      allFilteredPrints.forEach(p => {
        const ts = getPrintTimestamp(p);
        if (ts <= 0) return;
        const d = new Date(ts);
        const pKey = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
        const idx = keys.indexOf(pKey);
        let b = idx;
        if (b === -1) {
          if (isAll) {
            // Never discard historical prints in ALL range
            b = d.getTime() > now.getTime() ? monthCount - 1 : 0;
          } else {
            // Strictly 12m window
            return;
          }
        }
        const h = N(p.hours);
        const g = N(p.grams);
        printHours[b] += h;
        filamentGrams[b] += g;
        getMaterialsForPrint(p).forEach(item => {
          if (materialMap[item.mat]) materialMap[item.mat][b] += item.weight;
        });
      });
    }
  }

  const totalPeriodHours = printHours.reduce((a, b) => a + b, 0);
  const totalPeriodGrams = filamentGrams.reduce((a, b) => a + b, 0);
  const hasPrintData = totalPeriodHours > 0 || allFilteredPrints.some(p => N(p.hours) > 0);
  const hasFilamentData = totalPeriodGrams > 0 || allFilteredPrints.some(p => N(p.grams) > 0);

  return {
    labels,
    printHours: printHours.map(v => Math.round(v * 10) / 10),
    filamentGrams: filamentGrams.map(v => Math.round(v)),
    materials: activeMaterials,
    materialMap,
    totalPeriodHours,
    totalPeriodGrams,
    hasPrintData,
    hasFilamentData
  };
}

function vDash() {
  const filteredPrints = getPrintsInTimeframe(chartRange);
  const prevPrints = getPrintsInPreviousTimeframe(chartRange);
  const getMiniBars = (val, activeBars = [30, 60, 45, 95, 80]) => N(val) > 0 ? activeBars : [14, 14, 14, 14, 14];

  // Phase 2 KPI 1: Active Models Printed (Filtered) / Total Products (All Time)
  const isAllTime = chartRange === "all";
  const uniqueModelKeys = new Set();
  filteredPrints.forEach(p => {
    const key = p.productId || (p.note ? p.note.trim().toLowerCase() : null) || p.id;
    if (key) uniqueModelKeys.add(key);
  });
  const totalProducts = isAllTime
    ? (S.products && S.products.length > 0 ? S.products.length : uniqueModelKeys.size)
    : uniqueModelKeys.size;
  const prevModelKeys = new Set();
  prevPrints.forEach(p => {
    const key = p.productId || (p.note ? p.note.trim().toLowerCase() : null) || p.id;
    if (key) prevModelKeys.add(key);
  });
  const prevTotalProducts = prevModelKeys.size;
  const trendProducts = calcTrend(totalProducts, prevTotalProducts, chartRange);
  const productsCardTitle = isAllTime ? "Total Products" : "Active Models Printed";
  const productsSubtitle = isAllTime
    ? `${S.products.length} models in catalog`
    : `${uniqueModelKeys.size} models active in period`;

  // Phase 2 KPI 2: Completed Jobs (Replacing misleading Printed Stock)
  const completedPrintsList = filteredPrints.filter(p => p.statusLabel === "Success" || (!p.statusLabel && N(p.qty) > 0));
  const completedJobs = completedPrintsList.length;
  const prevCompletedJobs = prevPrints.filter(p => p.statusLabel === "Success" || (!p.statusLabel && N(p.qty) > 0)).length;
  const trendCompleted = calcTrend(completedJobs, prevCompletedJobs, chartRange);
  const canceledCount = filteredPrints.reduce((acc, p) => acc + (p.statusLabel === "Canceled" || p.statusLabel === "Failed" || (!p.statusLabel && N(p.failed) > 0) ? 1 : 0), 0);

  // Phase 2 KPI 3: Total Print Jobs
  const totalPrintJobs = filteredPrints.length;
  const prevTotalPrintJobs = prevPrints.length;
  const trendPrintJobs = calcTrend(totalPrintJobs, prevTotalPrintJobs, chartRange);
  const printingCount = filteredPrints.filter(p => p.statusLabel === "Printing").length;

  const completionRate = totalPrintJobs > 0 ? Math.round((completedJobs / totalPrintJobs) * 100) : 0;
  const completedSubtitle = totalPrintJobs > 0
    ? `${completionRate}% completion rate`
    : "No print jobs in period";

  let periodJobsSubtitle = "No print jobs in period";
  if (totalPrintJobs > 0) {
    if (printingCount > 0) {
      periodJobsSubtitle = `${completedJobs} completed • ${printingCount} printing • ${canceledCount} failed`;
    } else {
      periodJobsSubtitle = `${completedJobs} completed • ${canceledCount} failed/canceled`;
    }
  }

  // Phase 2 KPI 4: Filament Used (Reconciled with material breakdown)
  const totalGramsUsed = filteredPrints.reduce((acc, p) => acc + N(p.grams), 0);
  const prevGramsUsed = prevPrints.reduce((acc, p) => acc + N(p.grams), 0);
  const trendFilament = calcTrend(totalGramsUsed, prevGramsUsed, chartRange);
  const filamentDisplay = formatSmartFilament(totalGramsUsed, true);
  const matMap = {};
  filteredPrints.forEach(p => {
    getMaterialsForPrint(p).forEach(item => {
      if (item.mat) {
        matMap[item.mat] = (matMap[item.mat] || 0) + item.weight;
      }
    });
  });
  const sortedMats = Object.entries(matMap)
    .filter(([_, g]) => g > 0)
    .sort((a, b) => b[1] - a[1]);
  const filamentSubtitle = sortedMats.length === 0
    ? "No filament recorded"
    : sortedMats.slice(0, 2).map(([m, g]) => `${m}: ${formatSmartFilament(g, false)}`).join(" • ");

  // Phase 2 KPI 5: Total Print Time & Duration Breakdown
  const totalHours = filteredPrints.reduce((acc, p) => acc + N(p.hours), 0);
  const prevTotalHours = prevPrints.reduce((acc, p) => acc + N(p.hours), 0);
  const trendHours = calcTrend(totalHours, prevTotalHours, chartRange);
  const totalHoursDisplay = `${totalHours.toFixed(1)} hrs`;

  const completedHours = completedPrintsList.reduce((acc, p) => acc + N(p.hours), 0);
  const failedHours = Math.max(0, totalHours - completedHours);
  const avgCompletedHours = completedJobs > 0 ? (completedHours / completedJobs).toFixed(1) : null;
  const avgAttemptHours = totalPrintJobs > 0 ? (totalHours / totalPrintJobs).toFixed(1) : "0.0";

  let periodHoursSubtitle = "No print hours in period";
  if (totalPrintJobs > 0) {
    if (avgCompletedHours && totalPrintJobs > completedJobs) {
      periodHoursSubtitle = `${avgCompletedHours}h completed avg • ${avgAttemptHours}h attempt avg`;
    } else if (avgCompletedHours) {
      periodHoursSubtitle = `${avgCompletedHours} hrs avg per print`;
    } else {
      periodHoursSubtitle = `${avgAttemptHours} hrs avg per attempt`;
    }
  }

  // Phase 3: Production Overview data (100% matched to filtered prints metrics)
  const prodSeries = getProductionTimeSeries(chartRange);
  const rangeLabels = { "24h": "Last 24 Hours", "7d": "Last 7 Days", "30d": "Last 30 Days", "12m": "Last 12 Months", "all": "All Time" };
  const periodLabel = rangeLabels[chartRange] || "Last 30 Days";
  const printHoursDisplay = totalHours.toFixed(1);
  const printHoursUnit = "hrs";

  let filamentGramsDisplay = "";
  let filamentGramsUnit = "";
  if (totalGramsUsed < 1000) {
    filamentGramsDisplay = totalGramsUsed % 1 === 0 ? totalGramsUsed.toFixed(0) : totalGramsUsed.toFixed(1);
    filamentGramsUnit = "g";
  } else {
    filamentGramsDisplay = (totalGramsUsed / 1000).toFixed(1);
    filamentGramsUnit = "kg";
  }

  const printTimeSubtitle = totalPrintJobs > 0 && failedHours > 0.05
    ? `${completedHours.toFixed(1)}h productive • ${failedHours.toFixed(1)}h aborted/failed`
    : `Duration trend (hours) across ${periodLabel.toLowerCase()}`;

  return `
  <!-- Phase 2: 5 3D Printing Studio KPI Cards -->
  <div class="dashboard-kpi-grid">
    ${pastelCard("mint", APP_ICONS.metricProducts, productsCardTitle, m0(totalProducts), productsSubtitle, getMiniBars(totalProducts, [35, 60, 45, 80, 95]), trendProducts)}
    ${pastelCard("coral", APP_ICONS.metricStock, "Completed Jobs", m0(completedJobs), completedSubtitle, getMiniBars(completedJobs, [60, 40, 75, 50, 85]), trendCompleted)}
    ${pastelCard("lavender", APP_ICONS.metricPrinted, "Total Print Jobs", m0(totalPrintJobs), periodJobsSubtitle, getMiniBars(totalPrintJobs, [25, 45, 35, 75, 60]), trendPrintJobs)}
    ${pastelCard("lime", APP_ICONS.metricFilament, "Filament Used", filamentDisplay, filamentSubtitle, getMiniBars(totalGramsUsed, [30, 50, 40, 85, 70]), trendFilament)}
    ${pastelCard("neutral", APP_ICONS.metricTime, "Total Print Time", totalHoursDisplay, periodHoursSubtitle, getMiniBars(totalHours, [40, 30, 60, 45, 75]), trendHours)}
  </div>

  <!-- Phase 3: Production Overview Section -->
  <section class="production-overview-section" aria-label="Production Overview Analytics">
    <div class="section-header-row">
      <div>
        <h2 class="section-heading">Production Overview</h2>
        <p class="section-subheading">Print time and filament consumption over the selected period</p>
      </div>
      <span class="badge neu date-range-pill">${APP_ICONS.metricTime(13, 2)} ${periodLabel}</span>
    </div>

    <div class="production-charts-grid">
      <!-- 1. Print Time Chart Card -->
      <div class="production-chart-card" id="printTimeCard">
        <div class="chart-card-header">
          <div class="chart-card-title-box">
            <div class="chart-card-icon mint">${APP_ICONS.metricTime(18, 2)}</div>
            <div>
              <h3 class="chart-card-title">Print Time</h3>
              <p class="chart-card-subtitle">${printTimeSubtitle}</p>
            </div>
          </div>
          <div class="chart-card-stat">
            <span class="stat-number">${printHoursDisplay}</span>
            <span class="stat-unit">${printHoursUnit}</span>
          </div>
        </div>
        <div class="chart-render-box" id="printTimeEchartBox">
          ${!prodSeries.hasPrintData ? `
            <div class="chart-empty-state">
              <div class="chart-empty-icon">${APP_ICONS.metricTime(22, 1.8)}</div>
              <p class="chart-empty-title">No print hours recorded</p>
              <p class="chart-empty-desc">Print logs created in ${periodLabel.toLowerCase()} will chart duration and printing trends automatically.</p>
            </div>
          ` : ""}
        </div>
      </div>

      <!-- 2. Filament Usage Chart Card -->
      <div class="production-chart-card" id="filamentUsageCard">
        <div class="chart-card-header">
          <div class="chart-card-title-box">
            <div class="chart-card-icon lime">${APP_ICONS.metricFilament(18, 2)}</div>
            <div>
              <h3 class="chart-card-title">Filament Usage</h3>
              <p class="chart-card-subtitle">Consumption & material breakdown for ${periodLabel.toLowerCase()}</p>
            </div>
          </div>
          <div class="chart-card-stat">
            <span class="stat-number">${filamentGramsDisplay}</span>
            <span class="stat-unit">${filamentGramsUnit}</span>
          </div>
        </div>
        <div class="chart-render-box" id="filamentUsageEchartBox">
          ${!prodSeries.hasFilamentData ? `
            <div class="chart-empty-state">
              <div class="chart-empty-icon">${APP_ICONS.metricFilament(22, 1.8)}</div>
              <p class="chart-empty-title">No filament consumption</p>
              <p class="chart-empty-desc">Logged filament usage by spool and material will appear here for ${periodLabel.toLowerCase()}.</p>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  </section>`;
}

const kpi = (l, v, s) => `<div class="kpi"><span class="l">${l}</span><span class="v">${v}</span><span class="s">${s}</span></div>`;

/* ---------- Apache ECharts Binding & Themes ---------- */
function getEchartsThemeColors() {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    isDark,
    axisColor: isDark ? "#9CD4D2" : "#506867",
    gridColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#D7E6E5",
    tooltipBg: isDark ? "#0E292D" : "#062C2F",
    tooltipBorder: isDark ? "#1F545C" : "transparent",
    tooltipText: isDark ? "#E9F6F6" : "#062C2F",
    primary: isDark ? "#5EEAD4" : "#062C2F",
    primaryArea: isDark ? "rgba(94, 234, 212, 0.35)" : "rgba(156, 212, 210, 0.45)",
    success: "#9CD4D2",
    warning: "#EDB2B7"
  };
}

function bindChart() {
  if (!window.echarts) return;
  const t = getEchartsThemeColors();

  // 1. Phase 3: Production Overview - Print Time Chart
  const printTimeBox = document.getElementById("printTimeEchartBox");
  if (printTimeBox) {
    if (chartPrintTimeInstance) {
      chartPrintTimeInstance.dispose();
      chartPrintTimeInstance = null;
    }
    const prodSeries = getProductionTimeSeries();
    if (prodSeries.hasPrintData) {
      chartPrintTimeInstance = echarts.init(printTimeBox);
      const printTimeOption = {
        animationDuration: 450,
        animationEasing: "cubicOut",
        grid: { left: 16, right: 32, top: 24, bottom: 12, containLabel: true },
        tooltip: {
          trigger: "axis",
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          borderWidth: t.isDark ? 1 : 0,
          borderRadius: 14,
          padding: [10, 14],
          textStyle: { color: "#FFFFFF", fontSize: 12, fontFamily: "'General Sans', sans-serif" },
          formatter: params => {
            const p = Array.isArray(params) ? params[0] : params;
            const val = N(p.value);
            const valStr = val >= 1
              ? `${val.toFixed(1)} hrs (${Math.floor(val)}h ${Math.round((val % 1) * 60)}m)`
              : val > 0
                ? `${Math.round(val * 60)} mins`
                : "0 hrs";
            return `
              <div style="font-weight:600; margin-bottom:4px; font-size:12.5px; color:#FFFFFF;">${esc(p.name)}</div>
              <div style="display:flex; align-items:center; gap:6px; color:#9CD4D2; font-size:12px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${t.isDark ? '#5EEAD4' : '#0D9488'};"></span>
                <span>Print Duration: <b style="color:#FFFFFF;">${valStr}</b></span>
              </div>
            `;
          }
        },
        xAxis: {
          type: "category",
          data: prodSeries.labels,
          boundaryGap: false,
          axisLine: { lineStyle: { color: t.gridColor } },
          axisTick: { show: false },
          axisLabel: {
            color: t.axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            margin: 10
          }
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { color: t.gridColor, type: "dashed" } },
          axisLabel: {
            color: t.axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            formatter: v => `${v} h`
          }
        },
        series: [
          {
            name: "Print Duration",
            type: "line",
            smooth: "monotone",
            data: prodSeries.printHours,
            symbol: "circle",
            symbolSize: 5,
            showSymbol: true,
            itemStyle: {
              color: t.isDark ? "#5EEAD4" : "#0D9488",
              borderWidth: 2,
              borderColor: t.isDark ? "#0E292D" : "#ffffff"
            },
            lineStyle: {
              color: t.isDark ? "#5EEAD4" : "#0D9488",
              width: 3
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: t.isDark ? "rgba(94, 234, 212, 0.35)" : "rgba(13, 148, 136, 0.28)" },
                { offset: 1, color: t.isDark ? "rgba(94, 234, 212, 0.01)" : "rgba(13, 148, 136, 0.01)" }
              ])
            },
            emphasis: {
              focus: "series",
              itemStyle: { borderWidth: 3, shadowBlur: 8, shadowColor: t.isDark ? "#5EEAD4" : "#0D9488" }
            }
          }
        ]
      };
      chartPrintTimeInstance.setOption(printTimeOption);
    }
  }

  // 4. Phase 3: Production Overview - Filament Usage Chart
  const filamentBox = document.getElementById("filamentUsageEchartBox");
  if (filamentBox) {
    if (chartFilamentUsageInstance) {
      chartFilamentUsageInstance.dispose();
      chartFilamentUsageInstance = null;
    }
    const prodSeries = getProductionTimeSeries();
    if (prodSeries.hasFilamentData) {
      chartFilamentUsageInstance = echarts.init(filamentBox);

      const MATERIAL_COLORS = {
        PLA: "#10B981",
        PETG: "#6366F1",
        ABS: "#F97316",
        TPU: "#EC4899",
        ASA: "#8B5CF6",
        RESIN: "#06B6D4",
        NYLON: "#EAB308",
        PC: "#3B82F6"
      };
      const FALLBACK_PALETTE = ["#10B981", "#6366F1", "#F97316", "#EC4899", "#06B6D4", "#8B5CF6"];

      const materialsWithData = (prodSeries.materials || []).filter(m => (prodSeries.materialMap[m] || []).some(g => g > 0));

      let filamentSeries = [];
      if (materialsWithData.length > 1) {
        filamentSeries = materialsWithData.map((mat, idx) => {
          const color = MATERIAL_COLORS[mat] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
          const isLast = idx === materialsWithData.length - 1;
          return {
            name: mat,
            type: "bar",
            stack: "filament",
            barMaxWidth: 26,
            itemStyle: {
              color: color,
              borderRadius: isLast ? [4, 4, 0, 0] : [0, 0, 0, 0]
            },
            data: prodSeries.materialMap[mat]
          };
        });
      } else {
        const singleMat = materialsWithData[0] || "Filament";
        const barColor = MATERIAL_COLORS[singleMat] || "#10B981";
        filamentSeries = [
          {
            name: singleMat,
            type: "bar",
            barMaxWidth: 26,
            showBackground: true,
            backgroundStyle: {
              color: t.isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(6, 44, 47, 0.04)",
              borderRadius: [4, 4, 0, 0]
            },
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: barColor },
                { offset: 1, color: t.isDark ? "rgba(16, 185, 129, 0.35)" : "rgba(16, 185, 129, 0.45)" }
              ]),
              borderRadius: [4, 4, 0, 0]
            },
            data: prodSeries.filamentGrams
          }
        ];
      }

      const filamentOption = {
        animationDuration: 450,
        animationEasing: "cubicOut",
        grid: { left: 16, right: 28, top: materialsWithData.length > 1 ? 36 : 24, bottom: 12, containLabel: true },
        legend: {
          show: materialsWithData.length > 1,
          top: 4,
          right: 12,
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: t.axisColor, fontSize: 11, fontFamily: "'General Sans', sans-serif" }
        },
        tooltip: {
          trigger: "axis",
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          borderWidth: t.isDark ? 1 : 0,
          borderRadius: 14,
          padding: [10, 14],
          textStyle: { color: "#FFFFFF", fontSize: 12, fontFamily: "'General Sans', sans-serif" },
          formatter: params => {
            const list = Array.isArray(params) ? params : [params];
            if (!list.length) return "";
            const name = list[0].name;
            let totalG = 0;
            const lines = list.filter(p => N(p.value) > 0).map(p => {
              const val = N(p.value);
              totalG += val;
              const valStr = val >= 1000 ? `${(val / 1000).toFixed(1)} kg` : `${Math.round(val)} g`;
              const dotColor = typeof p.color === "string" ? p.color : (p.color?.colorStops?.[0]?.color || "#10B981");
              return `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; font-size:11.5px; margin-top:2px;">
                  <span style="display:flex; align-items:center; gap:6px; color:#D1D5DB;">
                    <span style="width:7px; height:7px; border-radius:50%; background:${dotColor};"></span>
                    ${esc(p.seriesName)}
                  </span>
                  <b style="color:#FFFFFF;">${valStr}</b>
                </div>
              `;
            }).join("");

            const totalStr = totalG >= 1000 ? `${(totalG / 1000).toFixed(1)} kg` : `${Math.round(totalG)} g`;
            return `
              <div style="font-weight:600; margin-bottom:4px; font-size:12.5px; color:#FFFFFF;">${esc(name)}</div>
              ${lines || `<div style="font-size:11.5px; color:var(--muted)">0 g consumed</div>`}
              ${list.length > 1 && totalG > 0 ? `
                <div style="border-top:1px solid rgba(255,255,255,0.12); margin-top:6px; padding-top:4px; display:flex; justify-content:space-between; font-size:11.5px;">
                  <span style="color:#9CD4D2;">Total:</span>
                  <b style="color:#FFFFFF;">${totalStr}</b>
                </div>
              ` : ""}
            `;
          }
        },
        xAxis: {
          type: "category",
          data: prodSeries.labels,
          axisLine: { lineStyle: { color: t.gridColor } },
          axisTick: { show: false },
          axisLabel: {
            color: t.axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            margin: 10
          }
        },
        yAxis: {
          type: "value",
          splitLine: { lineStyle: { color: t.gridColor, type: "dashed" } },
          axisLabel: {
            color: t.axisColor,
            fontSize: 11,
            fontFamily: "'General Sans', sans-serif",
            formatter: v => v >= 1000 ? `${(v / 1000).toFixed(1)} kg` : `${v} g`
          }
        },
        series: filamentSeries
      };
      chartFilamentUsageInstance.setOption(filamentOption);
    }
  }
}

const handleDocChange = e => {
  if (e.target.id === "period" || e.target.id === "headerPeriodSelect") {
    period = e.target.value;
    render();
    return;
  }
  const sortSelect = e.target.closest("[data-prod-sort-select]");
  if (sortSelect) {
    const val = sortSelect.value;
    const parts = val.split("-");
    prodSortField = parts[0] || "printed";
    prodSortOrder = parts[1] || "desc";
    prodPage = 1;
    render();
    return;
  }
};
document.addEventListener("change", handleDocChange);

/* ==========================================================================
   Cost Calculator (Ditto Copy Logic + Modern Medsathi Cards)
   ========================================================================== */
let calc = { name: "", filamentId: "", costKg: "75", grams: 50, minutes: 120, laborMin: 10, packaging: 2, qty: 1, productId: "" };

function vCalc() {
  const st = set_();
  return `
    <div class="calc-page-wrapper">
      <div class="calc">
        <div class="panel">
          <div class="calc-card-header">
            <div class="calc-card-title-group">
              <div class="calc-header-icon">
                ${APP_ICONS.navCalc}
              </div>
              <div>
                <h3 class="calc-card-title">Print Parameters</h3>
                <div class="calc-card-desc">Item specifications & manufacturing inputs</div>
              </div>
            </div>
          </div>

          <div class="fgrid">
            <label class="f wide">Item name<input id="c_name" value="${esc(calc.name)}" placeholder="e.g. Dubai skyline lamp"></label>
            <label class="f wide">Load from existing product<select id="c_prod"><option value="">— new item —</option>${S.products.map(p => `<option value="${p.id}" ${p.id === calc.productId ? "selected" : ""}>${esc(cleanModelTitle(p.name))}</option>`).join("")}</select></label>
            <label class="f">Filament<select id="c_fil"><option value="">Custom price</option>${((S.filament_stock && S.filament_stock.length > 0) ? S.filament_stock : S.filaments).map(f => {
              const brand = f.brand || "";
              const mat = f.material || "PLA";
              const colName = f.colorName || "";
              const displayName = f.name || `${brand} ${mat} · ${colName}`.trim();
              const cost = N(f.price !== undefined ? f.price : (f.costPerSpool !== undefined ? f.costPerSpool : 75));
              const wt = N(f.weightG) || 1000;
              const rateKg = wt > 0 ? (cost / wt) * 1000 : 75;
              return `<option value="${f.id}" ${f.id === calc.filamentId ? "selected" : ""}>${esc(displayName)} (${m1(rateKg)}/kg)</option>`;
            }).join("")}</select></label>
            <label class="f">Filament price per kg (${cur()})<input id="c_costKg" type="number" step="0.01" value="${esc(calc.filamentId ? m1(filCostKg(byId("filaments", calc.filamentId))).replace(/,/g, "") : calc.costKg)}" ${calc.filamentId ? "disabled" : ""}></label>
            <label class="f">Filament per item (g)<input id="c_grams" type="number" step="0.1" value="${esc(calc.grams)}"></label>
            <label class="f">Print time per item (min)<input id="c_minutes" type="number" step="1" value="${esc(calc.minutes)}"></label>
            <label class="f">Hands-on time (min)<input id="c_laborMin" type="number" step="1" value="${esc(calc.laborMin)}"></label>
            <label class="f">Packaging & extras (${cur()})<input id="c_packaging" type="number" step="0.01" value="${esc(calc.packaging)}"></label>
            <label class="f">Quantity to quote<input id="c_qty" type="number" step="1" value="${esc(calc.qty)}"></label>
          </div>

          <div class="calc-rates-pill">
            <span>Using: printer ${st.kw} kW · electricity ${st.elecRate}/kWh · machine wear ${st.machineRate}/h · labour ${st.laborRate}/h · ${st.failPct}% failure allowance · agent +${st.agentMarkup}% · direct +${st.directMarkup}%. Change rates in Settings.</span>
          </div>
        </div>

        <div class="panel" id="calcOut"></div>
      </div>
    </div>
  `;
}

function calcResult() {
  const costKg = calc.filamentId ? filCostKg(byId("filaments", calc.filamentId)) : N(calc.costKg);
  return Object.assign(costParts(Object.assign({}, calc, { costKg })), { costKg });
}

function drawCalcOut() {
  const r = calcResult(), q = Math.max(1, N(calc.qty));
  const st = set_();

  const agentMargin = r.agent > 0 ? (((r.agent - r.total) / r.agent) * 100).toFixed(0) : 0;
  const directMargin = r.direct > 0 ? (((r.direct - r.total) / r.direct) * 100).toFixed(0) : 0;

  const rows = [
    { label: `Filament (${st.failPct}% failure allowance)`, val: r.material, color: "#5eead4" },
    { label: `Electricity (${st.kw} kW @ ${st.elecRate}/kWh)`, val: r.power, color: "#fcd34d" },
    { label: `Machine wear (${st.machineRate}/h)`, val: r.machine, color: "#93c5fd" },
    { label: `Labour (${st.laborRate}/h)`, val: r.labor, color: "#fca5a5" },
    { label: "Packaging & shipping extras", val: r.pack, color: "#c7d2fe" }
  ];

  $("#calcOut").innerHTML = `
    <div class="calc-card-header">
      <div class="calc-card-title-group">
        <div class="calc-header-icon">
          ${APP_ICONS.calcHeader}
        </div>
        <div>
          <h3 class="calc-card-title">Cost & Price Breakdown</h3>
          <div class="calc-card-desc">Unit manufacturing cost & recommended margins</div>
        </div>
      </div>
      <span class="pill neu" style="font-size:11px;font-weight:600;">1 unit</span>
    </div>

    <div class="calc-breakdown-list">
      ${rows.map(row => `
        <div class="calc-cost-row">
          <span class="calc-cost-label">
            <span class="calc-cost-dot" style="background:${row.color};"></span>
            ${esc(row.label)}
          </span>
          <span class="calc-cost-val num">${money(row.val)}</span>
        </div>
      `).join("")}
    </div>

    <div class="calc-total-banner">
      <div class="calc-total-left">
        <span class="calc-total-label">True Unit Cost</span>
        <span class="calc-total-sub">Overheads, wear & scrap included</span>
      </div>
      <div class="calc-total-price num">${money(r.total)}</div>
    </div>

    <div class="calc-pricing-grid">
      <!-- Agent / Wholesale Card -->
      <div class="calc-pricing-card agent">
        <div class="calc-pricing-top">
          <span class="calc-pricing-badge">Agent Wholesale</span>
          <span class="calc-markup-tag">+${st.agentMarkup}%</span>
        </div>
        <div class="calc-pricing-val num">${money(r.agent)}</div>
        <div class="calc-pricing-profit">
          <span class="profit-amount">+${money(r.agent - r.total)} profit</span>
          <span class="profit-margin">· ${agentMargin}% margin</span>
        </div>
      </div>

      <!-- Direct / Retail Card -->
      <div class="calc-pricing-card direct">
        <div class="calc-pricing-top">
          <span class="calc-pricing-badge">Direct Retail</span>
          <span class="calc-markup-tag highlight">+${st.directMarkup}%</span>
        </div>
        <div class="calc-pricing-val num">${money(r.direct)}</div>
        <div class="calc-pricing-profit">
          <span class="profit-amount">+${money(r.direct - r.total)} profit</span>
          <span class="profit-margin">· ${directMargin}% margin</span>
        </div>
      </div>
    </div>

    <div class="calc-batch-callout">
      <div class="calc-batch-header">
        ${APP_ICONS.calcBatch}
        <span>Batch Quote (${m0(q)} ${q > 1 ? "pcs" : "pc"})</span>
      </div>
      <div class="calc-batch-stats">
        <div class="batch-stat">
          <span class="stat-lbl">Batch Cost</span>
          <span class="stat-num num">${money(r.total * q)}</span>
        </div>
        <div class="batch-stat">
          <span class="stat-lbl">Agent Total</span>
          <span class="stat-num num">${money(r.agent * q)}</span>
        </div>
        <div class="batch-stat highlight">
          <span class="stat-lbl">Direct Total</span>
          <span class="stat-num num">${money(r.direct * q)}</span>
        </div>
        <div class="batch-stat">
          <span class="stat-lbl">Material</span>
          <span class="stat-num num">${m1(N(calc.grams) * q / 1000)} kg</span>
        </div>
        <div class="batch-stat">
          <span class="stat-lbl">Machine Time</span>
          <span class="stat-num num">${m1(N(calc.minutes) * q / 60)} h</span>
        </div>
      </div>
    </div>
  `;
}

function bindCalc() {
  drawCalcOut();
  ["name", "costKg", "grams", "minutes", "laborMin", "packaging", "qty"].forEach(k => {
    const el = $("#c_" + k);
    el && el.addEventListener("input", () => { calc[k] = el.value; drawCalcOut(); });
  });
  $("#c_fil").addEventListener("change", e => {
    calc.filamentId = e.target.value;
    if (calc.filamentId) {
      const f = byId("filaments", calc.filamentId);
      if (f) calc.costKg = filCostKg(f);
    }
    render();
  });
  $("#c_prod").addEventListener("change", e => {
    const p = byId("products", e.target.value);
    calc.productId = e.target.value;
    if (p) Object.assign(calc, { name: p.name, filamentId: p.filamentId || "", grams: p.grams, minutes: p.minutes, laborMin: p.laborMin, packaging: p.packaging });
    render();
  });
  const saveBtn = $("#calcSave");
  if (saveBtn) {
    saveBtn.onclick = () => {
      const r = calcResult();
      const p = calc.productId ? byId("products", calc.productId) : null;
      openForm("products", Object.assign({}, p || {}, {
        id: p ? p.id : undefined,
        name: calc.name || (p && p.name) || "",
        filamentId: calc.filamentId,
        grams: calc.grams,
        minutes: calc.minutes,
        laborMin: calc.laborMin,
        packaging: calc.packaging,
        costKgOverride: calc.filamentId ? "" : calc.costKg,
        agentPrice: (p && p.agentPrice) || r.agent.toFixed(2),
        directPrice: (p && p.directPrice) || r.direct.toFixed(2)
      }));
    };
  }
  const xlsBtn = $("#calcXls");
  if (xlsBtn) {
    xlsBtn.onclick = () => {
      exportCalcXls();
    };
  }
  const pdfBtn = $("#calcPdf");
  if (pdfBtn) {
    pdfBtn.onclick = () => {
      exportCalcPdf();
    };
  }
}

/* ==========================================================================
   Printed stock View (DESIGN.md Modern SaaS Standard — Verified Bambu Data)
   ========================================================================== */
let prodFilter = "all";
let prodSortField = "printed";
let prodSortOrder = "desc";
let prodViewMode = "grid";
let isRecoveringPhotos = false;
const PAGE_SIZE = 24;
let prodPage = 1;
let printPage = 1;

function renderPaginationBar({ currentPage, totalItems, pageSize = PAGE_SIZE, itemLabel = "items", dataAttr = "data-page" }) {
  if (totalItems <= 0) return "";
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(totalItems, safePage * pageSize);

  let pages = [];
  if (totalPages <= 5) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    if (safePage <= 3) {
      pages = [1, 2, 3, 4, "ellipsis", totalPages];
    } else if (safePage >= totalPages - 2) {
      pages = [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    } else {
      pages = [1, "ellipsis", safePage - 1, safePage, safePage + 1, "ellipsis", totalPages];
    }
  }

  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;

  return `
    <div class="table-pagination-footer" role="navigation" aria-label="${esc(itemLabel)} pagination">
      <div class="pagination-info">
        Showing <span class="pagination-range">${start}–${end}</span> of <span class="pagination-total">${totalItems}</span> ${esc(itemLabel)}
      </div>
      <div class="pagination-controls">
        <button type="button" class="btn sm pagination-btn pagination-prev" ${prevDisabled ? "disabled" : `${dataAttr}="prev"`} aria-label="Previous page">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span>Previous</span>
        </button>
        <div class="pagination-pages">
          ${pages.map(p => {
            if (p === "ellipsis") return `<span class="pagination-ellipsis" aria-hidden="true">…</span>`;
            const isActive = p === safePage;
            return `<button type="button" class="btn sm pagination-btn pagination-num ${isActive ? "active" : ""}" ${isActive ? 'aria-current="page"' : `${dataAttr}="${p}"`}>${p}</button>`;
          }).join("")}
        </div>
        <button type="button" class="btn sm pagination-btn pagination-next" ${nextDisabled ? "disabled" : `${dataAttr}="next"`} aria-label="Next page">
          <span>Next</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function renderProductPlaceholder(size = 48) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 4L42 14.3923V35.1769L24 45.5692L6 35.1769V14.3923L24 4Z" fill="currentColor" fill-opacity="0.04" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M24 4V24.5M24 24.5L42 14.5M24 24.5L6 14.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <path d="M24 24.5V45.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <path d="M15 19.5L24 24.5L33 19.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
    <path d="M24 14V24" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"/>
    <circle cx="24" cy="24.5" r="2.5" fill="currentColor" opacity="0.7"/>
  </svg>`;
}

function successfulPrintsOf(p) {
  return S.prints
    .filter(x => x.productId === p.id)
    .reduce((sum, x) => {
      if (x.statusLabel === "Printing") return sum;
      const q = N(x.qty);
      if (q > 0) return sum + q;
      if (x.statusLabel === "Success") return sum + 1;
      return sum;
    }, 0);
}

function totalPrintedOf(p) {
  const sp = successfulPrintsOf(p);
  if (sp !== undefined && sp !== null && sp > 0) return sp;
  return Number(p.totalPrinted) || 0;
}

function formatPrintDuration(mins) {
  const m = Math.round(N(mins));
  if (!m || m <= 0) return "—";
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h > 0 && remM > 0) return `${h}h ${remM}m`;
  if (h > 0) return `${h}h`;
  return `${remM}m`;
}

function formatWeight(grams) {
  const g = N(grams);
  if (!g || g <= 0) return "—";
  return `${m1(g).replace(/\.0$/, "")}g`;
}

function getProductAggregations(products, prints) {
  const stats = new Map();
  for (const p of products) {
    stats.set(p.id, {
      totalPrinted: Number(p.totalPrinted) || 0,
      totalGrams: 0,
      totalPrintMinutes: 0,
      successfulRuns: 0,
      failedRuns: 0,
      materials: new Set(),
      colors: new Map(),
      runs: [],
      latestPrintDate: null
    });
  }

  for (const x of prints) {
    if (!x.productId) continue;
    const s = stats.get(x.productId);
    if (!s) continue;

    s.runs.push(x);

    const isSuccess = x.statusLabel === "Success" || (x.statusLabel !== "Canceled" && x.statusLabel !== "Failed" && !N(x.failed) && N(x.qty) > 0);
    const isPrinting = x.statusLabel === "Printing" || x.status === "Printing";

    if (isSuccess && !isPrinting) {
      const q = N(x.qty) > 0 ? N(x.qty) : 1;
      s.totalPrinted += q;
      s.successfulRuns += 1;

      const g = N(x.grams);
      if (g > 0) s.totalGrams += g;

      const mins = N(x.hours) > 0 ? N(x.hours) * 60 : N(x.minutes);
      if (mins > 0) s.totalPrintMinutes += mins;
    } else if (!isPrinting) {
      s.failedRuns += 1;
    }

    if (Array.isArray(x.filamentsUsed) && x.filamentsUsed.length > 0) {
      for (const fu of x.filamentsUsed) {
        if (fu.type) s.materials.add(fu.type.trim());
        if (fu.color) s.colors.set(String(fu.color).toUpperCase(), fu.type || "PLA");
      }
    } else if (x.filamentId) {
      const f = byId("filaments", x.filamentId);
      if (f) {
        if (f.material) s.materials.add(f.material.trim());
        if (f.color) s.colors.set(String(f.color).toUpperCase(), f.material || "Filament");
      }
    }

    if (x.date && (!s.latestPrintDate || x.date > s.latestPrintDate)) {
      s.latestPrintDate = x.date;
    }
  }

  for (const p of products) {
    const s = stats.get(p.id);
    if (s.materials.size === 0) {
      const f = byId("filaments", p.filamentId);
      if (f && f.material) s.materials.add(f.material.trim());
      else if (p.material) s.materials.add(p.material.trim());
      else s.materials.add("PLA");
    }
    if (s.colors.size === 0) {
      const f = byId("filaments", p.filamentId);
      if (f && f.color) s.colors.set(String(f.color).toUpperCase(), f.material || "Filament");
    }
    if (s.totalGrams === 0 && N(p.grams) > 0 && s.totalPrinted > 0) {
      s.totalGrams = N(p.grams) * s.totalPrinted;
    }
    s.avgMinutes = s.successfulRuns > 0 ? (s.totalPrintMinutes / s.successfulRuns) : (N(p.minutes) || 0);
  }

  return stats;
}

function renderProductCard(p, stat) {
  const pv = photoSrc(p.photo);
  const title = cleanModelTitle(p.name || p.title || "Untitled Model");
  const sku = p.sku ? String(p.sku) : "";
  const cat = p.category ? String(p.category) : "";
  const totalUnits = stat ? stat.totalPrinted : 0;
  const isPrinted = totalUnits > 0;

  const mats = stat ? Array.from(stat.materials) : ["PLA"];
  const matText = mats.length > 0 ? mats.slice(0, 2).join(", ") + (mats.length > 2 ? ` +${mats.length - 2}` : "") : "PLA";

  const swatches = stat ? Array.from(stat.colors.keys()).slice(0, 4) : [];
  const extraSwatches = stat && stat.colors.size > 4 ? `+${stat.colors.size - 4}` : "";

  const totalRuns = stat ? (stat.successfulRuns + stat.failedRuns) : 0;
  const successRateText = totalRuns > 0 
    ? `${Math.round((stat.successfulRuns / totalRuns) * 100)}%` 
    : (isPrinted ? "100%" : "—");

  return `
    <div class="prod-card" data-prod-card-id="${p.id}" tabindex="0" role="button" aria-label="View details for ${esc(title)}">
      <div class="prod-card-thumb-area">
        <div class="prod-card-badges-top">
          ${sku ? `<span class="prod-card-sku-badge">${esc(sku)}</span>` : `<span></span>`}
          ${cat ? `<span class="prod-card-cat-badge">${esc(cat)}</span>` : `<span></span>`}
        </div>
        ${pv 
          ? `<img class="prod-card-thumb-img" src="${pv}" alt="${esc(title)}" loading="lazy">`
          : `<div class="prod-card-ph" title="No photo uploaded">${renderProductPlaceholder(52)}<span class="prod-card-ph-text">No Preview</span></div>`
        }
      </div>

      <div class="prod-card-body">
        <div class="prod-card-title" title="${esc(title)}">${esc(title)}</div>

        <div class="prod-card-fil-row">
          <span class="prod-card-mat-pill" title="${esc(mats.join(', ') || 'PLA')}">${esc(matText)}</span>
          <div class="prod-card-swatches-box" title="${stat ? Array.from(stat.colors.values()).join(', ') : ''}">
            ${swatches.map(hex => `<span class="prod-card-swatch-dot" style="background:${safeColor(hex)};"></span>`).join("")}
            ${extraSwatches ? `<span class="prod-card-swatch-more">${extraSwatches}</span>` : ""}
          </div>
        </div>

        <div class="prod-card-stats-grid">
          <div class="prod-card-stat-item">
            <span class="prod-card-stat-label">Printed</span>
            <span class="prod-card-stat-val ${isPrinted ? 'highlight' : ''}">${m0(totalUnits)} pcs</span>
          </div>
          <div class="prod-card-stat-item">
            <span class="prod-card-stat-label">Filament</span>
            <span class="prod-card-stat-val">${stat ? formatWeight(stat.totalGrams) : '—'}</span>
          </div>
          <div class="prod-card-stat-item">
            <span class="prod-card-stat-label">Avg Duration</span>
            <span class="prod-card-stat-val mono">${stat ? formatPrintDuration(stat.avgMinutes) : '—'}</span>
          </div>
          <div class="prod-card-stat-item">
            <span class="prod-card-stat-label">Success Rate</span>
            <span class="prod-card-stat-val">${successRateText}</span>
          </div>
        </div>
      </div>

      <div class="prod-card-footer">
        <button type="button" class="btn-prod-card-action" data-view-prod="${p.id}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          <span>View Details</span>
        </button>
        <button type="button" class="btn sm btn-action-icon danger" data-del="products" data-id="${p.id}" title="Delete model">
          ${APP_ICONS.btnDelete(13, 2)}
        </button>
      </div>
    </div>
  `;
}

function openProductDrawer(p) {
  if (!p) return;
  const statsMap = getProductAggregations(S.products, S.prints);
  const stat = statsMap.get(p.id) || {
    totalPrinted: Number(p.totalPrinted) || 0,
    totalGrams: 0,
    totalPrintMinutes: 0,
    successfulRuns: 0,
    failedRuns: 0,
    avgMinutes: N(p.minutes) || 0,
    materials: new Set(),
    colors: new Map(),
    runs: []
  };

  const pv = photoSrc(p.photo);
  const cleanTitle = cleanModelTitle(p.name || p.title || "Untitled Model");
  const totalRuns = stat.successfulRuns + stat.failedRuns;
  const successRate = totalRuns > 0 
    ? `${Math.round((stat.successfulRuns / totalRuns) * 100)}%` 
    : (stat.totalPrinted > 0 ? "100%" : "—");

  const runs = [...stat.runs].sort((a, b) => {
    const tB = new Date(b.date || b.endTime || b.startTime || 0).getTime();
    const tA = new Date(a.date || a.endTime || a.startTime || 0).getTime();
    return tB - tA;
  });

  const runRows = runs.map(run => {
    const isSuccess = run.statusLabel === "Success" || (run.statusLabel !== "Canceled" && run.statusLabel !== "Failed" && !N(run.failed) && N(run.qty) > 0);
    const isPrinting = run.statusLabel === "Printing" || run.status === "Printing";
    const statusText = run.statusLabel || (isSuccess ? "Success" : (N(run.failed) > 0 ? "Failed" : "Canceled"));
    const statusClass = isPrinting ? "warn" : (isSuccess ? "good" : "bad");
    const durMins = N(run.hours) > 0 ? N(run.hours) * 60 : N(run.minutes);
    const dateStr = run.date ? formatDateShort(run.date) : (run.startTime ? formatDateShort(run.startTime) : "—");

    return `
      <tr>
        <td style="font-weight:500;">${dateStr}</td>
        <td><span class="pill ${statusClass}" style="font-size:11px;">${esc(statusText)}</span></td>
        <td class="mono">${formatPrintDuration(durMins)}</td>
        <td class="mono">${formatWeight(run.grams)}</td>
        <td style="text-align:right;">
          <button type="button" class="btn sm" data-inspect-run-id="${run.id}" style="font-size:11px;padding:3px 8px;">
            Inspect
          </button>
        </td>
      </tr>
    `;
  }).join("");

  const estCost = ((stat.totalGrams / 1000) * 75).toFixed(2);

  const html = `
    <div class="scrim" id="prodDrawerScrim" role="dialog" aria-modal="true" aria-labelledby="prodDrawerTitle">
      <div class="prod-drawer-modal">
        <div class="prod-drawer-header">
          <div class="prod-drawer-title-box">
            <h3 class="prod-drawer-title" id="prodDrawerTitle">${esc(cleanTitle)}</h3>
            <div class="prod-drawer-badges">
              ${p.sku ? `<span class="prod-card-sku-badge">${esc(p.sku)}</span>` : ""}
              ${p.category ? `<span class="prod-card-cat-badge">${esc(p.category)}</span>` : ""}
            </div>
          </div>
          <button type="button" class="btn-dialog-close" id="prodDrawerCloseX" aria-label="Close dialog">✕</button>
        </div>

        <div class="prod-drawer-body">
          <div class="prod-drawer-split">
            <div class="prod-drawer-left">
              <div class="prod-drawer-img-wrap">
                ${pv 
                  ? `<img class="prod-drawer-img" src="${pv}" alt="${esc(cleanTitle)}">`
                  : `<div class="prod-card-ph">${renderProductPlaceholder(72)}<span class="prod-card-ph-text">No Preview Image</span></div>`
                }
              </div>
              <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;">
                <button type="button" class="btn sm" id="prodDrawerEditBtn" style="justify-content:center;width:100%;">
                  ${APP_ICONS.btnEdit(13, 2)} <span>Edit Details</span>
                </button>
                <button type="button" class="btn sm danger" id="prodDrawerDelBtn" style="justify-content:center;width:100%;">
                  ${APP_ICONS.btnDelete(13, 2)} <span>Delete Product</span>
                </button>
              </div>
            </div>

            <div class="prod-drawer-meta-panel">
              <div class="prod-drawer-metrics-grid">
                <div class="prod-drawer-metric-tile">
                  <span class="prod-drawer-metric-label">Total Printed</span>
                  <span class="prod-drawer-metric-val primary">${m0(stat.totalPrinted)} pcs</span>
                  <span class="prod-drawer-metric-sub">${stat.successfulRuns} successful print runs</span>
                </div>
                <div class="prod-drawer-metric-tile">
                  <span class="prod-drawer-metric-label">Total Filament Consumed</span>
                  <span class="prod-drawer-metric-val">${formatWeight(stat.totalGrams)}</span>
                  <span class="prod-drawer-metric-sub">Est. cost: AED ${estCost}</span>
                </div>
                <div class="prod-drawer-metric-tile">
                  <span class="prod-drawer-metric-label">Avg Print Duration</span>
                  <span class="prod-drawer-metric-val mono">${formatPrintDuration(stat.avgMinutes)}</span>
                  <span class="prod-drawer-metric-sub">Slicer estimate: ${formatPrintDuration(p.minutes)}</span>
                </div>
                <div class="prod-drawer-metric-tile">
                  <span class="prod-drawer-metric-label">Success Rate</span>
                  <span class="prod-drawer-metric-val">${successRate}</span>
                  <span class="prod-drawer-metric-sub">${stat.failedRuns} failed or canceled runs</span>
                </div>
              </div>

              <div style="display:flex;flex-direction:column;gap:6px;background:var(--color-bg-secondary, rgba(0,0,0,0.02));border:1px solid var(--color-border);border-radius:9px;padding:10px 14px;font-size:12px;">
                <div style="display:flex;justify-content:space-between;">
                  <span class="muted">Materials Used:</span>
                  <span style="font-weight:600;">${esc(Array.from(stat.materials).join(', ') || 'PLA')}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span class="muted">Unit Slicer Weight:</span>
                  <span class="mono" style="font-weight:600;">${formatWeight(p.grams)}</span>
                </div>
                ${p.price ? `
                  <div style="display:flex;justify-content:space-between;">
                    <span class="muted">List Price:</span>
                    <span style="font-weight:600;color:var(--color-brand,#059669);">AED ${Number(p.price).toFixed(2)}</span>
                  </div>
                ` : ""}
              </div>
            </div>
          </div>

          <div>
            <div class="prod-drawer-section-title">
              <span>Historical Print Runs (${runs.length})</span>
            </div>
            ${runs.length > 0 ? `
              <table class="prod-drawer-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Filament</th>
                    <th style="text-align:right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${runRows}
                </tbody>
              </table>
            ` : `
              <div class="empty-state-box" style="padding:24px;text-align:center;background:var(--color-bg-secondary, rgba(0,0,0,0.02));border:1px solid var(--color-border);border-radius:10px;">
                <p class="muted" style="margin:0;font-size:12.5px;">No print jobs linked to this product yet.</p>
              </div>
            `}
          </div>
        </div>

        <div class="prod-drawer-footer">
          <span class="muted" style="font-size:12px;">Product ID: <span class="mono">${esc(p.id)}</span></span>
          <button type="button" class="btn btn-pill" id="prodDrawerCloseBtn">Close</button>
        </div>
      </div>
    </div>
  `;

  $("#modalRoot").innerHTML = html;

  const close = () => { closeModal(); };
  const closeBtn = $("#prodDrawerCloseBtn");
  const closeX = $("#prodDrawerCloseX");
  const scrim = $("#prodDrawerScrim");
  const editBtn = $("#prodDrawerEditBtn");
  const delBtn = $("#prodDrawerDelBtn");

  if (closeBtn) closeBtn.onclick = close;
  if (closeX) closeX.onclick = close;
  if (scrim) {
    scrim.onclick = (e) => {
      if (e.target === scrim) close();
    };
  }
  if (editBtn) {
    editBtn.onclick = () => {
      closeModal();
      openForm("products", p);
    };
  }
  if (delBtn) {
    delBtn.onclick = () => {
      closeModal();
      openDeleteModal("products", p.id);
    };
  }

  const inspectBtns = document.querySelectorAll("[data-inspect-run-id]");
  inspectBtns.forEach(btn => {
    btn.onclick = () => {
      const runId = btn.dataset.inspectRunId;
      const run = byId("prints", runId);
      if (run) {
        closeModal();
        setTimeout(() => openPrintDetailsModal(run), 40);
      }
    };
  });
}

async function backfillProductPhotos() {
  if (isRecoveringPhotos) return;
  isRecoveringPhotos = true;
  render();
  notify({
    type: "info",
    title: "Recovering Photos",
    message: "Scanning Bambu Cloud print tasks for model cover thumbnails..."
  });

  try {
    const res = await fetch("/api/bambu/sync?action=backfill-photos", { method: "POST" });
    const json = await res.json();
    if (json.ok) {
      notify({
        type: "good",
        title: "Photo Recovery Complete",
        message: `Updated ${json.updatedCount || 0} missing product photos from Bambu Cloud tasks.`
      });
      await loadLedgerData(true);
    } else {
      notify({
        type: "bad",
        title: "Photo Recovery Failed",
        message: json.error || "Unable to recover photos from Bambu Cloud."
      });
    }
  } catch (err) {
    notify({
      type: "bad",
      title: "Sync Error",
      message: err.message || "Failed to reach Bambu Cloud sync endpoint."
    });
  } finally {
    isRecoveringPhotos = false;
    render();
  }
}

function vProducts() {
  const allProds = [...S.products];
  const statsMap = getProductAggregations(allProds, S.prints);

  const printedProds = allProds.filter(p => (statsMap.get(p.id)?.totalPrinted || 0) >= 1);
  const zeroProds = allProds.filter(p => (statsMap.get(p.id)?.totalPrinted || 0) === 0);
  const missingPhotoProds = allProds.filter(p => !photoSrc(p.photo));

  const list = allProds.filter(p => {
    const stat = statsMap.get(p.id);
    const sp = stat ? stat.totalPrinted : 0;
    if (prodFilter === "printed") return sp >= 1;
    if (prodFilter === "zero") return sp === 0;
    if (prodFilter === "missing-photo") return !photoSrc(p.photo);
    return true;
  }).filter(p => match("p", p.name, p.sku, p.category));

  // Sorting
  list.sort((a, b) => {
    const statA = statsMap.get(a.id);
    const statB = statsMap.get(b.id);
    
    if (prodSortField === "filament") {
      const gA = statA ? statA.totalGrams : 0;
      const gB = statB ? statB.totalGrams : 0;
      if (gA !== gB) return prodSortOrder === "desc" ? gB - gA : gA - gB;
    } else if (prodSortField === "name") {
      const nameA = cleanModelTitle(a.name || a.title || "");
      const nameB = cleanModelTitle(b.name || b.title || "");
      const comp = nameA.localeCompare(nameB);
      if (comp !== 0) return prodSortOrder === "desc" ? -comp : comp;
    } else {
      // Default: "printed"
      const countA = statA ? statA.totalPrinted : 0;
      const countB = statB ? statB.totalPrinted : 0;
      if (countA !== countB) {
        return prodSortOrder === "desc" ? countB - countA : countA - countB;
      }
    }
    const nameA = cleanModelTitle(a.name || a.title || "");
    const nameB = cleanModelTitle(b.name || b.title || "");
    return nameA.localeCompare(nameB);
  });

  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (prodPage > totalPages) prodPage = totalPages;
  if (prodPage < 1) prodPage = 1;
  const startIdx = (prodPage - 1) * PAGE_SIZE;
  const paginatedList = list.slice(startIdx, startIdx + PAGE_SIZE);

  // Cards Grid HTML
  const cardsHtml = paginatedList.map(p => renderProductCard(p, statsMap.get(p.id))).join("");

  // Table rows HTML
  const rows = paginatedList.map(p => {
    const pv = photoSrc(p.photo);
    const stat = statsMap.get(p.id);
    const successfulPrints = stat ? stat.totalPrinted : 0;
    const statusClass = successfulPrints > 0 ? "good" : "bad";
    const statusText = `${m0(successfulPrints)} pcs`;

    let filDisplay = "";
    const mats = stat ? Array.from(stat.materials) : [];
    const swatches = stat ? Array.from(stat.colors.keys()).slice(0, 3) : [];
    if (mats.length > 0 || swatches.length > 0) {
      const swatchDots = swatches.map(c => `<span class="swatch" style="background:${safeColor(c)}"></span>`).join("");
      filDisplay = `${swatchDots}<span class="prod-fil-name">${esc(mats.join(", ") || "Filament")}</span>`;
    } else {
      filDisplay = `<span class="muted">—</span>`;
    }

    return `
      <tr class="prod-table-row" data-prod-row-id="${p.id}" style="cursor:pointer;" title="Click to view product details">
        <td>
          ${pv ? `<img class="prod-thumb" src="${pv}" alt="${esc(p.name)}">` : `<div class="prod-thumb ph" title="No photo uploaded">${renderProductPlaceholder(24)}</div>`}
        </td>
        <td>
          <div class="prod-item-cell">
            <div class="prod-name-wrap">
              <span class="prod-name">${esc(cleanModelTitle(p.name))}</span>
              ${exMark(p)}
            </div>
            <div class="prod-sku-cat">
              ${p.sku ? `<span class="prod-sku mono">${esc(p.sku)}</span>` : ""}
              ${p.sku && p.category ? `<span class="meta-dot">·</span>` : ""}
              ${p.category ? `<span class="prod-cat">${esc(p.category)}</span>` : ""}
            </div>
          </div>
        </td>
        <td>
          <div class="prod-fil-wrap">
            ${filDisplay}
          </div>
        </td>
        <td class="n">
          <span class="num">${stat ? formatWeight(stat.totalGrams) : "—"}</span>
        </td>
        <td class="n">
          <span class="num mono">${stat ? formatPrintDuration(stat.avgMinutes) : "—"}</span>
        </td>
        <td class="n">
          <span class="pill ${statusClass}">${statusText}</span>
        </td>
        <td class="act">
          <div class="tbl-actions-group">
            <button class="btn sm" data-view-prod="${p.id}" title="View product details">Details</button>
            <button class="btn sm btn-action-icon danger" data-del="products" data-id="${p.id}" title="Delete product">${APP_ICONS.btnDelete(13, 2)}</button>
          </div>
        </td>
      </tr>
    `;
  });

  const totalPrintedHeader = `#<span class="sortable-header" data-toggle-prod-sort title="Click to toggle sort order">Total printed <span class="sort-dir-arrow">${prodSortOrder === "desc" ? "↓" : "↑"}</span></span>`;

  const emptyMsg = allProds.length === 0 
    ? "No models in product catalogue yet. Click 'Sync Bambu' to get started." 
    : "No items match this filter.";

  return `
    <div class="prod-page-wrapper">
      <!-- Interactive Filter Toolbar -->
      <div class="inv-toolbar-panel">
        <div class="inv-toolbar-left">
          <div class="inv-filter-segmented">
            <button type="button" class="inv-filter-btn ${prodFilter === "all" ? "active" : ""}" data-prod-filter="all">
              All <span class="filter-count">${allProds.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${prodFilter === "printed" ? "active" : ""}" data-prod-filter="printed">
              Printed (1+) <span class="filter-count">${printedProds.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${prodFilter === "zero" ? "active" : ""}" data-prod-filter="zero">
              Failed / 0 Prints <span class="filter-count alert ${zeroProds.length ? "active" : ""}">${zeroProds.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${prodFilter === "missing-photo" ? "active" : ""}" data-prod-filter="missing-photo" title="Products with missing photo thumbnails">
              Missing Photos <span class="filter-count ${missingPhotoProds.length ? "active" : ""}">${missingPhotoProds.length}</span>
            </button>
          </div>
        </div>

        <div class="inv-toolbar-right">
          <div class="search-wrap inv-search-wrap">
            ${APP_ICONS.search}
            <input class="search" id="q_p" placeholder="Search catalogue models, SKU, category..." value="${esc(q.p || "")}" data-q="p" aria-label="Search product catalogue">
            ${q.p ? `<button type="button" class="search-clear" data-qclr="p" title="Clear search">✕</button>` : ""}
          </div>

          <!-- Sort Select Dropdown -->
          <select class="prod-sort-select" data-prod-sort-select title="Sort models">
            <option value="printed-desc" ${prodSortField === 'printed' && prodSortOrder === 'desc' ? 'selected' : ''}>Most Printed</option>
            <option value="printed-asc" ${prodSortField === 'printed' && prodSortOrder === 'asc' ? 'selected' : ''}>Least Printed</option>
            <option value="filament-desc" ${prodSortField === 'filament' && prodSortOrder === 'desc' ? 'selected' : ''}>Highest Filament (g)</option>
            <option value="name-asc" ${prodSortField === 'name' && prodSortOrder === 'asc' ? 'selected' : ''}>Name (A → Z)</option>
            <option value="name-desc" ${prodSortField === 'name' && prodSortOrder === 'desc' ? 'selected' : ''}>Name (Z → A)</option>
          </select>

          <!-- View Mode Toggle (Cards vs Table) -->
          <div class="prod-view-mode-toggle" role="group" aria-label="Catalogue view style">
            <button type="button" class="prod-view-btn ${prodViewMode === 'grid' ? 'active' : ''}" data-prod-view="grid" title="Cards grid view">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>
              <span>Cards</span>
            </button>
            <button type="button" class="prod-view-btn ${prodViewMode === 'table' ? 'active' : ''}" data-prod-view="table" title="Table list view">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm1.5 1v3h13V3a.5.5 0 0 0-.5-.5H2a.5.5 0 0 0-.5.5zm13 4h-13v6a.5.5 0 0 0 .5.5H7V7h7.5zm-8.5 7.5V7H1.5v6.5a.5.5 0 0 0 .5.5h4z"/></svg>
              <span>Table</span>
            </button>
          </div>

          <!-- Recover Photos Button -->
          <button type="button" class="btn btn-pill" id="recoverPhotosBtn" data-recover-photos title="Recover missing product thumbnails from Bambu Cloud tasks" ${isRecoveringPhotos ? "disabled" : ""}>
            <svg class="${isRecoveringPhotos ? 'spinning' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span>${isRecoveringPhotos ? "Recovering..." : "Recover Photos"}</span>
          </button>
        </div>
      </div>

      <!-- Main Catalogue Content (Grid vs Table) -->
      ${prodViewMode === "grid" ? (
        list.length === 0 ? `
          <div class="empty-state-box" style="padding:56px 24px;text-align:center;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;">
            <p class="muted" style="font-size:14px;margin:0;">${esc(emptyMsg)}</p>
          </div>
        ` : `
          <div class="prod-cards-grid">
            ${cardsHtml}
          </div>
        `
      ) : (
        table(["Photo", "Model & SKU", "Filament", "#Total Filament", "#Avg Print Time", totalPrintedHeader, ""], rows, emptyMsg)
      )}

      <!-- Pagination -->
      ${renderPaginationBar({
        currentPage: prodPage,
        totalItems,
        pageSize: PAGE_SIZE,
        itemLabel: "models",
        dataAttr: "data-prod-page"
      })}
    </div>
  `;
}

/* ==========================================================================
   Filament inventory View (Dedicated Manual Filament Stock Catalog)
   ========================================================================== */
let filFilter = "all";
let filViewMode = "grid";
function vFil() {
  const items = S.filament_stock || [];

  const allFils = items.slice().sort((a, b) => {
    const tB = new Date(b.updatedAt || b.purchasedAt || 0).getTime();
    const tA = new Date(a.updatedAt || a.purchasedAt || 0).getTime();
    return tB - tA;
  });

  // Dynamically extract unique materials from catalog records
  const uniqueMaterials = Array.from(new Set(allFils.map(f => (f.material || "PLA").toUpperCase()))).filter(Boolean);
  const materialFilters = ["all", ...uniqueMaterials];

  if (filFilter !== "all" && !uniqueMaterials.map(m => m.toLowerCase()).includes(filFilter.toLowerCase())) {
    filFilter = "all";
  }

  const list = allFils.filter(f => {
    if (filFilter !== "all") {
      const mat = (f.material || "PLA").toUpperCase();
      return mat === filFilter.toUpperCase();
    }
    return true;
  }).filter(f => match("f", f.name, f.material, f.brand, f.colorName, f.color, f.temp, f.notes, f.diameter));

  // 1. Table rows with 3D spool thumbnails
  const rows = list.map(f => {
    const brand = f.brand || "Custom";
    const mat = f.material || "PLA";
    const color = safeColor(f.color || "#A03CF7");
    const colorName = f.colorName || getFilamentColorName(color);
    const diameter = f.diameter || "1.75 mm";
    const weightG = N(f.weightG) || 1000;
    const qty = Math.max(1, N(f.quantity !== undefined ? f.quantity : (f.spoolQty !== undefined ? f.spoolQty : 1)));
    const price = N(f.price !== undefined ? f.price : (f.costPerSpool !== undefined ? f.costPerSpool : 75));
    const totalWeightG = qty * weightG;
    const totalVal = qty * price;
    const rateKg = weightG > 0 ? (price / weightG) * 1000 : 75;
    const tempOrNotes = f.temp || f.notes || "";

    const weightDisplay = weightG >= 1000 ? `${(weightG / 1000).toFixed(1)} kg` : `${weightG} g`;
    const totalWeightDisplay = (totalWeightG / 1000).toFixed(2);

    return `
      <tr class="fil-table-row">
        <td>
          <div class="fil-table-spool-cell">
            <div class="fil-table-spool-thumb" title="${esc(brand)} ${esc(mat)} (${esc(colorName)})">
              ${renderFilamentSpool({ color, colorName, material: mat, size: 40 })}
            </div>
            <div class="fil-item-cell">
              <div class="fil-name-wrap">
                <span class="fil-name">${esc(colorName)}</span>
              </div>
              <div class="fil-meta">
                <span class="fil-brand-pill">${esc(brand)}</span>
                <span class="fil-mat">${esc(mat)}</span>
                <span class="meta-dot">·</span>
                <span class="fil-hex mono">${esc(color)}</span>
              </div>
            </div>
          </div>
        </td>
        <td>
          <div class="fil-spec-cell">
            <span class="fil-spec-main mono">${esc(diameter)} · ${esc(weightDisplay)}</span>
            ${tempOrNotes ? `<span class="fil-temp-sub muted mono">${esc(tempOrNotes)}</span>` : ""}
          </div>
        </td>
        <td class="n">
          <div class="stock-qty-cell">
            <span class="num">${qty} spool${qty !== 1 ? 's' : ''}</span>
            <span class="stock-sub muted mono">${totalWeightDisplay} kg</span>
          </div>
        </td>
        <td class="n">
          <div class="stock-price-cell">
            <span class="num">${price.toFixed(2)} ${cur()}</span>
            <span class="stock-sub muted">per spool</span>
          </div>
        </td>
        <td class="n">
          <div class="stock-total-cell">
            <span class="num highlight-val">${totalVal.toFixed(2)} ${cur()}</span>
            <span class="stock-sub muted mono">${rateKg.toFixed(2)} ${cur()}/kg</span>
          </div>
        </td>
        <td class="act">
          <div class="tbl-actions-group">
            <button type="button" class="btn sm btn-action-icon" data-edit-fil="${esc(f.id)}" title="Edit filament spool">${APP_ICONS.btnEdit(13, 2)}</button>
            <button type="button" class="btn sm btn-action-icon danger" data-del-fil="${esc(f.id)}" title="Delete filament spool">${APP_ICONS.btnDelete(13, 2)}</button>
          </div>
        </td>
      </tr>
    `;
  });

  // 2. Cards Grid with prominent 3D spools
  const cardsHtml = list.map(f => {
    const brand = f.brand || "Custom";
    const mat = f.material || "PLA";
    const color = safeColor(f.color || "#A03CF7");
    const colorName = f.colorName || getFilamentColorName(color);
    const diameter = f.diameter || "1.75 mm";
    const weightG = N(f.weightG) || 1000;
    const qty = Math.max(1, N(f.quantity !== undefined ? f.quantity : (f.spoolQty !== undefined ? f.spoolQty : 1)));
    const price = N(f.price !== undefined ? f.price : (f.costPerSpool !== undefined ? f.costPerSpool : 75));
    const totalWeightG = qty * weightG;
    const totalVal = qty * price;
    const rateKg = weightG > 0 ? (price / weightG) * 1000 : 75;
    const tempOrNotes = f.temp || f.notes || "";

    const weightDisplay = weightG >= 1000 ? `${(weightG / 1000).toFixed(1)} kg` : `${weightG} g`;
    const totalWeightDisplay = (totalWeightG / 1000).toFixed(2);

    return `
      <div class="fil-card" data-fil-card-id="${esc(f.id)}">
        <div class="fil-card-spool-area">
          <div class="fil-card-badges-top">
            <span class="fil-card-brand-badge">${esc(brand)}</span>
            <span class="fil-card-mat-badge">${esc(mat)}</span>
          </div>
          <div class="fil-card-spool-wrap" title="${esc(brand)} ${esc(mat)} · ${esc(colorName)}">
            ${renderFilamentSpool({
              color,
              colorName,
              material: mat,
              size: 130
            })}
          </div>
        </div>

        <div class="fil-card-body">
          <div class="fil-card-title-row">
            <span class="fil-card-color-name" title="${esc(colorName)}">${esc(colorName)}</span>
            <span class="fil-card-hex-pill" title="Color hex code">
              <span class="fil-card-hex-dot" style="background:${color};"></span>
              <span>${esc(color)}</span>
            </span>
          </div>

          <div class="fil-card-specs-row">
            <span>${esc(diameter)}</span>
            <span>·</span>
            <span>${esc(weightDisplay)}</span>
            ${tempOrNotes ? `<span>·</span><span class="muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(tempOrNotes)}</span>` : ""}
          </div>

          <div class="fil-card-stats-grid">
            <div class="fil-card-stat-item">
              <span class="fil-card-stat-label">In Stock</span>
              <span class="fil-card-stat-val">${qty} spool${qty !== 1 ? 's' : ''}</span>
              <span class="stock-sub mono">${totalWeightDisplay} kg</span>
            </div>
            <div class="fil-card-stat-item" style="text-align:right;">
              <span class="fil-card-stat-label">Unit Price</span>
              <span class="fil-card-stat-val">${price.toFixed(2)} ${cur()}</span>
              <span class="stock-sub">per spool</span>
            </div>
            <div class="fil-card-stat-item">
              <span class="fil-card-stat-label">Total Value</span>
              <span class="fil-card-stat-val primary">${totalVal.toFixed(2)} ${cur()}</span>
            </div>
            <div class="fil-card-stat-item" style="text-align:right;">
              <span class="fil-card-stat-label">Rate</span>
              <span class="fil-card-stat-val mono" style="font-size:12px;">${rateKg.toFixed(2)}</span>
              <span class="stock-sub mono">${cur()}/kg</span>
            </div>
          </div>
        </div>

        <div class="fil-card-footer">
          <button type="button" class="btn sm btn-pill" data-edit-fil="${esc(f.id)}" title="Edit filament spool" style="display:inline-flex;align-items:center;gap:5px;">
            ${APP_ICONS.btnEdit(13, 2)}
            <span>Edit</span>
          </button>
          <button type="button" class="btn sm btn-pill danger" data-del-fil="${esc(f.id)}" title="Delete filament spool" style="display:inline-flex;align-items:center;gap:5px;">
            ${APP_ICONS.btnDelete(13, 2)}
            <span>Delete</span>
          </button>
        </div>
      </div>
    `;
  }).join("");

  const filterTabsHtml = materialFilters.map(m => {
    const isAll = m === "all";
    const label = isAll ? "All" : m;
    const count = isAll ? allFils.length : allFils.filter(f => (f.material || "PLA").toUpperCase() === m).length;
    const isActive = filFilter.toLowerCase() === m.toLowerCase();
    return `
      <button type="button" class="inv-filter-btn ${isActive ? "active" : ""}" data-fil-filter="${esc(m.toLowerCase())}">
        ${esc(label)} <span class="filter-count">${count}</span>
      </button>
    `;
  }).join("");

  const emptyMsg = allFils.length === 0 ? "No filaments in catalog. Click '+ Add Filament' to add your first spool." : "No filaments match this filter.";

  return `
    <div class="fil-page-wrapper">
      <!-- Interactive Filter Toolbar -->
      <div class="inv-toolbar-panel">
        <div class="inv-toolbar-left">
          <div class="inv-filter-segmented">
            ${filterTabsHtml}
          </div>
        </div>

        <div class="inv-toolbar-right">
          <div class="search-wrap inv-search-wrap">
            ${APP_ICONS.search}
            <input class="search" id="q_f" placeholder="Search filaments, brand, color..." value="${esc(q.f || "")}" data-q="f" aria-label="Search filaments">
            ${q.f ? `<button type="button" class="search-clear" data-qclr="f" title="Clear search">✕</button>` : ""}
          </div>

          <!-- View Mode Toggle -->
          <div class="fil-view-mode-toggle" role="group" aria-label="Catalog view style">
            <button type="button" class="fil-view-btn ${filViewMode === 'grid' ? 'active' : ''}" data-fil-view="grid" title="Cards grid view">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/></svg>
              <span>Cards</span>
            </button>
            <button type="button" class="fil-view-btn ${filViewMode === 'table' ? 'active' : ''}" data-fil-view="table" title="Table list view">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm1.5 1v3h13V3a.5.5 0 0 0-.5-.5H2a.5.5 0 0 0-.5.5zm13 4h-13v6a.5.5 0 0 0 .5.5H7V7h7.5zm-8.5 7.5V7H1.5v6.5a.5.5 0 0 0 .5.5h4z"/></svg>
              <span>Table</span>
            </button>
          </div>

          <button type="button" class="btn pri btn-pill-primary" id="addSpoolBtn" style="white-space:nowrap;display:inline-flex;align-items:center;gap:6px;">
            ${APP_ICONS.feedSpool(15, 2)}
            <span>+ Add Filament</span>
          </button>
        </div>
      </div>

      <!-- Filament View Content (Cards vs Table) -->
      ${filViewMode === "grid" ? (
        list.length === 0 ? `
          <div class="empty-state-box" style="padding:56px 24px;text-align:center;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;">
            <p class="muted" style="font-size:14px;margin:0;">${esc(emptyMsg)}</p>
          </div>
        ` : `
          <div class="fil-cards-grid">
            ${cardsHtml}
          </div>
        `
      ) : (
        table(["Filament", "Specifications", "#Quantity", "#Unit Price", "#Total Value", ""], rows, emptyMsg)
      )}
    </div>
  `;
}

/* ==========================================================================
   Print log View (DESIGN.md Modern SaaS Standard)
   ========================================================================== */
function renderPrintStatusBadge(p) {
  if (!p) return `<span class="pill neu print-status-pill">—</span>`;
  const norm = p.statusLabel || (N(p.qty) > 0 ? "Success" : (N(p.failed) > 0 ? "Failed" : "Canceled"));

  if (norm === "Printing") {
    return `
      <span class="pill print-status-pill print-status-printing" title="Active 3D printing in progress">
        <span class="printer-animated-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path class="printer-frame" d="M2.5 14V3.5C2.5 3 2.9 2.5 3.5 2.5H12.5C13.1 2.5 13.5 3 13.5 3.5V14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/>
            <line class="printer-bed" x1="1.5" y1="14" x2="14.5" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <line class="extruded-layer" x1="3.5" y1="11.5" x2="12.5" y2="11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <g class="extruder-carriage">
              <rect x="6" y="4" width="4" height="2.8" rx="0.6" fill="currentColor"/>
              <path d="M6.8 6.8L8 9L9.2 6.8Z" fill="currentColor"/>
              <circle class="nozzle-glow" cx="8" cy="9.6" r="0.8" fill="#10B981"/>
            </g>
          </svg>
        </span>
        <span class="print-status-text">Printing</span>
      </span>
    `;
  }

  const isSuccess = norm === "Success";
  const isFailed = norm === "Failed";
  const statusClass = isSuccess ? "good" : (isFailed ? "bad" : "warn");
  return `<span class="pill ${statusClass} print-status-pill">${esc(norm)}</span>`;
}

let printFilter = "all";
function vPrints() {
  const allPrints = [...S.prints];
  const isP = p => p.statusLabel === "Printing" || p.status === "Printing";
  const isS = p => (p.statusLabel === "Success" || p.status === "Success") || (!p.statusLabel && !p.status && !N(p.failed) && N(p.qty) > 0);
  const isF = p => p.statusLabel === "Canceled" || p.status === "Canceled" || p.statusLabel === "Failed" || p.status === "Failed" || (!p.statusLabel && !p.status && N(p.failed) > 0);

  const printingPrints = allPrints.filter(isP);
  const cleanPrints = allPrints.filter(isS);
  const failedPrints = allPrints.filter(isF);

  const list = allPrints.sort((a, b) => {
    const tA = getPrintTimestamp(a);
    const tB = getPrintTimestamp(b);
    if (tA !== tB) return tB - tA;
    return String(b.date || "").localeCompare(String(a.date || ""));
  }).filter(p => {
    if (printFilter === "printing") return isP(p);
    if (printFilter === "clean") return isS(p);
    if (printFilter === "failed") return isF(p);
    return true;
  }).filter(p => {
    const pr = byId("products", p.productId) || {};
    return match("pr", pr.name, p.note, p.date, p.printerName, p.plateName, p.profileName, p.statusLabel);
  });

  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  if (printPage > totalPages) printPage = totalPages;
  if (printPage < 1) printPage = 1;
  const startIdx = (printPage - 1) * PAGE_SIZE;
  const paginatedList = list.slice(startIdx, startIdx + PAGE_SIZE);

  const rows = paginatedList.map(p => {
    const pr = byId("products", p.productId) || {}, f = byId("filaments", p.filamentId);
    const pv = photoSrc(pr.photo);
    const isPrinting = isP(p);
    const isSuccess = p.statusLabel === "Success" || (p.statusLabel !== "Canceled" && p.statusLabel !== "Failed" && !N(p.failed) && N(p.qty) > 0);
    const statusText = p.statusLabel || (isSuccess ? "Success" : (N(p.failed) > 0 ? "Failed" : "Canceled"));
    const statusClass = isSuccess ? "good" : "bad";
    const cleanProf = cleanProfileName(p.profileName);

    let filHtml = "";
    if (Array.isArray(p.filamentsUsed) && p.filamentsUsed.length > 0) {
      filHtml = `<div class="print-filaments-stack">` + p.filamentsUsed.map((fu, idx) => {
        const mat = esc(fu.type || "PLA");
        const slot = fu.slot ? esc(fu.slot) : (isPrinting ? `A${idx + 1}` : "");
        let details = "";
        if (isPrinting) {
          details = slot ? ` • ${slot}` : "";
          if (fu.weightG != null && fu.weightG > 0) details += ` (${m1(fu.weightG)}g)`;
        } else {
          details = (fu.weightG != null ? ` · ${m1(fu.weightG)}g` : "") + (slot ? ` <span class="print-slot-tag">${slot}</span>` : "");
        }
        return `
          <div class="print-fil-pill">
            <span class="swatch" style="background:${safeColor(fu.color || "#888888")};"></span>
            <span class="print-fil-info">${mat}${details}</span>
          </div>
        `;
      }).join("") + `</div>`;
    } else if (f) {
      const slotTag = isPrinting ? ` • ${esc(f.location || "A1")}` : (p.grams ? ` · ${m1(p.grams)}g` : "");
      filHtml = `
        <div class="print-fil-pill">
          <span class="swatch" style="background:${safeColor(f.color)};"></span>
          <span class="print-fil-info">${esc(f.name || f.material || "PLA")}${slotTag}</span>
        </div>
      `;
    } else if (isPrinting) {
      const prFil = byId("filaments", pr.filamentId);
      if (prFil) {
        filHtml = `
          <div class="print-fil-pill">
            <span class="swatch" style="background:${safeColor(prFil.color)};"></span>
            <span class="print-fil-info">${esc(prFil.material || prFil.name || "PLA")} • ${esc(prFil.location || "A1")}</span>
          </div>
        `;
      } else {
        filHtml = `
          <div class="print-fil-pill">
            <span class="swatch" style="background:#10B981;"></span>
            <span class="print-fil-info">PLA • A1</span>
          </div>
        `;
      }
    } else {
      filHtml = `<span class="muted">—</span>`;
    }

    return `
      <tr class="print-table-row clickable-row" data-print-row-id="${p.id}">
        <td>
          <span class="inv-date-cell">${formatDateShort(p.date)}</span>
          <span class="inv-year-muted">${String(p.date || "").slice(0, 4)}</span>
        </td>
        <td>
          ${pv ? `<img class="prod-thumb" src="${pv}" alt="${esc(pr.name || "Print")}">` : `<div class="prod-thumb ph" title="No photo uploaded">${APP_ICONS.feedPackage(18, 1.8)}</div>`}
        </td>
        <td>
          <div class="prod-item-cell">
            <div class="prod-name-wrap">
              <span class="prod-name">${esc(cleanModelTitle(pr.name || p.note || "Custom item"))}</span>
              ${exMark(p)}
            </div>
            ${cleanProf ? `<div class="print-profile-sub muted mono" title="${esc(cleanProf)}">${esc(cleanProf)}</div>` : (pr.sku ? `<div class="prod-sku mono" style="font-size:11.5px;color:var(--color-text-muted)">${esc(pr.sku)}</div>` : "")}
          </div>
        </td>
        <td>
          ${renderPrintStatusBadge(p)}
        </td>
        <td>
          ${filHtml}
        </td>
        <td>
          <div class="print-hardware-cell">
            <div class="print-printer-name">${esc(p.printerName || "3DP-22E-489 (P2S)")}</div>
            <div class="print-plate-sub muted">${esc(p.plateName || "Plate 1")}${p.buildPlate ? ` · ${esc(p.buildPlate)}` : ""}</div>
          </div>
        </td>
        <td class="n">
          <span class="num">${m1(p.grams)} g</span>
        </td>
        <td class="n">
          <span class="num"${p.estimatedHours && Math.abs(N(p.hours) - N(p.estimatedHours)) >= 0.5 ? ` title="Actual: ${m1(N(p.hours))} h (Slicer estimate: ${p.estimatedHours} h)"` : ""}>${m1(N(p.hours))} h</span>
        </td>
        <td class="act">
          <div class="tbl-actions-group">
            <button class="btn sm btn-action-icon" data-view-print="${p.id}" title="View Bambu Handy details">${APP_ICONS.btnView(13, 2)}</button>
            <button class="btn sm btn-action-icon" data-edit="prints" data-id="${p.id}" title="Edit print log">${APP_ICONS.btnEdit(13, 2)}</button>
            <button class="btn sm btn-action-icon danger" data-del="prints" data-id="${p.id}" title="Delete print entry">${APP_ICONS.btnDelete(13, 2)}</button>
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="print-page-wrapper">
      <!-- Interactive Filter Toolbar -->
      <div class="inv-toolbar-panel">
        <div class="inv-toolbar-left">
          <div class="inv-filter-segmented">
            <button type="button" class="inv-filter-btn ${printFilter === "all" ? "active" : ""}" data-print-filter="all">
              All <span class="filter-count">${allPrints.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${printFilter === "printing" ? "active" : ""}" data-print-filter="printing">
              Printing <span class="filter-count printing ${printingPrints.length ? "active" : ""}">${printingPrints.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${printFilter === "clean" ? "active" : ""}" data-print-filter="clean">
              Success <span class="filter-count">${cleanPrints.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${printFilter === "failed" ? "active" : ""}" data-print-filter="failed">
              Canceled / Failed <span class="filter-count alert ${failedPrints.length ? "active" : ""}">${failedPrints.length}</span>
            </button>
          </div>
        </div>

        <div class="inv-toolbar-right">
          <div class="search-wrap inv-search-wrap">
            ${APP_ICONS.search}
            <input class="search" id="q_pr" placeholder="Search by item, printer, note, date..." value="${esc(q.pr || "")}" data-q="pr" aria-label="Search print jobs">
            ${q.pr ? `<button type="button" class="search-clear" data-qclr="pr" title="Clear search">✕</button>` : ""}
          </div>
        </div>
      </div>

      <!-- Prints Table Panel -->
      ${table(["Date", "Photo", "Item", "Status", "Filament", "Printer / Plate", "#Used", "#Time", ""], rows, allPrints.length === 0 ? "No print jobs logged yet. Click 'Sync Bambu' to get started." : "No print jobs match this filter.")}
      ${renderPaginationBar({
        currentPage: printPage,
        totalItems,
        pageSize: PAGE_SIZE,
        itemLabel: "prints",
        dataAttr: "data-print-page"
      })}
    </div>
  `;
}

/* ==========================================================================
   Invoices & offers View (DESIGN.md Modern SaaS Standard)
   ========================================================================== */
let invFilter = "all";
function vInv() {
  const allInvoices = [...S.invoices];
  const sales = allInvoices.filter(i => i.type === "sale" && i.status !== "void");
  const unpaid = sales.filter(i => invTotals(i).bal > 0.005);
  const quotes = allInvoices.filter(i => i.type === "quote" && !i.converted);
  const focs = allInvoices.filter(i => i.type === "foc");

  const list = [...allInvoices].sort((a, b) => String(b.date + b.no).localeCompare(String(a.date + a.no))).filter(i => {
    if (invFilter === "sale") return i.type === "sale";
    if (invFilter === "unpaid") return i.type === "sale" && i.status !== "void" && invTotals(i).bal > 0.005;
    if (invFilter === "quote") return i.type === "quote";
    if (invFilter === "foc") return i.type === "foc";
    return true;
  }).filter(i => match("i", i.no, i.customer, i.agent, i.phone));

  const rows = list.map(i => {
    const t = invTotals(i), [sl, sc] = payStatus(i);
    const pcs = (i.lines || []).reduce((a, l) => a + N(l.qty), 0);
    const isQuote = i.type === "quote";
    const isFoc = i.type === "foc";

    const typeBadge = isQuote ? "quote" : isFoc ? "foc" : "sale";
    const typeIcon = isQuote ? APP_ICONS.feedOffer(13, 2) : isFoc ? APP_ICONS.feedFoc(13, 2) : APP_ICONS.feedSale(13, 2);

    return `
      <tr class="inv-table-row">
        <td>
          <div class="inv-doc-cell">
            <span class="inv-doc-badge ${typeBadge}">${typeIcon}</span>
            <span class="inv-doc-no">${esc(i.no)}</span>
            ${exMark(i)}
          </div>
        </td>
        <td>
          <span class="inv-date-cell">${formatDateShort(i.date)}</span>
          <span class="inv-year-muted">${String(i.date || "").slice(0, 4)}</span>
        </td>
        <td>
          <div class="inv-cust-cell">
            <span class="inv-cust-name">${esc(i.customer || "Direct Customer")}</span>
            ${i.phone ? `<span class="inv-cust-phone">${esc(i.phone)}</span>` : ""}
          </div>
        </td>
        <td>
          <span class="pill ${i.channel === "agent" ? "acc" : "neu"}">${i.channel === "agent" ? "Agent" : "Direct"}</span>
        </td>
        <td class="n">
          <span class="num inv-pcs-val">${m0(pcs)}</span> <span class="muted" style="font-size:11px">pcs</span>
        </td>
        <td class="n">
          ${isFoc ? `<span class="pill neu" style="font-size:11px">Free</span> <span class="muted" style="font-size:11.5px">${money(t.sub)}</span>` : `<b class="num inv-total-val">${money(t.total)}</b>`}
        </td>
        <td class="n">
          ${i.type === "sale" ? (t.bal > 0.005 ? `<span class="num inv-bal-val due">${money(t.bal)}</span>` : `<span class="pill good">Paid</span>`) : `<span class="muted">—</span>`}
        </td>
        <td>
          <span class="pill ${sc}">${sl}</span>
          ${invNoCostLines(i) ? ` <span class="pill warn" title="Unit cost not recorded on line items">no cost</span>` : ""}
        </td>
        <td class="act">
          <div class="tbl-actions-group">
            ${isQuote && !i.converted ? `<button class="btn sm pri btn-convert-pill" data-convert="${i.id}" title="Convert to sales invoice">${APP_ICONS.btnAdd(12, 2.2)} <span>Invoice</span></button>` : ""}
            <button class="btn sm btn-action-pill" data-invpdf="${i.id}" title="Export PDF document">${APP_ICONS.btnPdf(13, 2)} <span>PDF</span></button>
            <button class="btn sm btn-action-icon" data-edit="invoices" data-id="${i.id}" title="Edit invoice details">${APP_ICONS.btnEdit(13, 2)}</button>
            <button class="btn sm btn-action-icon danger" data-del="invoices" data-id="${i.id}" title="Delete document">${APP_ICONS.btnDelete(13, 2)}</button>
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="inv-page-wrapper">
      <!-- Interactive Filter Toolbar -->
      <div class="inv-toolbar-panel">
        <div class="inv-toolbar-left">
          <div class="inv-filter-segmented">
            <button type="button" class="inv-filter-btn ${invFilter === "all" ? "active" : ""}" data-inv-filter="all">
              All <span class="filter-count">${allInvoices.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${invFilter === "sale" ? "active" : ""}" data-inv-filter="sale">
              Invoices <span class="filter-count">${sales.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${invFilter === "unpaid" ? "active" : ""}" data-inv-filter="unpaid">
              Unpaid <span class="filter-count alert ${unpaid.length ? "active" : ""}">${unpaid.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${invFilter === "quote" ? "active" : ""}" data-inv-filter="quote">
              Offers <span class="filter-count">${allInvoices.filter(i => i.type === "quote").length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${invFilter === "foc" ? "active" : ""}" data-inv-filter="foc">
              FOC <span class="filter-count">${focs.length}</span>
            </button>
          </div>
        </div>

        <div class="inv-toolbar-right">
          <div class="search-wrap inv-search-wrap">
            ${APP_ICONS.search}
            <input class="search" id="q_i" placeholder="Search by invoice #, customer, phone..." value="${esc(q.i || "")}" data-q="i" aria-label="Search invoices">
            ${q.i ? `<button type="button" class="search-clear" data-qclr="i" title="Clear search">✕</button>` : ""}
          </div>
        </div>
      </div>

      <!-- 3. Invoices Table Panel -->
      ${table(["No.", "Date", "Customer", "Channel", "#Pcs", "#Total", "#Balance", "Status", ""], rows, allInvoices.length === 0 ? "No invoices or offers recorded yet. Click 'New invoice' to get started." : "No documents match this filter.")}
    </div>
  `;
}

document.addEventListener("change", e => {
  if (e.target.id === "invFilter") {
    invFilter = e.target.value;
    render();
  }
});

/* ==========================================================================
   Expenses View (DESIGN.md Modern SaaS Standard)
   ========================================================================== */
let expFilter = "all";
const EXP_CATS = ["Filament purchase", "Electricity", "Packaging", "Delivery", "Printer parts & maintenance", "Equipment", "Marketing", "Rent", "Agent commission", "Other"];

function vExp() {
  const allExp = [...S.expenses];
  const filExp = allExp.filter(e => e.category === "Filament purchase");
  const opsExp = allExp.filter(e => e.category !== "Filament purchase");

  const list = allExp.sort((a, b) => String(b.date).localeCompare(String(a.date))).filter(e => {
    if (expFilter === "fil") return e.category === "Filament purchase";
    if (expFilter === "ops") return e.category !== "Filament purchase";
    return true;
  }).filter(e => match("e", e.desc, e.category, e.date));

  const getCatPill = (cat) => {
    switch (cat) {
      case "Filament purchase": return '<span class="pill good">Filament</span>';
      case "Electricity": return '<span class="pill warn">Electricity</span>';
      case "Packaging": return '<span class="pill info">Packaging</span>';
      case "Delivery": return '<span class="pill neu">Delivery</span>';
      case "Printer parts & maintenance": return '<span class="pill bad">Parts & Maint.</span>';
      case "Equipment": return '<span class="pill neu">Equipment</span>';
      case "Marketing": return '<span class="pill info">Marketing</span>';
      default: return `<span class="pill neu">${esc(cat || "Other")}</span>`;
    }
  };

  const rows = list.map(e => `
    <tr class="exp-table-row">
      <td>
        <span class="inv-date-cell">${formatDateShort(e.date)}</span>
        <span class="inv-year-muted">${String(e.date || "").slice(0, 4)}</span>
      </td>
      <td>
        <div style="display:inline-flex;align-items:center;gap:6px;">
          ${getCatPill(e.category)}
          ${exMark(e)}
        </div>
      </td>
      <td>
        <span class="exp-desc-text">${esc(e.desc || "—")}</span>
      </td>
      <td class="n">
        <b class="num exp-amount">${money(e.amount)}</b>
      </td>
      <td class="act">
        <div class="tbl-actions-group">
          <button class="btn sm btn-action-icon" data-edit="expenses" data-id="${e.id}" title="Edit expense">${APP_ICONS.btnEdit(13, 2)}</button>
          <button class="btn sm btn-action-icon danger" data-del="expenses" data-id="${e.id}" title="Delete expense">${APP_ICONS.btnDelete(13, 2)}</button>
        </div>
      </td>
    </tr>
  `);

  return `
    <div class="exp-page-wrapper">
      <!-- Interactive Filter Toolbar -->
      <div class="inv-toolbar-panel">
        <div class="inv-toolbar-left">
          <div class="inv-filter-segmented">
            <button type="button" class="inv-filter-btn ${expFilter === "all" ? "active" : ""}" data-exp-filter="all">
              All <span class="filter-count">${allExp.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${expFilter === "fil" ? "active" : ""}" data-exp-filter="fil">
              Filament <span class="filter-count">${filExp.length}</span>
            </button>
            <button type="button" class="inv-filter-btn ${expFilter === "ops" ? "active" : ""}" data-exp-filter="ops">
              Operations <span class="filter-count">${opsExp.length}</span>
            </button>
          </div>
        </div>

        <div class="inv-toolbar-right">
          <div class="search-wrap inv-search-wrap">
            ${APP_ICONS.search}
            <input class="search" id="q_e" placeholder="Search expenses by description, category, date..." value="${esc(q.e || "")}" data-q="e" aria-label="Search expenses">
            ${q.e ? `<button type="button" class="search-clear" data-qclr="e" title="Clear search">✕</button>` : ""}
          </div>
        </div>
      </div>

      <!-- Expenses Table Panel -->
      ${table(["Date", "Category", "Description", "#Amount", ""], rows, allExp.length === 0 ? "No expenses recorded yet. Click 'Add expense' to get started." : "No expenses match this filter.")}
    </div>
  `;
}

/* ==========================================================================
   Accounts View (DESIGN.md Modern SaaS Standard)
   ========================================================================== */
function vAcc() {
  const months = {};
  const add = (d, k, v) => { const m = String(d || "").slice(0, 7); if (!m) return; months[m] = months[m] || { rev: 0, vat: 0, cogs: 0, foc: 0, exp: 0, fil: 0, col: 0 }; months[m][k] += v; };
  liveInv().forEach(i => {
    const t = invTotals(i);
    if (i.type === "sale") {
      add(i.date, "rev", t.sub - t.disc);
      add(i.date, "vat", t.vat);
      add(i.date, "cogs", invCost(i));
      add(i.date, "col", t.paid);
    } else {
      add(i.date, "foc", invCost(i));
    }
  });
  S.expenses.forEach(e => add(e.date, e.category === "Filament purchase" ? "fil" : "exp", N(e.amount)));

  const keys = Object.keys(months).sort().reverse();
  const tot = { rev: 0, vat: 0, cogs: 0, foc: 0, exp: 0, fil: 0, col: 0 };
  keys.forEach(k => Object.keys(tot).forEach(f => tot[f] += months[k][f]));
  const noDate = liveInv().filter(i => !i.date).length + S.expenses.filter(e => !e.date).length;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formatMonth = (mStr) => {
    if (mStr === "TOTAL") return `<span class="pill neu font-bold" style="letter-spacing:0.04em">TOTAL</span>`;
    const parts = mStr.split("-");
    if (parts.length === 2) {
      const idx = parseInt(parts[1], 10) - 1;
      const mName = monthNames[idx] || parts[1];
      return `
        <span class="inv-date-cell">${mName}</span>
        <span class="inv-year-muted">${parts[0]}</span>
      `;
    }
    return `<span class="mono">${esc(mStr)}</span>`;
  };

  const row = (l, m, isTotal = false) => {
    const g = m.rev - m.cogs, n = g - m.foc - m.exp;
    const isNegNet = n < -0.005;
    return `
      <tr class="${isTotal ? "acc-total-row" : "acc-table-row"}">
        <td>${formatMonth(l)}</td>
        <td class="n"><span class="num">${money(m.rev)}</span></td>
        <td class="n"><span class="num">${money(m.cogs)}</span></td>
        <td class="n"><span class="num ${g >= 0 ? "acc-pos" : "acc-neg"}">${money(g)}</span></td>
        <td class="n"><span class="num">${money(m.foc)}</span></td>
        <td class="n"><span class="num">${money(m.exp)}</span></td>
        <td class="n"><span class="pill ${isNegNet ? "bad" : "good"} font-bold">${money(n)}</span></td>
        <td class="n"><span class="num">${money(m.vat)}</span></td>
        <td class="n"><span class="num">${money(m.col)}</span></td>
        <td class="n"><span class="num">${money(m.fil)}</span></td>
      </tr>
    `;
  };

  const rows = keys.map(k => row(k, months[k])).concat(keys.length ? [row("TOTAL", tot, true)] : []);

  return `
    <div class="acc-page-wrapper">
      <div class="acc-toolbar-panel">
        <div class="acc-desc-note">
          Monthly profit & loss statement. Cost of goods = unit manufacturing cost of items sold. VAT is shown separately.
          ${noDate ? ` <span class="acc-warn-note">(${noDate} record${noDate === 1 ? " has" : "s have"} no date and excluded)</span>` : ""}
        </div>
      </div>

      <!-- Accounts Table -->
      <div class="acc-table-wrap">
        ${table(["Month", "#Sales ex VAT", "#Cost of goods", "#Gross profit", "#FOC cost", "#Expenses", "#Net profit", "#VAT collected", "#Cash received", "#Filament bought"], rows, "Your monthly accounts appear once you add invoices or expenses.")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Stock Management View (Inventory & Production Hub)
   ========================================================================== */
function vStock() {
  const spools = S.filament_stock || [];
  const products = S.products || [];
  const prints = S.prints || [];

  const totalSpools = spools.length;
  const totalValuation = spools.reduce((acc, f) => acc + (N(f.price || f.costPerSpool || 75)), 0);
  const totalWeightKg = (totalSpools * 1.0).toFixed(1);
  const totalModels = products.length;
  const totalFinishedPcs = products.reduce((acc, p) => acc + (Number(p.totalPrinted) || 0), 0);

  const matCounts = {};
  spools.forEach(s => {
    const m = (s.material || s.type || "PLA").trim();
    matCounts[m] = (matCounts[m] || 0) + 1;
  });

  return `
    <div class="module-page-wrapper stock-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">RAW FILAMENT SPOOLS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navFilaments}</div>
          </div>
          <div class="metric-value">${totalSpools} <span style="font-size:16px;font-weight:500;">spools</span></div>
          <div class="metric-sub">${totalWeightKg} kg inventory · AED ${totalValuation.toFixed(2)}</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">FINISHED GOODS PRODUCED</span>
            <div class="metric-icon-wrap">${APP_ICONS.navProducts}</div>
          </div>
          <div class="metric-value">${m0(totalFinishedPcs)} <span style="font-size:16px;font-weight:500;">pcs</span></div>
          <div class="metric-sub">${totalModels} unique catalogue model designs</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">PRODUCTION RUNS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navPrints}</div>
          </div>
          <div class="metric-value">${prints.length} <span style="font-size:16px;font-weight:500;">jobs</span></div>
          <div class="metric-sub">Bambu Cloud verified synchronizations</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">STOCK REORDER STATUS</span>
            <div class="metric-icon-wrap">${APP_ICONS.feedAlert()}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">Optimal</div>
          <div class="metric-sub">All active materials above safety threshold</div>
        </div>
      </div>

      <div class="stock-hub-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:16px;">
        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h3 style="margin:0 0 4px 0;font-size:16px;font-weight:700;">Filament Raw Stock</h3>
              <p class="muted" style="margin:0;font-size:12.5px;">Manage 3D spool inventory, purchase batches, materials, and colors</p>
            </div>
            <button type="button" class="btn sm pri btn-pill-primary" data-tab-link="filaments">Open Spool Catalog →</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            ${Object.entries(matCounts).map(([mat, count]) => `
              <span class="pill good" style="font-size:12px;padding:4px 10px;">${esc(mat)}: <strong>${count}</strong></span>
            `).join("")}
          </div>
        </div>

        <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <h3 style="margin:0 0 4px 0;font-size:16px;font-weight:700;">Printed Finished Stock</h3>
              <p class="muted" style="margin:0;font-size:12.5px;">Finished printed products, unit slicer weights, and model pricing</p>
            </div>
            <button type="button" class="btn sm pri btn-pill-primary" data-tab-link="products">Open Product Grid →</button>
          </div>
          <div style="display:flex;align-items:center;gap:12px;font-size:13px;">
            <span class="muted">Active Catalog Models: <strong>${totalModels}</strong></span>
            <span class="muted">·</span>
            <span class="muted">Total Units Printed: <strong>${m0(totalFinishedPcs)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Customers View (Customers & Sales)
   ========================================================================== */
/* ==========================================================================
   Customers View (Client Directory & Order History)
   ========================================================================== */
let customerSearch = "";
let apiCustomers = [];
let isCustomersLoaded = false;

async function loadCustomersFromApi() {
  if (isCustomersLoaded) return;
  try {
    const res = await fetch("/api/admin/customers", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.customers && Array.isArray(data.customers)) {
        apiCustomers = data.customers;
      }
      isCustomersLoaded = true;
      render();
    }
  } catch (err) {
    console.warn("loadCustomersFromApi error:", err);
  }
}

function openCustomerHistoryModal(customerId) {
  const custList = buildCustomerDirectoryList();
  const c = custList.find(item => item.id === customerId || item.name === customerId) || {
    name: customerId,
    phone: "",
    email: "",
    totalSpent: 0,
    orders: []
  };

  const phone = c.phone || "";
  const cleanDigits = phone.replace(/\D/g, "");
  const waLink = cleanDigits ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Hello ${c.name}, thank you for printing with 3D Studio Dubai:`)}` : "";

  const orderRows = (c.orders || []).map((o, idx) => {
    const orderNum = o.orderNumber || o.no || `ORD-${1000 + idx}`;
    const dateStr = o.date ? formatDateShort(o.date) : "Recent";
    const [pLabel, pCls] = o.paymentStatus ? [o.paymentStatus, o.paymentStatus === 'PAID' ? 'good' : 'warn'] : ['Paid', 'good'];
    const fStatus = o.fulfillmentStatus || 'DELIVERED';

    return `
      <tr>
        <td class="mono" style="font-weight:700;color:var(--color-brand,#059669);">${esc(orderNum)}</td>
        <td>${dateStr}</td>
        <td class="n mono">${o.itemsCount || (o.lines?.length) || 1} line item(s)</td>
        <td class="n mono" style="font-weight:700;">${money(o.total || 0)}</td>
        <td><span class="pill ${pCls}">${esc(pLabel)}</span></td>
        <td><span class="pill neu">${esc(fStatus.replace('_', ' '))}</span></td>
      </tr>
    `;
  }).join("") || `
    <tr>
      <td colspan="6" style="text-align:center;padding:24px;" class="muted">No order history recorded for this client.</td>
    </tr>
  `;

  $("#modalRoot").innerHTML = `
    <div class="scrim" id="scrim">
      <div class="modal customer-detail-modal" style="max-width:680px;width:100%;border-radius:18px;background:var(--color-surface);box-shadow:0 12px 40px rgba(0,0,0,0.18);padding:0;overflow:hidden;border:1px solid var(--color-border);" role="dialog">
        <div style="padding:18px 24px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;background:var(--color-surface-muted);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--color-brand,#059669);color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;">
              ${esc(c.name.slice(0, 2).toUpperCase())}
            </div>
            <div>
              <h3 style="margin:0;font-size:16px;font-weight:700;">${esc(c.name)}</h3>
              <p class="muted" style="margin:0;font-size:12px;">${c.company ? esc(c.company) + ' · ' : ''}Client Profile & Lifetime Activity</p>
            </div>
          </div>
          <button type="button" class="modal-close-x" id="modalCloseX" aria-label="Close dialog" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--color-text-secondary);">✕</button>
        </div>

        <div style="padding:20px 24px;max-height:calc(85vh - 140px);overflow-y:auto;display:flex;flex-direction:column;gap:18px;">
          <!-- Contact Details Bar -->
          <div style="padding:14px;border-radius:12px;background:var(--color-surface-muted);border:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;margin-bottom:2px;">Contact Information</div>
              <div style="font-size:13px;color:var(--color-text-primary);">
                ${c.email ? `Email: <span>${esc(c.email)}</span>` : ''}
                ${phone ? `${c.email ? ' · ' : ''}Phone: <span class="mono">${esc(phone)}</span>` : ''}
              </div>
            </div>
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#ffffff;border:none;font-weight:600;">
                WhatsApp Client
              </a>
            ` : ''}
          </div>

          <!-- Lifetime Quick Stats -->
          <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px;">
            <div style="padding:12px;border-radius:10px;background:var(--color-surface-muted);border:1px solid var(--color-border);">
              <div class="muted" style="font-size:11px;font-weight:600;text-transform:uppercase;">Total Orders</div>
              <div style="font-size:18px;font-weight:700;margin-top:4px;">${c.orders?.length || c.ordersCount || 0}</div>
            </div>
            <div style="padding:12px;border-radius:10px;background:var(--color-surface-muted);border:1px solid var(--color-border);">
              <div class="muted" style="font-size:11px;font-weight:600;text-transform:uppercase;">Lifetime Spent</div>
              <div style="font-size:18px;font-weight:700;color:var(--color-brand,#059669);margin-top:4px;">${money(c.totalSpent || 0)}</div>
            </div>
            <div style="padding:12px;border-radius:10px;background:var(--color-surface-muted);border:1px solid var(--color-border);">
              <div class="muted" style="font-size:11px;font-weight:600;text-transform:uppercase;">Average Ticket</div>
              <div style="font-size:18px;font-weight:700;margin-top:4px;">${money((c.orders?.length || c.ordersCount || 0) > 0 ? (c.totalSpent / (c.orders?.length || c.ordersCount || 1)) : 0)}</div>
            </div>
          </div>

          <!-- Orders History Table -->
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;margin-bottom:8px;">Order & Fulfillment Log</div>
            <table class="table" style="width:100%;font-size:12.5px;">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th class="n">Items</th>
                  <th class="n">Total (AED)</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${orderRows}
              </tbody>
            </table>
          </div>
        </div>

        <div style="padding:14px 24px;border-top:1px solid var(--color-border);display:flex;justify-content:flex-end;gap:10px;background:var(--color-surface-muted);">
          <button type="button" class="btn sm" id="modalCloseBtn">Close</button>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { $("#modalRoot").innerHTML = ""; };
  const closeX = $("#modalCloseX");
  const closeBtn = $("#modalCloseBtn");
  const scrim = $("#scrim");
  if (closeX) closeX.addEventListener("click", closeFn);
  if (closeBtn) closeBtn.addEventListener("click", closeFn);
  if (scrim) scrim.addEventListener("click", e => { if (e.target === scrim) closeFn(); });
}

function buildCustomerDirectoryList() {
  const customerMap = new Map();

  // 1. Seed from apiCustomers if loaded
  (apiCustomers || []).forEach(ac => {
    const key = (ac.name || "").trim().toLowerCase();
    if (!key) return;
    customerMap.set(key, {
      id: ac.id || key,
      name: ac.name,
      email: ac.email || "",
      phone: ac.phone || "",
      company: ac.company || "",
      ordersCount: ac.totalOrders || (ac.orders?.length) || 0,
      totalSpent: ac.cumulativeSales || 0,
      lastDate: ac.lastOrderDate || null,
      orders: ac.orders || []
    });
  });

  // 2. Aggregate from S.invoices
  (S.invoices || []).forEach(inv => {
    const rawName = (inv.customer || inv.client || inv.customerName || "").trim();
    if (!rawName) return;
    const key = rawName.toLowerCase();
    const existing = customerMap.get(key) || {
      id: key,
      name: rawName,
      email: inv.email || inv.customerEmail || "",
      phone: inv.phone || inv.customerPhone || "",
      company: inv.company || "",
      ordersCount: 0,
      totalSpent: 0,
      lastDate: null,
      orders: []
    };

    if (!existing.phone && (inv.phone || inv.customerPhone)) {
      existing.phone = inv.phone || inv.customerPhone;
    }
    if (!existing.email && (inv.email || inv.customerEmail)) {
      existing.email = inv.email || inv.customerEmail;
    }

    const t = invTotals(inv);
    const orderTotal = t.total || N(inv.total) || 0;
    
    // Check if invoice already added
    const orderNo = inv.no || inv.number || inv.invoiceNumber || inv.id;
    const alreadyPresent = existing.orders.some(o => (o.orderNumber === orderNo || o.id === inv.id));
    if (!alreadyPresent) {
      existing.ordersCount += 1;
      existing.totalSpent += orderTotal;
      existing.orders.push({
        id: inv.id || orderNo,
        orderNumber: orderNo,
        date: inv.date || null,
        total: orderTotal,
        paymentStatus: payStatus(inv)[0].toUpperCase(),
        fulfillmentStatus: getOrderFulfillmentStatus(inv),
        itemsCount: inv.lines?.length || 1
      });
    }

    if (!existing.lastDate || (inv.date && inv.date > existing.lastDate)) {
      existing.lastDate = inv.date;
    }
    customerMap.set(key, existing);
  });

  return Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
}

function bindCustomers() {
  if (!isCustomersLoaded) {
    loadCustomersFromApi();
  }

  const searchInp = $("#customerSearchInput");
  if (searchInp) {
    searchInp.addEventListener("input", e => {
      customerSearch = e.target.value.toLowerCase().trim();
      render();
    });
  }

  $$(".btn-view-customer-history").forEach(btn => {
    btn.addEventListener("click", () => {
      const customerId = btn.dataset.customerId;
      openCustomerHistoryModal(customerId);
    });
  });
}

function vCustomers() {
  const custList = buildCustomerDirectoryList();
  const totalClients = custList.length;
  const repeatClients = custList.filter(c => c.ordersCount > 1).length;
  const cumulativeSales = custList.reduce((acc, c) => acc + c.totalSpent, 0);
  const avgClientValue = totalClients > 0 ? (cumulativeSales / totalClients) : 0;

  const filtered = custList.filter(c => {
    if (customerSearch) {
      const q = customerSearch.toLowerCase();
      const name = String(c.name || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const comp = String(c.company || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !comp.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const rows = filtered.map(c => {
    const phone = c.phone || "";
    const cleanDigits = phone.replace(/\D/g, "");
    const waLink = cleanDigits ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Hello ${c.name}, regarding your orders with 3D Studio Dubai:`)}` : "";

    return `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--color-surface-muted);color:var(--color-text-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:1px solid var(--color-border);">
              ${esc(c.name.slice(0, 2).toUpperCase())}
            </div>
            <div>
              <div style="font-weight:600;font-size:13.5px;">${esc(c.name)}</div>
              ${c.company ? `<div class="muted" style="font-size:11px;">${esc(c.company)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px;">
            <div>
              ${c.email ? `<div style="font-size:12px;">${esc(c.email)}</div>` : ''}
              ${phone ? `<div class="muted mono" style="font-size:11px;">${esc(phone)}</div>` : ''}
            </div>
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:#25D366;color:#ffffff;border:none;font-weight:600;padding:3px 8px;border-radius:6px;font-size:11px;">
                WhatsApp
              </a>
            ` : ''}
          </div>
        </td>
        <td class="n mono" style="font-weight:600;">
          ${c.ordersCount} ${c.ordersCount === 1 ? 'order' : 'orders'}
        </td>
        <td class="n mono" style="font-weight:700;color:var(--color-brand,#059669);">${money(c.totalSpent)}</td>
        <td style="font-size:12px;">${c.lastDate ? formatDateShort(c.lastDate) : "—"}</td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button type="button" class="btn sm btn-view-customer-history" data-customer-id="${esc(c.id || c.name)}" title="Inspect Customer Order History">Order History</button>
            <button type="button" class="btn sm pri" data-new="invoices" data-type="sale" title="Create new invoice for customer">+ Order</button>
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="module-page-wrapper customers-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">TOTAL CLIENTS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navCustomers}</div>
          </div>
          <div class="metric-value">${totalClients} <span style="font-size:16px;font-weight:500;">clients</span></div>
          <div class="metric-sub">Active commercial client relationships</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">REPEAT CLIENTS</span>
            <div class="metric-icon-wrap">${APP_ICONS.checkSuccess(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">${repeatClients} <span style="font-size:16px;font-weight:500;">repeat</span></div>
          <div class="metric-sub">Clients with multiple production runs</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">CUMULATIVE SALES VALUE</span>
            <div class="metric-icon-wrap">${APP_ICONS.navInvoices}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">${money(cumulativeSales)}</div>
          <div class="metric-sub">Gross lifetime customer billing volume</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">AVG CLIENT VALUE</span>
            <div class="metric-icon-wrap">${APP_ICONS.metricSales(18, 2)}</div>
          </div>
          <div class="metric-value">${money(avgClientValue)}</div>
          <div class="metric-sub">Average revenue per client relationship</div>
        </div>
      </div>

      <div class="card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:280px;max-width:480px;">
            <input type="search" id="customerSearchInput" class="inp" placeholder="Search clients by name, email, phone, company..." value="${esc(customerSearch)}" style="width:100%;">
          </div>
          <div style="font-size:12px;color:var(--color-text-secondary);">
            Synchronized with sales ledger & website directory
          </div>
        </div>
        ${table(["Client Profile", "Contact & WhatsApp", "Total Orders", "#Cumulative Spend (AED)", "Last Order", ""], rows, "No customer records registered yet.")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Orders View (Customers & Sales)
   ========================================================================== */
/* ==========================================================================
   Orders View (Production Orders & Commercial Fulfillment)
   ========================================================================== */
let orderFilter = "ALL";
let orderSearch = "";

function getOrderFulfillmentStatus(inv) {
  if (inv.fulfillmentStatus) return inv.fulfillmentStatus;
  if (inv.delivered) return "DELIVERED";
  if (inv.status === "ready") return "READY";
  return "IN_PRODUCTION";
}

async function updateOrderFulfillment(orderId, newStatus) {
  const allInvoices = S.invoices || [];
  const inv = allInvoices.find(i => i.id === orderId || i.no === orderId || String(i.id) === String(orderId));
  if (inv) {
    inv.fulfillmentStatus = newStatus;
    if (newStatus === "DELIVERED") inv.delivered = true;
    store.persist("invoices");
  }
  notify({
    type: "good",
    title: "Order Updated",
    message: `Order fulfillment status set to ${newStatus.replace('_', ' ')}.`
  });
  render();

  try {
    const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fulfillmentStatus: newStatus })
    });
    if (!res.ok) {
      console.warn("API update order fulfillment returned status", res.status);
    }
  } catch (err) {
    console.warn("Failed to PATCH /api/admin/orders:", err);
  }
}

function openOrderDetailModal(orderId) {
  const allInvoices = S.invoices || [];
  const inv = allInvoices.find(i => i.id === orderId || i.no === orderId || String(i.id) === String(orderId)) || {};
  const t = invTotals(inv);
  const orderNo = inv.no || inv.number || inv.invoiceNumber || orderId;
  const custName = inv.customer || inv.client || inv.customerName || "Studio Client";
  const phone = inv.phone || inv.customerPhone || "";
  const email = inv.email || inv.customerEmail || "";
  const lines = inv.lines || [];
  const fStatus = getOrderFulfillmentStatus(inv);
  const [pLabel, pCls] = payStatus(inv);

  const linesHtml = lines.length > 0 ? lines.map((l, idx) => `
    <tr>
      <td class="mono" style="font-size:12px;">${idx + 1}</td>
      <td style="font-weight:600;">${esc(l.name || l.desc || 'Print Item')}</td>
      <td class="n mono">${l.qty || 1}</td>
      <td class="n mono">${money(l.price || l.unitPrice || 0)}</td>
      <td class="n mono" style="font-weight:700;">${money(l.total || ((l.qty || 1) * (l.price || 0)))}</td>
    </tr>
  `).join("") : `
    <tr>
      <td class="mono">1</td>
      <td style="font-weight:600;">Custom 3D Printing Service</td>
      <td class="n mono">1</td>
      <td class="n mono">${money(t.sub)}</td>
      <td class="n mono" style="font-weight:700;">${money(t.sub)}</td>
    </tr>
  `;

  $("#modalRoot").innerHTML = `
    <div class="scrim" id="scrim">
      <div class="modal order-detail-modal" style="max-width:640px;width:100%;border-radius:18px;background:var(--color-surface);box-shadow:0 12px 40px rgba(0,0,0,0.18);padding:0;overflow:hidden;border:1px solid var(--color-border);" role="dialog">
        <div style="padding:18px 24px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;background:var(--color-surface-muted);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:10px;background:var(--color-surface);display:flex;align-items:center;justify-content:center;color:var(--color-brand,#059669);">
              ${APP_ICONS.navOrders}
            </div>
            <div>
              <h3 style="margin:0;font-size:16px;font-weight:700;">Order ${esc(orderNo)}</h3>
              <p class="muted" style="margin:0;font-size:12px;">Placed ${inv.date ? formatDateShort(inv.date) : "Recent"}</p>
            </div>
          </div>
          <button type="button" class="modal-close-x" id="modalCloseX" aria-label="Close dialog" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--color-text-secondary);">✕</button>
        </div>

        <div style="padding:20px 24px;max-height:calc(85vh - 140px);overflow-y:auto;display:flex;flex-direction:column;gap:18px;">
          <!-- Customer Details Card -->
          <div style="padding:14px;border-radius:12px;background:var(--color-surface-muted);border:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:11px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;margin-bottom:4px;">Customer Details</div>
              <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">${esc(custName)}</div>
              ${phone ? `<div class="muted" style="font-size:12px;margin-top:2px;">Phone: <span class="mono">${esc(phone)}</span></div>` : ''}
              ${email ? `<div class="muted" style="font-size:12px;">Email: <span>${esc(email)}</span></div>` : ''}
            </div>
            ${phone ? `
              <a href="https://wa.me/${phone.replace(/\\D/g, '')}?text=${encodeURIComponent(`Hello ${custName}, regarding your 3D print order ${orderNo}:`)}" target="_blank" rel="noopener noreferrer" class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#ffffff;border:none;font-weight:600;">
                WhatsApp Client
              </a>
            ` : ''}
          </div>

          <!-- Items Table -->
          <div>
            <div style="font-size:11px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;margin-bottom:8px;">Order Specifications & Line Items</div>
            <table class="table" style="width:100%;font-size:12.5px;">
              <thead>
                <tr>
                  <th style="width:40px;">#</th>
                  <th>Item Name / Model</th>
                  <th class="n">Qty</th>
                  <th class="n">Unit (AED)</th>
                  <th class="n">Line Total</th>
                </tr>
              </thead>
              <tbody>
                ${linesHtml}
              </tbody>
            </table>
          </div>

          <!-- Summary Breakdown with 5% UAE VAT -->
          <div style="margin-top:auto;padding-top:12px;border-top:1px solid var(--color-border);display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span class="muted">Subtotal (excl. VAT)</span>
              <span class="mono">${money(t.sub)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;">
              <span class="muted">UAE VAT (5%)</span>
              <span class="mono">${money(t.vat)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding-top:4px;border-top:1px dashed var(--color-border);">
              <span>Total Amount (AED)</span>
              <span class="mono" style="color:var(--color-brand,#059669);">${money(t.total)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <span class="muted" style="font-size:12px;">Payment: <span class="pill ${pCls}">${pLabel}</span></span>
              <span class="muted" style="font-size:12px;">Fulfillment: <span class="pill neu">${fStatus.replace('_', ' ')}</span></span>
            </div>
          </div>
        </div>

        <div style="padding:14px 24px;border-top:1px solid var(--color-border);display:flex;justify-content:flex-end;gap:10px;background:var(--color-surface-muted);">
          <button type="button" class="btn sm" id="modalCloseBtn">Close</button>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { $("#modalRoot").innerHTML = ""; };
  const closeX = $("#modalCloseX");
  const closeBtn = $("#modalCloseBtn");
  const scrim = $("#scrim");
  if (closeX) closeX.addEventListener("click", closeFn);
  if (closeBtn) closeBtn.addEventListener("click", closeFn);
  if (scrim) scrim.addEventListener("click", e => { if (e.target === scrim) closeFn(); });
}

function bindOrders() {
  const searchInp = $("#orderSearchInput");
  if (searchInp) {
    searchInp.addEventListener("input", e => {
      orderSearch = e.target.value.toLowerCase().trim();
      render();
    });
  }

  $$(".order-filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      orderFilter = btn.dataset.filter;
      render();
    });
  });

  $$(".select-order-fulfillment").forEach(sel => {
    sel.addEventListener("change", async () => {
      const orderId = sel.dataset.orderId;
      const newStatus = sel.value;
      await updateOrderFulfillment(orderId, newStatus);
    });
  });

  $$(".btn-view-order-details").forEach(btn => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.orderId;
      openOrderDetailModal(orderId);
    });
  });
}

function vOrders() {
  const allInvoices = (S.invoices || []).filter(i => i.type !== "quote" && i.status !== "void");

  const inProductionCount = allInvoices.filter(i => getOrderFulfillmentStatus(i) === "IN_PRODUCTION").length;
  const readyCount = allInvoices.filter(i => getOrderFulfillmentStatus(i) === "READY").length;
  const deliveredCount = allInvoices.filter(i => getOrderFulfillmentStatus(i) === "DELIVERED").length;
  const totalBilled = allInvoices.reduce((acc, i) => acc + (invTotals(i).total || N(i.total) || 0), 0);

  const filtered = allInvoices.filter(inv => {
    const fStatus = getOrderFulfillmentStatus(inv);
    const pStat = payStatus(inv)[0].toUpperCase();
    if (orderFilter === "IN_PRODUCTION" && fStatus !== "IN_PRODUCTION") return false;
    if (orderFilter === "READY" && fStatus !== "READY") return false;
    if (orderFilter === "DELIVERED" && fStatus !== "DELIVERED") return false;
    if (orderFilter === "PAID" && pStat !== "PAID") return false;
    if (orderFilter === "PENDING" && pStat === "PAID") return false;

    if (orderSearch) {
      const q = orderSearch.toLowerCase();
      const noStr = String(inv.no || inv.id || "").toLowerCase();
      const custStr = String(inv.customer || inv.client || inv.customerName || "").toLowerCase();
      const phoneStr = String(inv.phone || inv.customerPhone || "").toLowerCase();
      const lineStr = (inv.lines || []).map(l => String(l.name || l.desc || "")).join(" ").toLowerCase();
      if (!noStr.includes(q) && !custStr.includes(q) && !phoneStr.includes(q) && !lineStr.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const orderRows = filtered.map((inv, idx) => {
    const t = invTotals(inv);
    const orderNo = inv.no || inv.number || inv.invoiceNumber || `ORD-${1000 + idx}`;
    const custName = inv.customer || inv.client || inv.customerName || "Studio Walk-in";
    const phone = inv.phone || inv.customerPhone || "";
    const email = inv.email || inv.customerEmail || "";
    const dateStr = inv.date ? formatDateShort(inv.date) : "—";
    const lineCount = inv.lines?.length || 1;
    const itemsPreview = (inv.lines || []).map(l => `${l.name || l.desc || 'Print Item'} ×${l.qty || 1}`).join(", ") || "3D Print Custom Batch";
    const fStatus = getOrderFulfillmentStatus(inv);
    const [pLabel, pCls] = payStatus(inv);

    return `
      <tr data-order-row="${esc(inv.id || orderNo)}">
        <td class="mono" style="font-weight:700;color:var(--color-brand,#059669);">${esc(orderNo)}</td>
        <td>
          <div style="font-weight:600;font-size:13.5px;">${esc(custName)}</div>
          <div class="muted mono" style="font-size:11px;">${phone ? esc(phone) : (email ? esc(email) : "Storefront Order")}</div>
        </td>
        <td>${dateStr}</td>
        <td>
          <div style="font-weight:600;font-size:12px;">${lineCount} item${lineCount > 1 ? 's' : ''}</div>
          <div class="muted" style="font-size:11px;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(itemsPreview)}">${esc(itemsPreview)}</div>
        </td>
        <td class="n mono" style="font-weight:700;">${money(t.total)}</td>
        <td><span class="pill ${pCls}">${pLabel}</span></td>
        <td>
          <select class="inp select-order-fulfillment" data-order-id="${esc(inv.id || orderNo)}" style="padding:4px 8px;font-size:12px;font-weight:600;border-radius:6px;width:auto;cursor:pointer;background:var(--color-surface);">
            <option value="IN_PRODUCTION" ${fStatus === 'IN_PRODUCTION' ? 'selected' : ''}>In Production</option>
            <option value="READY" ${fStatus === 'READY' ? 'selected' : ''}>Ready for Pickup</option>
            <option value="DELIVERED" ${fStatus === 'DELIVERED' ? 'selected' : ''}>Delivered</option>
          </select>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:6px;">
            <button type="button" class="btn sm btn-view-order-details" data-order-id="${esc(inv.id || orderNo)}" title="View Order Specification">View</button>
            <button type="button" class="btn sm" data-tab-link="prints" title="Inspect Print Production Jobs">Prints →</button>
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="module-page-wrapper orders-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">TOTAL ORDERS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navOrders}</div>
          </div>
          <div class="metric-value">${allInvoices.length} <span style="font-size:16px;font-weight:500;">orders</span></div>
          <div class="metric-sub">Commercial client & storefront volume</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">IN PRODUCTION</span>
            <div class="metric-icon-wrap">${APP_ICONS.navPrints}</div>
          </div>
          <div class="metric-value" style="color:var(--color-accent,#0284c7);">${inProductionCount} <span style="font-size:16px;font-weight:500;">active</span></div>
          <div class="metric-sub">Orders currently queued on Bambu printers</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">READY FOR PICKUP</span>
            <div class="metric-icon-wrap">${APP_ICONS.checkSuccess(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">${readyCount} <span style="font-size:16px;font-weight:500;">ready</span></div>
          <div class="metric-sub">Printed, packaged & awaiting delivery</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">TOTAL BILLED (AED)</span>
            <div class="metric-icon-wrap">${APP_ICONS.metricSales(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">${money(totalBilled)}</div>
          <div class="metric-sub">Gross billed order value across studio</div>
        </div>
      </div>

      <div class="card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:280px;max-width:480px;">
            <input type="search" id="orderSearchInput" class="inp" placeholder="Search orders by number, client, phone, items..." value="${esc(orderSearch)}" style="width:100%;">
          </div>
          <div class="segmented-control" role="group" aria-label="Order Filter" style="display:flex;gap:4px;">
            <button type="button" class="segment-btn order-filter-pill ${orderFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All (${allInvoices.length})</button>
            <button type="button" class="segment-btn order-filter-pill ${orderFilter === 'IN_PRODUCTION' ? 'active' : ''}" data-filter="IN_PRODUCTION">In Production (${inProductionCount})</button>
            <button type="button" class="segment-btn order-filter-pill ${orderFilter === 'READY' ? 'active' : ''}" data-filter="READY">Ready (${readyCount})</button>
            <button type="button" class="segment-btn order-filter-pill ${orderFilter === 'DELIVERED' ? 'active' : ''}" data-filter="DELIVERED">Delivered (${deliveredCount})</button>
            <button type="button" class="segment-btn order-filter-pill ${orderFilter === 'PAID' ? 'active' : ''}" data-filter="PAID">Paid</button>
            <button type="button" class="segment-btn order-filter-pill ${orderFilter === 'PENDING' ? 'active' : ''}" data-filter="PENDING">Pending</button>
          </div>
        </div>
        ${table(["Order #", "Customer", "Date", "Line Items", "#Total (AED)", "Payment", "Fulfillment Status", ""], orderRows, "No orders matching current filter.")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Customer KYC View (Customers & Sales)
   ========================================================================== */
function vKyc() {
  const custList = Array.from(new Set((S.invoices || []).map(i => (i.customer || "").trim()).filter(Boolean)));
  const demoList = custList.length > 0 ? custList : ["Falcon Prints LLC", "Dubai Design District Studio", "Emirates Robotics"];

  const kycRows = demoList.map((name, i) => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:13.5px;">${esc(name)}</div>
        <div class="muted mono" style="font-size:11px;">KYC-ID: KYC-${202600 + i}</div>
      </td>
      <td><span class="pill neu">${name.toLowerCase().includes("llc") || name.toLowerCase().includes("studio") ? "B2B Corporate" : "Individual"}</span></td>
      <td><span class="pill good" style="font-size:11px;">Tier 2 Verified</span></td>
      <td style="font-size:12px;">Emirates ID · Trade License (Active)</td>
      <td><span class="pill good">● Approved</span></td>
      <td style="text-align:right;">
        <button type="button" class="btn sm" data-tab-link="customers" title="Open Customer Profile">View Profile</button>
      </td>
    </tr>
  `);

  return `
    <div class="module-page-wrapper kyc-page-wrapper">
      <div style="padding:16px 20px;border-radius:12px;background:var(--color-surface);border:1px solid var(--color-border);display:flex;align-items:flex-start;gap:14px;">
        <div style="width:36px;height:36px;border-radius:50%;background:rgba(5,150,105,0.1);color:var(--color-brand,#059669);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${APP_ICONS.navKyc}
        </div>
        <div style="flex:1;">
          <h4 style="margin:0 0 4px 0;font-size:14px;font-weight:700;">Customer KYC & Compliance Registry</h4>
          <p class="muted" style="margin:0;font-size:12.5px;line-height:1.5;">
            Customer KYC records are integrated directly with Customer Profiles. Each verified client record maintains UAE legal compliance, including identity verification (Emirates ID/Passport), commercial registration, and Tax Registration (TRN).
          </p>
        </div>
      </div>

      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">VERIFIED CLIENTS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navKyc}</div>
          </div>
          <div class="metric-value">${demoList.length} <span style="font-size:16px;font-weight:500;">verified</span></div>
          <div class="metric-sub">Complete KYC documentation approved</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">COMPLIANCE RATING</span>
            <div class="metric-icon-wrap">${APP_ICONS.checkSuccess(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">Tier 1 & 2</div>
          <div class="metric-sub">Zero AML or sanction flags</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">DOCUMENT EXPIRY AUDIT</span>
            <div class="metric-icon-wrap">${APP_ICONS.navSettings}</div>
          </div>
          <div class="metric-value">All Current</div>
          <div class="metric-sub">Zero documents expired in next 60 days</div>
        </div>
      </div>

      <div class="card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h3 style="margin:0;font-size:15px;font-weight:700;">KYC Document Registry</h3>
          <button type="button" class="btn sm pri btn-pill-primary" data-tab-link="customers">Open Customers Directory →</button>
        </div>
        ${table(["Client Account", "Entity Type", "Level", "Documents", "Status", ""], kycRows, "No KYC records found.")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Quotations View (Customers & Sales)
   ========================================================================== */
/* ==========================================================================
   Enquiries & Quotes View (Commercial Operations & Quoting)
   ========================================================================== */
let enquiryFilter = "ALL";
let enquirySearch = "";
let studioEnquiries = [
  {
    id: "enq_sample_1",
    customerName: "Rashid Al-Falasi",
    customerEmail: "rashid.f@emiratesproto.ae",
    customerPhone: "+971501234567",
    subject: "Industrial Drone Motor Casing in PETG-CF",
    message: "We need 25 units of lightweight motor housing printed in carbon-fiber PETG. Dimensional accuracy must be within 0.15mm. Slicer files are ready.",
    status: "NEW",
    createdAt: "2026-11-20T14:30:00Z"
  },
  {
    id: "enq_sample_2",
    customerName: "Sarah Jenkins",
    customerEmail: "sarah.j@d3creative.com",
    customerPhone: "+971529876543",
    subject: "Architectural Pavilion Scale Model 1:50",
    message: "Seeking quotation for 1.2m wide parametric pavilion model. Requires matte white PLA with 0.12mm layer resolution. Completion needed in 5 working days.",
    status: "IN_REVIEW",
    createdAt: "2026-11-19T09:15:00Z"
  },
  {
    id: "enq_sample_3",
    customerName: "Tariq Mansoor",
    customerEmail: "tariq@mansoor-robotics.ae",
    customerPhone: "+971556789012",
    subject: "Robotics Gripper Fingers (TPU 95A flexible)",
    message: "Quote requested for 12 sets of compliant robotic fingers printed in flexible 95A TPU black. Can you advise filament availability?",
    status: "RESPONDED",
    createdAt: "2026-11-18T16:45:00Z"
  }
];
let isEnquiriesFetched = false;

async function loadEnquiriesFromApi() {
  if (isEnquiriesFetched) return;
  try {
    const res = await fetch("/api/admin/enquiries", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.enquiries && Array.isArray(data.enquiries) && data.enquiries.length > 0) {
        studioEnquiries = data.enquiries;
      }
      isEnquiriesFetched = true;
      render();
    }
  } catch (err) {
    console.warn("loadEnquiriesFromApi error:", err);
  }
}

async function updateEnquiryStatus(enquiryId, newStatus) {
  const item = studioEnquiries.find(e => String(e.id) === String(enquiryId));
  if (item) {
    item.status = newStatus;
  }
  notify({
    type: "good",
    title: "Enquiry Updated",
    message: `Status updated to ${newStatus.replace('_', ' ')}.`
  });
  render();

  try {
    const res = await fetch(`/api/admin/enquiries/${encodeURIComponent(enquiryId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) console.warn("API update enquiry returned", res.status);
  } catch (err) {
    console.warn("Failed to PATCH /api/admin/enquiries:", err);
  }
}

function openEnquiryModal(enquiryId) {
  const e = studioEnquiries.find(item => String(item.id) === String(enquiryId)) || {};
  const phone = e.customerPhone || "";
  const cleanDigits = phone.replace(/\D/g, "");
  const waLink = cleanDigits ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Hello ${e.customerName || 'Customer'}, regarding your 3D print request "${e.subject || 'Enquiry'}":`)}` : "";

  $("#modalRoot").innerHTML = `
    <div class="scrim" id="scrim">
      <div class="modal enquiry-detail-modal" style="max-width:580px;width:100%;border-radius:18px;background:var(--color-surface);box-shadow:0 12px 40px rgba(0,0,0,0.18);padding:0;overflow:hidden;border:1px solid var(--color-border);" role="dialog">
        <div style="padding:18px 24px;border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between;background:var(--color-surface-muted);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:10px;background:var(--color-surface);display:flex;align-items:center;justify-content:center;color:var(--color-brand,#059669);">
              ${APP_ICONS.navEnquiries}
            </div>
            <div>
              <h3 style="margin:0;font-size:16px;font-weight:700;">Customer Enquiry</h3>
              <p class="muted" style="margin:0;font-size:12px;">Received ${e.createdAt ? formatDateShort(e.createdAt) : "Recent"}</p>
            </div>
          </div>
          <button type="button" class="modal-close-x" id="modalCloseX" aria-label="Close dialog" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--color-text-secondary);">✕</button>
        </div>

        <div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px;">
          <div style="padding:14px;border-radius:12px;background:var(--color-surface-muted);border:1px solid var(--color-border);">
            <div style="font-size:14px;font-weight:700;color:var(--color-text-primary);">${esc(e.customerName || 'Customer')}</div>
            <div class="muted" style="font-size:12px;margin-top:2px;">Email: <span>${esc(e.customerEmail || '—')}</span></div>
            ${phone ? `<div class="muted" style="font-size:12px;margin-top:2px;">Phone: <span class="mono">${esc(phone)}</span></div>` : ''}
          </div>

          <div>
            <div style="font-size:12px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;margin-bottom:6px;">Subject</div>
            <div style="font-size:14px;font-weight:600;color:var(--color-text-primary);">${esc(e.subject || 'Print Request')}</div>
          </div>

          <div>
            <div style="font-size:12px;font-weight:700;color:var(--color-text-secondary);text-transform:uppercase;margin-bottom:6px;">Client Message & Specifications</div>
            <div style="font-size:13px;line-height:1.6;color:var(--color-text-primary);padding:12px 14px;border-radius:10px;background:var(--color-surface-muted);white-space:pre-wrap;">${esc(e.message || 'No description provided.')}</div>
          </div>

          <div style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding-top:8px;">
            <div>
              <span class="muted" style="font-size:12px;">Status: </span>
              <span class="pill ${e.status === 'NEW' ? 'bad' : (e.status === 'IN_REVIEW' ? 'warn' : 'good')}">${esc(e.status || 'NEW')}</span>
            </div>
            <div style="display:flex;gap:8px;">
              ${waLink ? `
                <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;background:#25D366;color:#ffffff;border:none;font-weight:600;">
                  WhatsApp
                </a>
              ` : ''}
              <button type="button" class="btn sm pri" id="btnLaunchCalc">Quote in Calculator →</button>
            </div>
          </div>
        </div>

        <div style="padding:14px 24px;border-top:1px solid var(--color-border);display:flex;justify-content:flex-end;gap:10px;background:var(--color-surface-muted);">
          <button type="button" class="btn sm" id="modalCloseBtn">Close</button>
        </div>
      </div>
    </div>
  `;

  const closeFn = () => { $("#modalRoot").innerHTML = ""; };
  const closeX = $("#modalCloseX");
  const closeBtn = $("#modalCloseBtn");
  const scrim = $("#scrim");
  const calcBtn = $("#btnLaunchCalc");
  if (closeX) closeX.addEventListener("click", closeFn);
  if (closeBtn) closeBtn.addEventListener("click", closeFn);
  if (scrim) scrim.addEventListener("click", e => { if (e.target === scrim) closeFn(); });
  if (calcBtn) calcBtn.addEventListener("click", () => { closeFn(); tab = "calc"; render(); });
}

function bindEnquiries() {
  if (!isEnquiriesFetched) {
    loadEnquiriesFromApi();
  }

  const searchInp = $("#enquirySearchInput");
  if (searchInp) {
    searchInp.addEventListener("input", e => {
      enquirySearch = e.target.value.toLowerCase().trim();
      render();
    });
  }

  $$(".enquiry-filter-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      enquiryFilter = btn.dataset.filter;
      render();
    });
  });

  $$(".select-enquiry-status").forEach(sel => {
    sel.addEventListener("change", async () => {
      const enquiryId = sel.dataset.enquiryId;
      const newStatus = sel.value;
      await updateEnquiryStatus(enquiryId, newStatus);
    });
  });

  $$(".btn-view-enquiry-modal").forEach(btn => {
    btn.addEventListener("click", () => {
      const enquiryId = btn.dataset.enquiryId;
      openEnquiryModal(enquiryId);
    });
  });
}

function vEnquiries() {
  const allList = studioEnquiries || [];
  const newCount = allList.filter(e => e.status === "NEW").length;
  const inReviewCount = allList.filter(e => e.status === "IN_REVIEW").length;
  const respondedCount = allList.filter(e => e.status === "RESPONDED").length;
  const totalCount = allList.length;

  const filtered = allList.filter(e => {
    if (enquiryFilter === "NEW" && e.status !== "NEW") return false;
    if (enquiryFilter === "IN_REVIEW" && e.status !== "IN_REVIEW") return false;
    if (enquiryFilter === "RESPONDED" && e.status !== "RESPONDED") return false;
    if (enquiryFilter === "ARCHIVED" && e.status !== "ARCHIVED") return false;

    if (enquirySearch) {
      const q = enquirySearch.toLowerCase();
      const name = String(e.customerName || "").toLowerCase();
      const email = String(e.customerEmail || "").toLowerCase();
      const phone = String(e.customerPhone || "").toLowerCase();
      const subj = String(e.subject || "").toLowerCase();
      const msg = String(e.message || "").toLowerCase();
      if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !subj.includes(q) && !msg.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const rows = filtered.map(e => {
    const phone = e.customerPhone || "";
    const cleanDigits = phone.replace(/\D/g, "");
    const waLink = cleanDigits ? `https://wa.me/${cleanDigits}?text=${encodeURIComponent(`Hello ${e.customerName || 'Customer'}, regarding your 3D print request: "${e.subject || 'Enquiry'}":`)}` : "";
    const dateStr = e.createdAt ? formatDateShort(e.createdAt) : "Recent";

    return `
      <tr>
        <td>
          <div style="font-weight:600;font-size:13.5px;">${esc(e.customerName || 'Customer')}</div>
          <div class="muted mono" style="font-size:11px;">${esc(e.customerEmail || '—')}</div>
        </td>
        <td>
          <div style="font-weight:600;font-size:13px;">${esc(e.subject || 'Print Request')}</div>
          <div class="muted" style="font-size:11.5px;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(e.message || '')}">
            ${esc(e.message || '')}
          </div>
        </td>
        <td>${dateStr}</td>
        <td>
          <select class="inp select-enquiry-status" data-enquiry-id="${esc(e.id)}" style="padding:4px 8px;font-size:12px;font-weight:600;border-radius:6px;width:auto;cursor:pointer;background:var(--color-surface);">
            <option value="NEW" ${e.status === 'NEW' ? 'selected' : ''}>New</option>
            <option value="IN_REVIEW" ${e.status === 'IN_REVIEW' ? 'selected' : ''}>In Review</option>
            <option value="RESPONDED" ${e.status === 'RESPONDED' ? 'selected' : ''}>Responded</option>
            <option value="ARCHIVED" ${e.status === 'ARCHIVED' ? 'selected' : ''}>Archived</option>
          </select>
        </td>
        <td style="text-align:right;">
          <div style="display:inline-flex;gap:6px;align-items:center;">
            ${waLink ? `
              <a href="${waLink}" target="_blank" rel="noopener noreferrer" class="btn sm" style="text-decoration:none;display:inline-flex;align-items:center;gap:4px;background:#25D366;color:#ffffff;border:none;font-weight:600;padding:4px 10px;border-radius:6px;">
                WhatsApp
              </a>
            ` : ''}
            <button type="button" class="btn sm btn-view-enquiry-modal" data-enquiry-id="${esc(e.id)}" title="View Message Details">View</button>
            <button type="button" class="btn sm" data-tab-link="calc" title="Estimate Custom CAD Quote in Calculator">Quote →</button>
          </div>
        </td>
      </tr>
    `;
  });

  return `
    <div class="module-page-wrapper enquiries-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">NEW REQUESTS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navEnquiries}</div>
          </div>
          <div class="metric-value" style="color:var(--color-warn,#f59e0b);">${newCount} <span style="font-size:16px;font-weight:500;">new</span></div>
          <div class="metric-sub">Unreviewed client custom print requests</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">IN REVIEW</span>
            <div class="metric-icon-wrap">${APP_ICONS.navCalc}</div>
          </div>
          <div class="metric-value" style="color:var(--color-accent,#0284c7);">${inReviewCount} <span style="font-size:16px;font-weight:500;">evaluating</span></div>
          <div class="metric-sub">Model CAD slicing & estimation in progress</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">RESPONDED</span>
            <div class="metric-icon-wrap">${APP_ICONS.checkSuccess(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">${respondedCount} <span style="font-size:16px;font-weight:500;">quoted</span></div>
          <div class="metric-sub">Official quotations sent via WhatsApp / Email</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">TOTAL ENQUIRIES</span>
            <div class="metric-icon-wrap">${APP_ICONS.navQuotes}</div>
          </div>
          <div class="metric-value">${totalCount} <span style="font-size:16px;font-weight:500;">total</span></div>
          <div class="metric-sub">Lifetime custom studio lead volume</div>
        </div>
      </div>

      <div class="card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;margin-bottom:16px;">
        <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="display:flex;gap:8px;align-items:center;flex:1;min-width:280px;max-width:480px;">
            <input type="search" id="enquirySearchInput" class="inp" placeholder="Search enquiries by client, email, phone, subject..." value="${esc(enquirySearch)}" style="width:100%;">
          </div>
          <div class="segmented-control" role="group" aria-label="Enquiry Filter" style="display:flex;gap:4px;">
            <button type="button" class="segment-btn enquiry-filter-pill ${enquiryFilter === 'ALL' ? 'active' : ''}" data-filter="ALL">All (${totalCount})</button>
            <button type="button" class="segment-btn enquiry-filter-pill ${enquiryFilter === 'NEW' ? 'active' : ''}" data-filter="NEW">New (${newCount})</button>
            <button type="button" class="segment-btn enquiry-filter-pill ${enquiryFilter === 'IN_REVIEW' ? 'active' : ''}" data-filter="IN_REVIEW">In Review (${inReviewCount})</button>
            <button type="button" class="segment-btn enquiry-filter-pill ${enquiryFilter === 'RESPONDED' ? 'active' : ''}" data-filter="RESPONDED">Responded (${respondedCount})</button>
            <button type="button" class="segment-btn enquiry-filter-pill ${enquiryFilter === 'ARCHIVED' ? 'active' : ''}" data-filter="ARCHIVED">Archived</button>
          </div>
        </div>
        ${table(["Customer", "Enquiry Subject & Scope", "Date", "Status", ""], rows, "No enquiries matching current filter.")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Financial Reports View (Finance)
   ========================================================================== */
function vReports() {
  const invoices = S.invoices || [];
  const expenses = S.expenses || [];
  const prints = S.prints || [];

  const totalRev = invoices.reduce((acc, i) => acc + (invTotals(i).total || 0), 0);
  const totalExp = expenses.reduce((acc, e) => acc + N(e.amount), 0);
  const totalFilGrams = prints.reduce((acc, p) => acc + N(p.grams), 0);
  const estFilCost = (totalFilGrams / 1000) * 75;
  const netOperating = totalRev - totalExp - estFilCost;

  return `
    <div class="module-page-wrapper reports-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">GROSS BILLED REVENUE</span>
            <div class="metric-icon-wrap">${APP_ICONS.navInvoices}</div>
          </div>
          <div class="metric-value">${money(totalRev)}</div>
          <div class="metric-sub">${invoices.length} sales invoices issued</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">TOTAL OPERATING EXPENSES</span>
            <div class="metric-icon-wrap">${APP_ICONS.navExpenses}</div>
          </div>
          <div class="metric-value">${money(totalExp)}</div>
          <div class="metric-sub">${expenses.length} operating expense vouchers</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">FILAMENT COGS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navFilaments}</div>
          </div>
          <div class="metric-value">${money(estFilCost)}</div>
          <div class="metric-sub">${(totalFilGrams / 1000).toFixed(2)} kg consumed in printing</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">NET OPERATING MARGIN</span>
            <div class="metric-icon-wrap">${APP_ICONS.metricProfit(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:${netOperating >= 0 ? 'var(--color-brand,#059669)' : '#ef4444'};">
            ${money(netOperating)}
          </div>
          <div class="metric-sub">Operating profit before taxes</div>
        </div>
      </div>

      <div class="card" style="padding:20px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:15px;font-weight:700;">Executive Business Intelligence & Tax Export</h3>
            <p class="muted" style="margin:0;font-size:12.5px;">Download official corporate financial reports, tax audit records, and raw spreadsheet books</p>
          </div>
          <div style="display:flex;gap:8px;">
            <button type="button" class="btn btn-pill" id="xlsAll">${APP_ICONS.btnExcel()} <span>Export Master Excel</span></button>
            <button type="button" class="btn pri btn-pill-primary" id="pdfReport">${APP_ICONS.btnPdf()} <span>Generate PDF Report</span></button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   Reminders View (Automation)
   ========================================================================== */
function vReminders() {
  const unpaidInvs = (S.invoices || []).filter(i => invTotals(i).bal > 0.01);
  const reminders = [
    { title: "Nozzle Wear Inspection (0.4mm P2S)", cat: "Maintenance", due: "Every 300 hrs", priority: "Routine", desc: "Inspect standard flow hardened steel nozzle for abrasive wear from carbon/glow filaments." },
    { title: "Textured PEI Build Plate Wash", cat: "Maintenance", due: "Every 15 prints", priority: "Routine", desc: "Wash build plate with warm water and detergent to restore adhesion and remove skin oils." },
    { title: `Follow up on ${unpaidInvs.length} Outstanding Payment(s)`, cat: "Commercial", due: "Today", priority: unpaidInvs.length > 0 ? "Urgent" : "Low", desc: `Send payment reminder statement for total balance of ${money(unpaidInvs.reduce((acc, i) => acc + invTotals(i).bal, 0))}.` }
  ];

  return `
    <div class="module-page-wrapper reminders-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">ACTIVE REMINDERS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navReminders}</div>
          </div>
          <div class="metric-value">${reminders.length} <span style="font-size:16px;font-weight:500;">alerts</span></div>
          <div class="metric-sub">Studio maintenance & operational cues</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">URGENT COMMERCIAL FOLLOW-UPS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navInvoices}</div>
          </div>
          <div class="metric-value" style="color:${unpaidInvs.length > 0 ? '#ef4444' : 'var(--color-brand,#059669)'};">
            ${unpaidInvs.length}
          </div>
          <div class="metric-sub">Unpaid customer invoices pending</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">MACHINE HEALTH STATUS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navPrints}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">Optimal</div>
          <div class="metric-sub">Bambu Lab P2S telemetry normal</div>
        </div>
      </div>

      <div class="reminders-list" style="display:flex;flex-direction:column;gap:12px;">
        ${reminders.map(r => `
          <div class="card" style="padding:16px 20px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
            <div style="display:flex;align-items:flex-start;gap:14px;">
              <div style="width:36px;height:36px;border-radius:50%;background:var(--color-surface-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                ${APP_ICONS.navReminders}
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                  <strong style="font-size:14px;">${esc(r.title)}</strong>
                  <span class="pill ${r.priority === 'Urgent' ? 'bad' : 'neu'}" style="font-size:11px;">${r.priority}</span>
                  <span class="pill good" style="font-size:11px;">${r.cat}</span>
                </div>
                <p class="muted" style="margin:0;font-size:12.5px;">${esc(r.desc)}</p>
              </div>
            </div>
            <div style="flex-shrink:0;">
              <button type="button" class="btn sm" onclick="this.textContent = 'Acknowledged'; this.disabled = true;">Mark Complete</button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Automation History View (Automation)
   ========================================================================== */
function vAutomationHistory() {
  const prints = S.prints || [];
  const logs = [
    { event: "Bambu Cloud Sync Task Polling", device: "Bambu P2S (3DP-22E-489)", time: "Just now", status: "Success", details: `Polled cloud tasks endpoint; 219 completed tasks verified.` },
    { event: "Presigned S3 Thumbnail Backfill", device: "Cloud S3 Storage", time: "Today", status: "Success", details: "Active model photo thumbnails synchronized." },
    { event: "Auto Elapsed Duration Ingestion", device: "Task Duration Worker", time: "Today", status: "Success", details: "Calculated actual print elapsed duration from startTime and endTime." },
    { event: "PostgreSQL Live Synchronization", device: "Neon Serverless", time: "Today", status: "Success", details: "Bidirectional cloud ledger synchronization completed." }
  ];

  return `
    <div class="module-page-wrapper automation-page-wrapper">
      <div class="kpis" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">AUTOMATION ENGINE</span>
            <div class="metric-icon-wrap">${APP_ICONS.navAutomation}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">Active</div>
          <div class="metric-sub">Bambu Cloud & Neon DB Event Sync</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">RECORDED CLOUD TASKS</span>
            <div class="metric-icon-wrap">${APP_ICONS.navPrints}</div>
          </div>
          <div class="metric-value">${prints.length} <span style="font-size:16px;font-weight:500;">jobs</span></div>
          <div class="metric-sub">Historical print jobs ingested</div>
        </div>
        <div class="metric-card">
          <div class="metric-top">
            <span class="metric-label">SYNC RELIABILITY</span>
            <div class="metric-icon-wrap">${APP_ICONS.checkSuccess(18, 2)}</div>
          </div>
          <div class="metric-value" style="color:var(--color-brand,#059669);">100%</div>
          <div class="metric-sub">0 dropped Webhook/API events</div>
        </div>
      </div>

      <div class="card" style="padding:16px;background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h3 style="margin:0;font-size:15px;font-weight:700;">Studio Automation & Cloud Sync Event Log</h3>
          ${renderSyncBambuBtn(false)}
        </div>
        ${table(
          ["Event", "Integration / Service", "Time", "Details", "Status"],
          logs.map(l => `
            <tr>
              <td><strong>${esc(l.event)}</strong></td>
              <td class="mono" style="font-size:12px;">${esc(l.device)}</td>
              <td style="font-size:12px;">${esc(l.time)}</td>
              <td style="font-size:12.5px;">${esc(l.details)}</td>
              <td><span class="pill good">● ${esc(l.status)}</span></td>
            </tr>
          `),
          "No automation logs recorded."
        )}
      </div>
    </div>
  `;
}

/* ==========================================================================
   Settings View (DESIGN.md Modern SaaS Standard)
   ========================================================================== */
function vSettings() {
  const st = set_();
  const f = (k, l, t = "text", step) => `<label class="f">${l}<input id="s_${k}" type="${t}" ${step ? `step="${step}"` : ""} value="${esc(st[k])}"></label>`;

  return `
    <div class="settings-page-wrapper">
      <div class="settings-grid">
        <!-- Business Details Card -->
        <div class="panel settings-card">
          <div class="calc-card-header">
            <div class="calc-card-title-group">
              <div class="calc-header-icon">
                ${APP_ICONS.navInvoices}
              </div>
              <div>
                <h3 class="calc-card-title">Business details</h3>
                <div class="calc-card-desc">Profile information appearing on generated invoices, receipts & PDFs</div>
              </div>
            </div>
          </div>

          <div class="fgrid">
            ${f("bizName", "Business name")}
            ${f("phone", "Phone")}
            ${f("email", "Email")}
            ${f("address", "Address")}
            ${f("trn", "TRN (VAT number)")}
            ${f("currency", "Currency")}
            ${f("vatPct", "VAT %", "number", "0.01")}
            <label class="f wide">Invoice terms / footer<textarea id="s_invoiceTerms">${esc(st.invoiceTerms)}</textarea></label>
            <label class="f wide">Storage locations (comma separated)<input id="s_locations" value="${esc(st.locations)}"></label>
          </div>
        </div>

        <!-- Cost Rates Card -->
        <div class="panel settings-card">
          <div class="calc-card-header">
            <div class="calc-card-title-group">
              <div class="calc-header-icon">
                ${APP_ICONS.navCalc}
              </div>
              <div>
                <h3 class="calc-card-title">Cost rates</h3>
                <div class="calc-card-desc">Machine wear, power, labour & markup percentages used in calculations</div>
              </div>
            </div>
          </div>

          <div class="fgrid">
            ${f("kw", "Printer average power (kW)", "number", "0.01")}
            ${f("elecRate", "Electricity " + cur() + "/kWh", "number", "0.01")}
            ${f("machineRate", "Machine wear " + cur() + "/hour", "number", "0.01")}
            ${f("laborRate", "Labour " + cur() + "/hour", "number", "0.01")}
            ${f("failPct", "Failure allowance %", "number", "0.1")}
            ${f("agentMarkup", "Agent markup %", "number", "1")}
            ${f("directMarkup", "Direct markup %", "number", "1")}
          </div>

          <div class="calc-rates-pill" style="margin-top:14px;">
            <span>A Bambu Lab P2S averages roughly 0.1–0.15 kW while printing PLA. Machine wear spreads the printer price and spare parts over its working hours.</span>
          </div>
        </div>

        <!-- Bambu Lab Cloud Integration Card -->
        <div class="panel settings-card" style="grid-column: 1 / -1;">
          <div class="calc-card-header">
            <div class="calc-card-title-group">
              <div class="calc-header-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                  <path d="M8 16H3v5"></path>
                </svg>
              </div>
              <div>
                <h3 class="calc-card-title">Bambu Lab Cloud Integration</h3>
                <div class="calc-card-desc">Personal API token for automatic real-time print task syncing and reconciliation</div>
              </div>
            </div>
          </div>

          <div class="fgrid">
            <label class="f wide">Bambu Cloud Bearer Token<input id="s_bambuToken" type="password" value="${esc(st.bambuToken || "")}" placeholder="${st.hasBambuToken || st.bambuToken ? "•••••••• (configured — enter new token to update)" : "AQCr... or eyJ..."}"></label>
          </div>
        </div>
      </div>
    </div>
  `;
}

const handleDocClickSettings = async e => {
  const t = e.target;
  if (t.id === "saveSettings") {
    const d = {};
    Object.keys(DEF).forEach(k => { const el = $("#s_" + k); if (el) d[k] = el.type === "number" ? N(el.value) : el.value; });
    // Safeguard: preserve existing token if mask "••••••••" or empty
    if (d.bambuToken === "••••••••" || !d.bambuToken) {
      if (S.settings && S.settings.bambuToken && S.settings.bambuToken !== "••••••••") {
        d.bambuToken = S.settings.bambuToken;
      } else {
        delete d.bambuToken;
      }
    }
    try {
      const r = await saveSettings(d);
      notify({
        type: "success",
        title: "Settings Saved",
        message: "Studio profile and cost rates updated."
      });
    } catch(_) {}
  }
  if (t.id === "clrEx") {
    openDeleteModal("examples", null);
    return;
  }
  if (t.id === "clrNo") render();

  const delBtn = t.id === "clrYes" ? t : null;
  if (delBtn) {
    if (db) {
      for (const c of COLLS) {
        for (const x of S[c].filter(x => x.example)) await del(c, x.id);
      }
    } else {
      for (const c of COLLS) {
        S[c] = (S[c] || []).filter(x => !x.example);
        store.persist(c);
      }
    }
    toast("Sample data deleted");
    render();
    return;
  }

  const resetBtn = t.id === "reseedBtn" ? t : null;
  if (resetBtn) {
    if (confirm("Reset and reload all Print Studio sample records?")) {
      const seed = getSampleRecords();
      if (db) {
        for (const c of COLLS) {
          for (const x of (seed[c] || [])) await save(c, x.id, x);
        }
      } else {
        COLLS.forEach(c => {
          const nonExamples = (S[c] || []).filter(x => !x.example);
          S[c] = [...nonExamples, ...(seed[c] || [])];
          store.persist(c);
        });
      }
      toast("Sample data restored");
      render();
    }
    return;
  }
};
document.addEventListener("click", handleDocClickSettings);

/* ==========================================================================
   Modals & Form Engine (Ditto Copy Schema + Medsathi Precision Styling)
   ========================================================================== */
const locOpts = () => `<datalist id="locs">${String(set_().locations || "").split(",").map(s => s.trim()).filter(Boolean).map(s => `<option value="${esc(s)}">`).join("")}</datalist>`;

const FORMS = {
  filaments: {
    title: "Filament",
    fields: [
      ["name", "Name (e.g. PLA Matte Black)", "text", 1],
      ["material", "Material", "sel:PLA,PLA+,PETG,ABS,ASA,TPU,PLA Silk,PLA Matte,PA/Nylon,PC,Other"],
      ["brand", "Brand"],
      ["color", "Colour", "color"],
      ["weightG", "Total weight bought (g)", "number"],
      ["price", "Price paid", "number"],
      ["location", "Stored at", "loc"],
      ["minG", "Alert when below (g)", "number"],
      ["adjustG", "Weight correction ± (g)", "number"],
      ["date", "Purchase date", "date"]
    ]
  },
  prints: {
    title: "Print job",
    fields: [
      ["date", "Date", "date", 1],
      ["productId", "Item printed", "prod", 1],
      ["statusLabel", "Status", "sel:Success,Printing,Canceled,Failed"],
      ["qty", "Good pieces", "number"],
      ["failed", "Failed pieces", "number"],
      ["filamentId", "Filament used", "fil"],
      ["grams", "Filament used total (g)", "number"],
      ["hours", "Print time total (h)", "number"],
      ["note", "Note", "text"]
    ]
  },
  expenses: {
    title: "Expense",
    fields: [
      ["date", "Date", "date", 1],
      ["category", "Category", "sel:" + EXP_CATS.join(",")],
      ["amount", "Amount", "number", 1],
      ["desc", "Description", "text"]
    ]
  }
};

const FILAMENT_SWATCHES = [
  // Neutrals & Monochromes
  { hex: "#111827", name: "Matte Black", darkText: false },
  { hex: "#4B5563", name: "Charcoal Gray", darkText: false },
  { hex: "#9CA3AF", name: "Silver Gray", darkText: true },
  { hex: "#FFFFFF", name: "Pure White", darkText: true },
  { hex: "#F1F5F9", name: "Natural / Clear", darkText: true },
  { hex: "#78350F", name: "Wood / Terra", darkText: false },

  // Warm & Vivid
  { hex: "#EF4444", name: "Signal Red", darkText: false },
  { hex: "#F97316", name: "Safety Orange", darkText: false },
  { hex: "#EAB308", name: "Sunflower Yellow", darkText: true },
  { hex: "#D97706", name: "Silk Gold", darkText: false },
  { hex: "#B45309", name: "Silk Copper", darkText: false },
  { hex: "#F43F5E", name: "Crimson Coral", darkText: false },

  // Greens & Teals
  { hex: "#10B981", name: "Bambu Green", darkText: false },
  { hex: "#15803D", name: "Pine Green", darkText: false },
  { hex: "#84CC16", name: "Neon Lime", darkText: true },
  { hex: "#0D9488", name: "PolyTerra Teal", darkText: false },
  { hex: "#06B6D4", name: "Cyan / Sky", darkText: true },
  { hex: "#2563EB", name: "Royal Blue", darkText: false },

  // Purples & Accents
  { hex: "#1E3A8A", name: "Galaxy Navy", darkText: false },
  { hex: "#6366F1", name: "Iris Indigo", darkText: false },
  { hex: "#8B5CF6", name: "Electric Purple", darkText: false },
  { hex: "#EC4899", name: "Magenta Pink", darkText: false },
  { hex: "#C084FC", name: "Lavender", darkText: true },
  { hex: "#334155", name: "Carbon Slate", darkText: false }
];

function getFilamentColorName(hex) {
  if (!hex) return "Matte Black";
  const h = hex.toLowerCase().trim();
  const match = FILAMENT_SWATCHES.find(s => s.hex.toLowerCase() === h);
  if (match) return match.name;
  return "Custom Color";
}

function colorPickerHtml(id, label, value) {
  const currentHex = safeColor(value || "#111827");
  const colorName = getFilamentColorName(currentHex);

  const quickSwatches = [
    { hex: "#111827", name: "Matte Black" },
    { hex: "#FFFFFF", name: "Pure White" },
    { hex: "#4B5563", name: "Charcoal" },
    { hex: "#EF4444", name: "Signal Red" },
    { hex: "#2563EB", name: "Royal Blue" },
    { hex: "#10B981", name: "Bambu Green" },
    { hex: "#F97316", name: "Safety Orange" }
  ];

  return `
    <div class="f color-picker-form-group" id="colorPickerGroup">
      <label class="color-picker-label" for="${id}">${label}</label>
      <div class="color-picker-anchor">
        <button type="button" class="color-picker-trigger" id="colorPickerBtn" aria-haspopup="dialog" aria-expanded="false" title="Click to choose from filament palette">
          <span class="color-picker-swatch-circle" id="colorPickerCircle" style="background-color: ${currentHex};"></span>
          <span class="color-picker-name" id="colorPickerNameText">${esc(colorName)}</span>
          <span class="color-picker-hex mono" id="colorPickerHexText">${currentHex.toUpperCase()}</span>
          <svg class="color-picker-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>

        <input type="hidden" id="${id}" value="${currentHex}">

        <!-- Quick Swatches Row -->
        <div class="color-quick-row">
          <span class="color-quick-label">Quick:</span>
          <div class="color-quick-dots">
            ${quickSwatches.map(q => `
              <button type="button" class="color-quick-dot ${q.hex.toLowerCase() === currentHex.toLowerCase() ? 'active' : ''}" 
                data-hex="${q.hex}" data-name="${q.name}" title="${q.name}" style="background-color: ${q.hex};">
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Floating Popover Palette -->
        <div class="color-picker-popover" id="colorPickerPopover" hidden>
          <div class="color-popover-header">
            <span class="color-popover-title">Filament Swatches</span>
            <div class="color-popover-badge">
              <span class="popover-badge-dot" style="background-color: ${currentHex};"></span>
              <span class="popover-badge-name">${esc(colorName)}</span>
            </div>
          </div>

          <div class="color-swatches-grid">
            ${FILAMENT_SWATCHES.map(s => {
              const isSelected = s.hex.toLowerCase() === currentHex.toLowerCase();
              return `
                <button type="button" class="color-swatch-item ${isSelected ? 'active' : ''}" 
                  data-hex="${s.hex}" data-name="${s.name}" title="${s.name} (${s.hex})">
                  <span class="color-swatch-dot" style="background-color: ${s.hex};">
                    <svg class="color-swatch-check" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="${s.darkText ? '#062C2F' : '#FFFFFF'}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                </button>
              `;
            }).join('')}
          </div>

          <div class="color-popover-custom-section">
            <div class="color-popover-custom-label">Custom Hex Code</div>
            <div class="color-custom-input-row">
              <div class="color-dropper-preview" title="Open eyedropper / custom picker" style="background-color: ${currentHex};">
                <input type="color" id="nativeColorProxy" value="${currentHex}" class="native-color-invisible" aria-label="Custom color picker">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" class="dropper-svg-icon">
                  <path d="M19 11l-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3L6 18l-3 3 1.5 1.5L8 19l3.5 3.5a2.12 2.12 0 0 0 3 0L19 11Z"/>
                </svg>
              </div>
              <div class="color-hex-field-wrap">
                <span class="color-hex-prefix">#</span>
                <input type="text" id="customHexField" maxlength="6" value="${currentHex.replace('#', '').toUpperCase()}" placeholder="10B981" class="mono color-hex-text-input" spellcheck="false">
              </div>
              <button type="button" class="btn sm color-hex-apply-btn" id="applyHexCustomBtn">Apply</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function bindColorPicker() {
  const group = $("#colorPickerGroup");
  const btn = $("#colorPickerBtn");
  const popover = $("#colorPickerPopover");
  const hiddenInput = $("#m_color");
  const swatchCircle = $("#colorPickerCircle");
  const nameText = $("#colorPickerNameText");
  const hexText = $("#colorPickerHexText");
  const customHex = $("#customHexField");
  const nativeProxy = $("#nativeColorProxy");
  const dropperPreview = $(".color-dropper-preview");
  const popoverBadgeDot = $(".popover-badge-dot");
  const popoverBadgeName = $(".popover-badge-name");

  if (!btn || !popover || !hiddenInput) return;

  const closePopover = () => {
    popover.hidden = true;
    btn.setAttribute("aria-expanded", "false");
    btn.classList.remove("open");
    if (group) group.classList.remove("open");
  };

  const setColor = (hex, name) => {
    const validHex = safeColor(hex);
    const colorName = name || getFilamentColorName(validHex);
    hiddenInput.value = validHex;
    hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Update trigger UI
    if (swatchCircle) swatchCircle.style.backgroundColor = validHex;
    if (nameText) nameText.textContent = colorName;
    if (hexText) hexText.textContent = validHex.toUpperCase();
    const colorNameField = $("#m_colorName");
    if (colorNameField) colorNameField.value = colorName;

    // Update popover UI
    if (popoverBadgeDot) popoverBadgeDot.style.backgroundColor = validHex;
    if (popoverBadgeName) popoverBadgeName.textContent = colorName;
    if (dropperPreview) dropperPreview.style.backgroundColor = validHex;
    if (customHex) customHex.value = validHex.replace("#", "").toUpperCase();
    if (nativeProxy) nativeProxy.value = validHex;

    // Update active swatch state in grid
    $$(".color-swatch-item").forEach(item => {
      const match = item.dataset.hex.toLowerCase() === validHex.toLowerCase();
      item.classList.toggle("active", match);
    });

    // Update quick dots
    $$(".color-quick-dot").forEach(dot => {
      const match = dot.dataset.hex.toLowerCase() === validHex.toLowerCase();
      dot.classList.toggle("active", match);
    });
  };

  // Toggle popover
  btn.onclick = e => {
    e.preventDefault();
    e.stopPropagation();
    const isHidden = popover.hidden;
    popover.hidden = !isHidden;
    btn.setAttribute("aria-expanded", String(isHidden));
    btn.classList.toggle("open", isHidden);
    if (group) group.classList.toggle("open", isHidden);
  };

  // Swatch selection in popover
  popover.onclick = e => {
    const swatch = e.target.closest(".color-swatch-item");
    if (swatch) {
      e.preventDefault();
      e.stopPropagation();
      setColor(swatch.dataset.hex, swatch.dataset.name);
      closePopover();
      return;
    }
  };

  // Quick swatches selection under trigger
  const quickRow = $(".color-quick-dots");
  if (quickRow) {
    quickRow.onclick = e => {
      const dot = e.target.closest(".color-quick-dot");
      if (dot) {
        e.preventDefault();
        e.stopPropagation();
        setColor(dot.dataset.hex, dot.dataset.name);
      }
    };
  }

  // Custom Hex Code Apply
  const applyBtn = $("#applyHexCustomBtn");
  if (applyBtn && customHex) {
    const handleApply = () => {
      let raw = customHex.value.trim().replace(/^#/, "");
      if (/^[0-9a-fA-F]{3}$/.test(raw)) {
        raw = raw.split("").map(c => c + c).join("");
      }
      if (/^[0-9a-fA-F]{6}$/.test(raw)) {
        setColor("#" + raw, null);
        closePopover();
      }
    };
    applyBtn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      handleApply();
    };
    customHex.onkeydown = e => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    };
  }

  // Native color picker proxy
  if (nativeProxy) {
    nativeProxy.oninput = e => {
      setColor(e.target.value, null);
    };
    nativeProxy.onchange = e => {
      setColor(e.target.value, null);
      closePopover();
    };
  }

  // Click outside to dismiss popover
  const handleDocClick = e => {
    if (!popover.hidden && !popover.contains(e.target) && !btn.contains(e.target)) {
      closePopover();
    }
  };
  document.addEventListener("click", handleDocClick);
}

function fieldHtml(k, l, type, obj) {
  const v = obj[k] ?? "";
  const id = "m_" + k;
  if (type === "photo") return `<div class="f wide"><span style="font-size:12px;color:var(--ink2);font-weight:600">${l}</span><div class="photo-pick"><img id="m_photoPrev" src="${photoSrc(v)}" alt="" ${photoSrc(v) ? "" : "hidden"}><input type="file" accept="image/*" id="m_photoFile"><button class="btn sm" type="button" id="m_photoClr" ${v ? "" : "hidden"}>Remove</button></div><input type="hidden" id="${id}" value="${esc(v)}"></div>`;
  if (type === "textarea") return `<label class="f wide">${l}<textarea id="${id}">${esc(v)}</textarea></label>`;
  if (type === "fil") return `<label class="f">${l}<select id="${id}"><option value="">—</option>${S.filaments.map(f => `<option value="${f.id}" ${f.id === v ? "selected" : ""}>${esc(f.name)} · ${m0(filLeft(f))} g left</option>`).join("")}</select></label>`;
  if (type === "prod") return `<label class="f">${l}<select id="${id}" required><option value="">— choose —</option>${S.products.map(p => `<option value="${p.id}" ${p.id === v ? "selected" : ""}>${esc(cleanModelTitle(p.name))}</option>`).join("")}</select></label>`;
  if (type === "loc") return `<label class="f">${l}<input id="${id}" list="locs" value="${esc(v)}"></label>`;
  if (type.startsWith("sel:")) return `<label class="f">${l}<select id="${id}">${type.slice(4).split(",").map(o => `<option ${o === v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  if (type === "color") return colorPickerHtml(id, l, v);
  return `<label class="f">${l}<input id="${id}" type="${type || "text"}" ${type === "number" ? 'step="any"' : ""} value="${esc(v)}"></label>`;
}

function closeModal() {
  $("#modalRoot").innerHTML = "";
}

/* ==========================================================================
   Unique Delete Confirmation Pop-up Dialog (Modern SaaS Standard)
   ========================================================================== */
function openDeleteModal(coll, id) {
  const item = byId(coll, id) || {};
  let title = "Confirm Deletion";
  let subtitle = "Are you sure you want to permanently remove this record? This action cannot be undone.";
  let confirmLabel = "Delete Record";
  let previewHtml = "";

  if (coll === "products") {
    title = "Delete Product";
    subtitle = "Are you sure you want to delete this product? All logged stock values associated with it may be impacted.";
    confirmLabel = "Delete Product";
    const st = stockOf(item);
    previewHtml = `
      <div class="del-preview-card">
        <div class="del-preview-thumb">
          ${item.photo ? `<img src="${item.photo}" class="del-preview-img" alt="${esc(item.name)}">` : `<div class="del-preview-ph">${APP_ICONS.feedPackage(20)}</div>`}
        </div>
        <div class="del-preview-main">
          <div class="del-preview-title">${esc(item.name || "Untitled Product")}</div>
          <div class="del-preview-meta">${esc(item.sku || "No SKU")} · ${esc(item.category || "General")}</div>
        </div>
        <div class="del-preview-stats">
          <span class="pill ${st <= 0 ? "bad" : "good"}">${m0(st)} in stock</span>
          <span class="del-preview-num num">${money(item.directPrice)}</span>
        </div>
      </div>
    `;
  } else if (coll === "filament_stock" || coll === "filaments") {
    title = "Delete Filament Spool";
    subtitle = "Are you sure you want to permanently remove this filament spool from your catalog?";
    confirmLabel = "Delete Spool";
    const brand = item.brand || "";
    const mat = item.material || "PLA";
    const colName = item.colorName || "";
    const color = item.color || "#A03CF7";
    const qty = Math.max(1, N(item.quantity !== undefined ? item.quantity : (item.spoolQty !== undefined ? item.spoolQty : 1)));
    const price = N(item.price !== undefined ? item.price : (item.costPerSpool !== undefined ? item.costPerSpool : 75));
    const weightG = N(item.weightG || 1000);
    const totalVal = N(item.totalCost || (price * qty));
    previewHtml = `
      <div class="del-preview-card">
        <div class="del-preview-thumb" style="display:flex;align-items:center;justify-content:center;background:transparent;overflow:visible;">
          ${renderFilamentSpool({ color, colorName: colName, material: mat, size: 52 })}
        </div>
        <div class="del-preview-main">
          <div class="del-preview-title">${esc(brand)} ${esc(mat)} · ${esc(colName)}</div>
          <div class="del-preview-meta">${esc(item.diameter || "1.75 mm")} · ${qty} spool${qty > 1 ? 's' : ''} (${(qty * weightG / 1000).toFixed(1)} kg)</div>
        </div>
        <div class="del-preview-stats">
          <span class="pill good">${price.toFixed(2)} ${cur()}</span>
          <span class="del-preview-num num">${totalVal.toFixed(2)} ${cur()}</span>
        </div>
      </div>
    `;
  } else if (coll === "prints") {
    title = "Delete Print Log Entry";
    subtitle = "Are you sure you want to delete this print job? Filament and stock quantities will be recalculated.";
    confirmLabel = "Delete Print Entry";
    const pr = byId("products", item.productId) || {};
    const f = byId("filaments", item.filamentId);
    previewHtml = `
      <div class="del-preview-card">
        <div class="del-preview-thumb">
          <div class="del-preview-ph">${APP_ICONS.feedPrint(20)}</div>
        </div>
        <div class="del-preview-main">
          <div class="del-preview-title">${esc(pr.name || "Custom print job")}</div>
          <div class="del-preview-meta">${formatDateShort(item.date)} ${String(item.date || "").slice(0, 4)} · ${f ? esc(f.name) : "No filament"}</div>
        </div>
        <div class="del-preview-stats">
          <span class="pill good">${m0(item.qty)} pcs</span>
          <span class="del-preview-num num">${m1(item.grams)} g</span>
        </div>
      </div>
    `;
  } else if (coll === "invoices") {
    const typeLabel = { sale: "Invoice", quote: "Price Offer", foc: "FOC Order" }[item.type] || "Document";
    title = `Delete ${typeLabel}`;
    subtitle = `Are you sure you want to delete this ${typeLabel.toLowerCase()}? Financial accounts and receivables will be recalculated.`;
    confirmLabel = `Delete ${typeLabel}`;
    const t = invTotals(item);
    previewHtml = `
      <div class="del-preview-card">
        <div class="del-preview-thumb">
          <div class="del-preview-ph">${APP_ICONS.feedSale(20)}</div>
        </div>
        <div class="del-preview-main">
          <div class="del-preview-title">${esc(item.no || "INV")} · ${typeLabel}</div>
          <div class="del-preview-meta">${esc(item.customer || "Walk-in customer")} · ${formatDateShort(item.date)}</div>
        </div>
        <div class="del-preview-stats">
          <span class="pill ${item.status === "paid" ? "good" : item.status === "part" ? "warn" : "neu"}">${item.status || "issued"}</span>
          <span class="del-preview-num num">${money(t.total)}</span>
        </div>
      </div>
    `;
  } else if (coll === "expenses") {
    title = "Delete Expense";
    subtitle = "Are you sure you want to delete this expense record? It will be removed from your monthly profit & loss accounts.";
    confirmLabel = "Delete Expense";
    previewHtml = `
      <div class="del-preview-card">
        <div class="del-preview-thumb">
          <div class="del-preview-ph">${APP_ICONS.feedAlert(20)}</div>
        </div>
        <div class="del-preview-main">
          <div class="del-preview-title">${esc(item.desc || item.category || "Expense")}</div>
          <div class="del-preview-meta">${esc(item.category || "General")} · ${formatDateShort(item.date)}</div>
        </div>
        <div class="del-preview-stats">
          <span class="pill neu">${esc(item.category || "Expense")}</span>
          <span class="del-preview-num num">${money(item.amount)}</span>
        </div>
      </div>
    `;
  } else if (coll === "examples") {
    title = "Delete Example Records";
    subtitle = "Are you sure you want to delete all pre-loaded sample records? Your custom records will remain intact.";
    confirmLabel = "Delete All Examples";
    const nEx = COLLS.reduce((a, c) => a + S[c].filter(x => x.example).length, 0);
    previewHtml = `
      <div class="del-preview-card">
        <div class="del-preview-thumb">
          <div class="del-preview-ph">${APP_ICONS.feedAlert(20)}</div>
        </div>
        <div class="del-preview-main">
          <div class="del-preview-title">Sample Demonstration Data</div>
          <div class="del-preview-meta">Across products, filaments, prints & invoices</div>
        </div>
        <div class="del-preview-stats">
          <span class="pill warn">${nEx} sample records</span>
        </div>
      </div>
    `;
  }

  const html = `
    <div class="scrim del-scrim" id="delModalScrim">
      <div class="del-modal-card" role="dialog" aria-modal="true" aria-labelledby="delModalTitle">
        <!-- Close button top-right -->
        <button type="button" class="del-modal-close" id="delModalCloseBtn" title="Close dialog" aria-label="Close dialog">✕</button>

        <!-- Danger Icon & Title Header -->
        <div class="del-modal-header">
          <div class="del-icon-badge">
            <div class="del-icon-ring">
              ${APP_ICONS.btnDelete(22, 2)}
            </div>
          </div>
          <div class="del-modal-text">
            <h3 class="del-modal-title" id="delModalTitle">${title}</h3>
            <p class="del-modal-desc">${subtitle}</p>
          </div>
        </div>

        <!-- Visual Item Preview Box -->
        ${previewHtml}

        <!-- Actions -->
        <div class="del-modal-actions">
          <button type="button" class="btn btn-pill del-btn-cancel" id="delModalCancelBtn">
            Cancel
          </button>
          <button type="button" class="del-btn-confirm" id="delModalConfirmBtn">
            ${APP_ICONS.btnDelete(15, 2)}
            <span>${confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  $("#modalRoot").innerHTML = html;

  // Focus cancel button for safe keyboard interaction
  setTimeout(() => {
    const cancelBtn = $("#delModalCancelBtn");
    if (cancelBtn) cancelBtn.focus();
  }, 50);

  // Close handlers with smooth animation
  const closeDel = () => {
    const card = $(".del-modal-card");
    const scrim = $("#delModalScrim");
    if (card && scrim) {
      card.classList.add("del-out");
      scrim.classList.add("del-out");
      setTimeout(closeModal, 160);
    } else {
      closeModal();
    }
  };

  $("#delModalCloseBtn").onclick = closeDel;
  $("#delModalCancelBtn").onclick = closeDel;
  $("#delModalScrim").addEventListener("mousedown", e => {
    if (e.target.id === "delModalScrim") closeDel();
  });

  // Confirm handler
  $("#delModalConfirmBtn").onclick = async () => {
    const btn = $("#delModalConfirmBtn");
    btn.disabled = true;
    btn.innerHTML = `<span class="spin">⏳</span> <span>Deleting…</span>`;

    const itemName = item ? (item.name || item.no || item.category || "Item") : "Item";

    try {
      if (coll === "examples") {
        for (const c of COLLS) {
          for (const x of S[c].filter(x => x.example)) await del(c, x.id);
        }
        notify({
          type: "delete",
          title: "Sample Data Cleared",
          message: "All example demo records were removed."
        });
      } else {
        const r = await del(coll, id);
        if (coll === "filament_stock") {
          try {
            if (S.filaments && S.filaments.some(x => x.id === id)) {
              await del("filaments", id);
            }
          } catch (_) {}
        }
        if (r === "failed") {
          notify({
            type: "warn",
            title: "Delete Failed",
            message: "Browser storage is unavailable."
          });
        } else if (r !== "error") {
          const titles = {
            products: "Product Deleted",
            filaments: "Filament Deleted",
            filament_stock: "Filament Deleted",
            prints: "Print Log Deleted",
            invoices: "Document Deleted",
            expenses: "Expense Deleted"
          };
          const messages = {
            products: `"${itemName}" was removed from inventory.`,
            filaments: `"${itemName}" was removed from catalog.`,
            filament_stock: `"${itemName}" was removed from catalog.`,
            prints: `Print job record was deleted.`,
            invoices: `"${itemName}" was permanently deleted.`,
            expenses: `Expense entry was removed.`
          };
          notify({
            type: "delete",
            title: titles[coll] || "Record Deleted",
            message: messages[coll] || `"${itemName}" was deleted.`
          });
        }
      }
    } catch(err) {
      notify({
        type: "warn",
        title: "Delete Error",
        message: err.message || "Failed to delete record."
      });
    } finally {
      closeModal();
      render();
    }
  };
}

/* ==========================================================================
   Bambu Handy Print Job Details Modal Dialog
   ========================================================================== */
function openPrintDetailsModal(p) {
  if (!p) return;
  const pr = byId("products", p.productId) || {};
  const f = byId("filaments", p.filamentId);
  const pv = photoSrc(pr.photo);
  const isPrinting = p.statusLabel === "Printing" || p.status === "Printing";
  const isSuccess = p.statusLabel === "Success" || (p.statusLabel !== "Canceled" && p.statusLabel !== "Failed" && !N(p.failed) && N(p.qty) > 0);
  const statusText = p.statusLabel || (isSuccess ? "Success" : (N(p.failed) > 0 ? "Failed" : "Canceled"));
  const statusClass = isSuccess ? "good" : "bad";
  const cleanProf = cleanProfileName(p.profileName);

  const hrs = N(p.hours);
  const durationText = hrs >= 1
    ? `${Math.floor(hrs)}h ${Math.round((hrs % 1) * 60)}m`
    : `${Math.round(hrs * 60)} min`;

  let filaments = [];
  if (Array.isArray(p.filamentsUsed) && p.filamentsUsed.length > 0) {
    filaments = p.filamentsUsed;
  } else if (f) {
    filaments = [{
      type: f.material || f.name || "PLA",
      color: f.color || "#888888",
      weightG: p.grams,
      slot: f.location || (isPrinting ? "A1" : "Ext")
    }];
  } else if (isPrinting) {
    const prFil = byId("filaments", pr.filamentId);
    if (prFil) {
      filaments = [{
        type: prFil.material || prFil.name || "PLA",
        color: prFil.color || "#10B981",
        weightG: undefined,
        slot: prFil.location || "A1"
      }];
    } else {
      filaments = [{
        type: "PLA",
        color: "#10B981",
        weightG: undefined,
        slot: "A1"
      }];
    }
  } else {
    filaments = [{
      type: "PLA",
      color: "#161616",
      weightG: p.grams,
      slot: "A1"
    }];
  }

  const html = `
    <div class="scrim" id="printDetailsScrim">
      <div class="bambu-details-modal" role="dialog" aria-modal="true" aria-labelledby="printModalTitle">
        <!-- Header -->
        <div class="bambu-modal-header">
          <div class="bambu-header-left">
            <span class="bambu-brand-pill">Bambu Handy</span>
            ${renderPrintStatusBadge(p)}
          </div>
          <button type="button" class="del-modal-close" id="printModalCloseX" title="Close details">✕</button>
        </div>

        <div class="bambu-modal-body">
          <!-- Hero Product Card -->
          <div class="bambu-hero-card">
            <div class="bambu-hero-thumb">
              ${pv ? `<img src="${pv}" class="bambu-hero-img" alt="${esc(pr.name || "Print")}">` : `<div class="bambu-hero-ph">${APP_ICONS.feedPackage(30, 1.8)}</div>`}
            </div>
            <div class="bambu-hero-info">
              <h3 class="bambu-hero-title" id="printModalTitle">${esc(cleanModelTitle(pr.name || p.note || "3D Print Job"))}</h3>
              ${pr.sku ? `<div class="bambu-hero-sku mono">${esc(pr.sku)}</div>` : ""}
              <div class="bambu-hero-tags">
                <span class="bambu-tag"${p.estimatedHours && Math.abs(N(p.hours) - N(p.estimatedHours)) >= 0.5 ? ` title="Actual elapsed: ${durationText} (Slicer estimate: ${p.estimatedHours} h)"` : ""}>${APP_ICONS.metricTime(13, 2)} <span>${durationText}</span></span>
                <span class="bambu-tag">${APP_ICONS.feedSpool(13, 2)} <span>${m1(p.grams)} g</span></span>
                <span class="bambu-tag">${APP_ICONS.feedPrint(13, 2)} <span>${p.statusLabel === "Printing" ? "Printing active" : (p.qty ? `${p.qty} printed` : `${p.failed || 1} failed`)}</span></span>
              </div>
            </div>
          </div>

          <!-- Hardware & Slicer Specifications -->
          <div class="bambu-section">
            <div class="bambu-section-title">Hardware & Slicer Profile</div>
            <div class="bambu-spec-grid">
              <div class="bambu-spec-card">
                <span class="bambu-spec-k">Printer</span>
                <span class="bambu-spec-v">${esc(p.printerName || "3DP-22E-489 (P2S)")}</span>
              </div>
              <div class="bambu-spec-card">
                <span class="bambu-spec-k">Build Plate</span>
                <span class="bambu-spec-v">${esc(p.buildPlate || "Textured PEI Plate")}</span>
              </div>
              <div class="bambu-spec-card">
                <span class="bambu-spec-k">Nozzle</span>
                <span class="bambu-spec-v">${esc(p.nozzle || "0.4mm Standard x1")}</span>
              </div>
              <div class="bambu-spec-card">
                <span class="bambu-spec-k">Plate Target</span>
                <span class="bambu-spec-v">${esc(p.plateName || "Plate 1")}</span>
              </div>
            </div>

            ${cleanProf ? `
              <div class="bambu-profile-card">
                <span class="bambu-spec-k">Slicer Setting</span>
                <span class="bambu-profile-text mono">${esc(cleanProf)}</span>
              </div>
            ` : ""}
          </div>

          <!-- AMS & Filaments Breakdown -->
          <div class="bambu-section">
            <div class="bambu-section-title">Filament & AMS Mapping</div>
            <div class="bambu-ams-list">
              ${filaments.map((fu, idx) => `
                <div class="bambu-ams-row">
                  <div class="bambu-ams-left">
                    <span class="bambu-slot-pill">${esc(fu.slot || `Slot ${idx + 1}`)}</span>
                    <span class="bambu-color-dot" style="background:${safeColor(fu.color || "#888888")};"></span>
                    <span class="bambu-mat-name">${esc(fu.type || "PLA")}</span>
                    ${fu.color ? `<span class="bambu-hex-tag mono">${esc(fu.color)}</span>` : ""}
                  </div>
                  <div class="bambu-ams-right">
                    <span class="bambu-ams-weight num">${fu.weightG != null && fu.weightG > 0 ? `${m1(fu.weightG)} g` : (isPrinting ? "Planned" : "—")}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Timestamps & Execution Info -->
          <div class="bambu-section">
            <div class="bambu-section-title">Timeline</div>
            <div class="bambu-timeline-grid">
              <div class="bambu-timeline-item">
                <span class="bambu-spec-k">Started</span>
                <span class="bambu-timeline-val mono">${formatTimestamp(p.startTime || p.date)}</span>
              </div>
              <div class="bambu-timeline-item">
                <span class="bambu-spec-k">Finished</span>
                <span class="bambu-timeline-val mono">${p.statusLabel === "Printing" ? "Printing in progress..." : formatTimestamp(p.endTime || p.updatedAt || p.date)}</span>
              </div>
              <div class="bambu-timeline-item">
                <span class="bambu-spec-k">Log Date</span>
                <span class="bambu-timeline-val">${formatDateShort(p.date)} ${String(p.date || "").slice(0, 4)}</span>
              </div>
            </div>
          </div>

          ${p.note && p.note !== p.profileName && p.note !== (pr.name || "") ? `
            <div class="bambu-section">
              <div class="bambu-section-title">Task Note</div>
              <div class="bambu-note-box">${esc(p.note)}</div>
            </div>
          ` : ""}
        </div>

        <!-- Footer Actions -->
        <div class="bambu-modal-footer">
          <button type="button" class="btn btn-pill" id="printModalCloseBtn">Close</button>
          <button type="button" class="btn pri btn-pill-primary" id="printModalEditBtn" data-edit="prints" data-id="${p.id}">
            ${APP_ICONS.btnEdit(14, 2)} <span>Edit Log</span>
          </button>
        </div>
      </div>
    </div>
  `;

  $("#modalRoot").innerHTML = html;

  const closeBtn = $("#printModalCloseBtn");
  const closeX = $("#printModalCloseX");
  const scrim = $("#printDetailsScrim");
  const editBtn = $("#printModalEditBtn");

  const close = () => { closeModal(); };
  if (closeBtn) closeBtn.onclick = close;
  if (closeX) closeX.onclick = close;
  if (scrim) {
    scrim.onclick = (e) => {
      if (e.target === scrim) close();
    };
  }
  if (editBtn) {
    editBtn.onclick = () => {
      closeModal();
      openForm("prints", p);
    };
  }
}

/* ==========================================================================
   Simplified "New/Edit Printed Item" Form — Final MVP Version
   Organized strictly into 3 Sections:
     Section A — Product Information: Photo, Item Name, Category, Filament Type
     Section B — Production Details: Filament Used (g), Print Time (min), Packaging & Extras (AED)
     Section C — Pricing Summary: Filament Cost (AED), Production Cost (AED), Markup (35%), Selling Price (AED)
   All removed fields (SKU, Opening Stock, Low Stock Alert, Notes, etc.) are kept
   compatible and managed internally without exposing them in the UI.
   ========================================================================== */
function openProductModal(obj) {
  obj = Object.assign({}, obj || {});
  const isNew = !obj.id;
  const autoSku = obj.sku || ("PRN-" + String(S.products.length + 1).padStart(4, "0"));

  const availableFils = (S.filament_stock && S.filament_stock.length > 0) ? S.filament_stock : S.filaments;
  const filOptions = availableFils.length > 0
    ? availableFils.map(f => {
        const costKg = filCostKg(f);
        const qty = Math.max(1, N(f.quantity !== undefined ? f.quantity : (f.spoolQty !== undefined ? f.spoolQty : 1)));
        const brand = f.brand || "";
        const mat = f.material || "PLA";
        const colName = f.colorName || "";
        const displayName = f.name || `${brand} ${mat} · ${colName}`.trim();
        const isSel = f.id === obj.filamentId || (isNew && !obj.filamentId && f === availableFils[0]);
        return `<option value="${f.id}" ${isSel ? "selected" : ""}>${esc(displayName)} (${esc(mat)}) · ${qty} spool${qty > 1 ? 's' : ''} · ${money(costKg)}/kg</option>`;
      }).join("")
    : `<option value="default_pla" selected>Generic PLA Spool (1kg · ${money(75)}/kg)</option>`;

  $("#modalRoot").innerHTML = `
    <div class="scrim" id="scrim">
      <form class="modal product-modal" id="mform" novalidate>
        <!-- Modal Header -->
        <div class="product-modal-header">
          <div class="product-modal-title-box">
            <div class="product-modal-icon">${APP_ICONS.metricProducts(20, 1.8)}</div>
            <div>
              <h3 class="product-modal-title">${isNew ? "New Printed Item" : "Edit Printed Item"}</h3>
              <p class="product-modal-subtitle">${isNew ? "Essential product information and automatic production pricing" : "Update product specifications and production details"}</p>
            </div>
          </div>
          <button type="button" class="modal-close-x" id="modalCloseX" aria-label="Close dialog">✕</button>
        </div>

        <div class="product-modal-body">
          <!-- Section A — Product Information -->
          <div class="form-section-card">
            <div class="form-section-title">
              <span class="section-step">A</span>
              <span>Product Information</span>
            </div>
            <div class="fgrid">
              <!-- Product Photo -->
              <div class="f wide">
                <span class="f-lbl">Product Photo (Optional)</span>
                <div class="photo-pick">
                  <img id="m_photoPrev" src="${photoSrc(obj.photo)}" alt="" ${photoSrc(obj.photo) ? "" : "hidden"}>
                  <input type="file" accept="image/*" id="m_photoFile">
                  <button class="btn sm" type="button" id="m_photoClr" ${obj.photo ? "" : "hidden"}>Remove</button>
                </div>
                <input type="hidden" id="m_photo" value="${esc(obj.photo || "")}">
              </div>

              <!-- Item Name -->
              <div class="f">
                <label class="f-lbl" for="m_name">Item Name <span class="req-star">*</span></label>
                <input id="m_name" type="text" placeholder="e.g. Articulated Dragon, Phone Stand" value="${esc(obj.name || "")}" required>
              </div>

              <!-- Category -->
              <div class="f">
                <label class="f-lbl" for="m_category">Category (Optional)</label>
                <input id="m_category" type="text" list="catList" placeholder="e.g. Functional, Art & Decor" value="${esc(obj.category || "")}">
                <datalist id="catList">
                  <option value="Functional">
                  <option value="Art & Decor">
                  <option value="Miniatures & Toys">
                  <option value="Organizers">
                  <option value="Replacement Parts">
                  <option value="Electronics Accessories">
                </datalist>
              </div>

              <!-- Filament Type -->
              <div class="f wide">
                <label class="f-lbl" for="m_filamentId">Filament Type <span class="req-star">*</span></label>
                <select id="m_filamentId" required>
                  ${S.filaments.length > 0 ? `<option value="">— Select spool from filament inventory —</option>` : ""}
                  ${filOptions}
                </select>
              </div>
            </div>
          </div>

          <!-- Section B — Production Details -->
          <div class="form-section-card">
            <div class="form-section-title">
              <span class="section-step">B</span>
              <span>Production Details</span>
            </div>
            <div class="fgrid prod-details-grid">
              <!-- Filament Used (g) -->
              <div class="f">
                <label class="f-lbl" for="m_grams">Filament Used (g) <span class="req-star">*</span></label>
                <input id="m_grams" type="number" step="any" min="0" placeholder="e.g. 65" value="${obj.grams != null && obj.grams !== "" ? esc(obj.grams) : ""}" required>
              </div>

              <!-- Print Time (min) -->
              <div class="f">
                <label class="f-lbl" for="m_minutes">Print Time (min) <span class="req-star">*</span></label>
                <input id="m_minutes" type="number" step="any" min="0" placeholder="e.g. 150" value="${obj.minutes != null && obj.minutes !== "" ? esc(obj.minutes) : ""}" required>
              </div>

              <!-- Packaging & Extras (AED) -->
              <div class="f">
                <label class="f-lbl" for="m_packaging">Packaging & Extras (${cur()})</label>
                <input id="m_packaging" type="number" step="any" min="0" placeholder="0.00" value="${obj.packaging != null && obj.packaging !== "" ? esc(obj.packaging) : ""}">
              </div>
            </div>
          </div>

          <!-- Section C — Pricing Summary -->
          <div class="pricing-summary-card">
            <div class="pricing-summary-top">
              <div class="pricing-header-left">
                <span class="section-step">C</span>
                <span class="pricing-summary-heading">Pricing Summary</span>
              </div>
              <span class="pricing-markup-pill">+35% Target Markup</span>
            </div>

            <div class="pricing-summary-metrics">
              <div class="pricing-metric-tile">
                <span class="p-tile-label">Filament Cost</span>
                <span class="p-tile-val" id="dispFilCost">0.00 ${cur()}</span>
                <span class="p-tile-sub" id="dispFilRate">@ 0.00 / kg</span>
              </div>
              <div class="pricing-metric-tile">
                <span class="p-tile-label">Production Cost</span>
                <span class="p-tile-val" id="dispProdCost">0.00 ${cur()}</span>
                <span class="p-tile-sub">Material + Extras</span>
              </div>
              <div class="pricing-metric-tile">
                <span class="p-tile-label">Markup (35%)</span>
                <span class="p-tile-val" id="dispMarkupVal">0.00 ${cur()}</span>
                <span class="p-tile-sub">+35% on cost</span>
              </div>
              <div class="pricing-metric-tile highlight">
                <span class="p-tile-label">Selling Price</span>
                <span class="p-tile-val primary" id="dispSellingPrice">0.00 ${cur()}</span>
                <span class="p-tile-sub highlight" id="dispMarkupAmount">Production + 35%</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Error Banner -->
        <p id="mErr" class="banner" hidden></p>

        <!-- Modal Footer -->
        <div class="mfoot product-modal-footer">
          <span class="muted" style="font-size:12px">${obj.updatedAt ? "Last saved " + new Date(obj.updatedAt).toLocaleString() : ""}</span>
          <div class="r">
            <button class="btn btn-pill" type="button" id="mCancel">Cancel</button>
            <button class="btn pri btn-pill-primary" type="submit">${isNew ? "Save Product" : "Save Changes"}</button>
          </div>
        </div>
      </form>
    </div>
  `;

  bindPhoto();

  function calcPricing() {
    const filId = $("#m_filamentId") ? $("#m_filamentId").value : "";
    const fil = byId("filaments", filId);
    const costKg = fil ? filCostKg(fil) : (filId === "default_pla" ? 85 : (S.filaments[0] ? filCostKg(S.filaments[0]) : 85));
    const grams = N($("#m_grams") ? $("#m_grams").value : 0);
    const packaging = N($("#m_packaging") ? $("#m_packaging").value : 0);

    const filamentCost = (grams / 1000) * costKg;
    const productionCost = filamentCost + packaging;
    const markupAmount = productionCost * 0.35;
    const sellingPrice = productionCost * 1.35;

    const c = cur();
    if ($("#dispFilCost")) $("#dispFilCost").textContent = `${c} ${filamentCost.toFixed(2)}`;
    if ($("#dispFilRate")) $("#dispFilRate").textContent = (fil || filId === "default_pla") ? `@ ${c} ${costKg.toFixed(2)}/kg` : "Select a spool";
    if ($("#dispProdCost")) $("#dispProdCost").textContent = `${c} ${productionCost.toFixed(2)}`;
    if ($("#dispMarkupVal")) $("#dispMarkupVal").textContent = `${c} ${markupAmount.toFixed(2)}`;
    if ($("#dispSellingPrice")) $("#dispSellingPrice").textContent = `${c} ${sellingPrice.toFixed(2)}`;
    if ($("#dispMarkupAmount")) $("#dispMarkupAmount").textContent = "Production + 35%";

    return { filamentCost, productionCost, markupAmount, sellingPrice };
  }

  // Bind live calculation events
  const filEl = $("#m_filamentId");
  const gramsEl = $("#m_grams");
  const packEl = $("#m_packaging");

  if (filEl) filEl.addEventListener("change", calcPricing);
  if (gramsEl) gramsEl.addEventListener("input", calcPricing);
  if (packEl) packEl.addEventListener("input", calcPricing);

  // Initial calculation
  calcPricing();

  // Modal close handlers
  $("#mCancel").onclick = closeModal;
  if ($("#modalCloseX")) $("#modalCloseX").onclick = closeModal;
  $("#scrim").addEventListener("mousedown", e => { if (e.target.id === "scrim") closeModal(); });

  // Form submission
  $("#mform").onsubmit = async e => {
    e.preventDefault();
    const name = $("#m_name") ? $("#m_name").value.trim() : "";
    const filamentId = $("#m_filamentId") ? $("#m_filamentId").value : "";
    const gramsStr = $("#m_grams") ? $("#m_grams").value : "";
    const minutesStr = $("#m_minutes") ? $("#m_minutes").value : "";

    const er = $("#mErr");
    if (!name) {
      er.hidden = false;
      er.textContent = "Please enter an Item Name.";
      $("#m_name")?.focus();
      return;
    }
    if (!filamentId) {
      er.hidden = false;
      er.textContent = "Please select a filament material.";
      $("#m_filamentId")?.focus();
      return;
    }
    if (gramsStr === "" || isNaN(Number(gramsStr)) || Number(gramsStr) < 0) {
      er.hidden = false;
      er.textContent = "Please enter valid filament weight in grams.";
      $("#m_grams")?.focus();
      return;
    }
    if (minutesStr === "" || isNaN(Number(minutesStr)) || Number(minutesStr) < 0) {
      er.hidden = false;
      er.textContent = "Please enter valid print duration in minutes.";
      $("#m_minutes")?.focus();
      return;
    }

    er.hidden = true;

    const { filamentCost, productionCost, markupAmount, sellingPrice } = calcPricing();

    const d = Object.assign({}, obj, {
      photo: $("#m_photo") ? $("#m_photo").value : (obj.photo || ""),
      name: name,
      sku: obj.sku || autoSku,
      category: $("#m_category") ? $("#m_category").value.trim() : (obj.category || ""),
      filamentId: filamentId,
      grams: N(gramsStr),
      minutes: N(minutesStr),
      packaging: N($("#m_packaging") ? $("#m_packaging").value : 0),

      // Internal defaults / preserved values for non-visible fields
      openingStock: obj.openingStock != null && obj.openingStock !== "" ? N(obj.openingStock) : 0,
      minStock: obj.minStock != null && obj.minStock !== "" ? N(obj.minStock) : 2,
      notes: obj.notes || "",
      location: obj.location || "",
      laborMin: obj.laborMin || 0,

      // Automatic Calculated Pricing
      filamentCost: Number(filamentCost.toFixed(2)),
      productionCost: Number(productionCost.toFixed(2)),
      markup: 35,
      markupAmount: Number(markupAmount.toFixed(2)),
      sellingPrice: Number(sellingPrice.toFixed(2)),

      // Backward-compatibility aliases for invoices, reports, tables, and older records
      directPrice: Number(sellingPrice.toFixed(2)),
      agentPrice: Number(sellingPrice.toFixed(2)),
      unitCost: Number(productionCost.toFixed(2))
    });

    try {
      const isNew = !obj.id;
      const r = await save("products", obj.id || uid(), d);
      closeModal();
      if (r === "failed") {
        notify({ type: "warn", title: "Save Failed", message: "Browser storage is full or unavailable." });
      } else {
        notify({
          type: isNew ? "success" : "info",
          title: isNew ? "Product Added" : "Product Updated",
          message: isNew ? `"${d.name}" saved to inventory.` : `Changes to "${d.name}" saved.`
        });
      }
    } catch(_) {}
  };
}

function openAddSpoolModal(obj) {
  obj = Object.assign({}, obj || {});
  const isNew = !obj.id;

  const defaultBrand = obj.brand || "eSUN";
  const defaultMat = obj.material || "PLA+";
  const defaultCol = safeColor(obj.color || "#A03CF7");
  const defaultColName = obj.colorName || getFilamentColorName(defaultCol);
  const defaultDiameter = obj.diameter || "1.75 mm";
  const defaultWeight = obj.weightG !== undefined ? obj.weightG : 1000;
  const defaultQty = obj.quantity !== undefined ? obj.quantity : (obj.spoolQty !== undefined ? obj.spoolQty : 1);
  const defaultCost = obj.price !== undefined ? obj.price : (obj.costPerSpool !== undefined ? obj.costPerSpool : 75);
  const defaultNotes = obj.notes || obj.temp || "";

  const materials = ["PLA", "PLA+", "Hyper PLA", "PLA+ Silk", "PETG", "CR-PETG", "ABS", "TPU", "ASA"];

  $("#modalRoot").innerHTML = `
    <div class="scrim" id="scrim">
      <form class="modal product-modal spool-modal" id="mform" novalidate>
        <!-- Modal Header -->
        <div class="product-modal-header">
          <div class="product-modal-title-box">
            <div class="product-modal-icon">${APP_ICONS.feedSpool(20, 1.8)}</div>
            <div>
              <h3 class="product-modal-title">${isNew ? "Add Filament Spool" : "Edit Filament Spool"}</h3>
              <p class="product-modal-subtitle">${isNew ? "Record new filament spool specifications and stock" : "Update filament spool specifications and stock"}</p>
            </div>
          </div>
          <button type="button" class="modal-close-x" id="modalCloseX" aria-label="Close dialog">✕</button>
        </div>

        <div class="product-modal-body">
          <!-- Live 3D Spool Preview -->
          <div class="spool-live-preview-box" id="spoolLivePreviewBox">
            <div class="spool-preview-graphic" id="spoolPreviewGraphic">
              ${renderFilamentSpool({
                color: defaultCol,
                colorName: defaultColName,
                material: defaultMat,
                size: 96
              })}
            </div>
            <div class="spool-preview-info">
              <div class="spool-preview-title" id="spoolPreviewTitle">${esc(defaultBrand)} ${esc(defaultMat)} · ${esc(defaultColName)}</div>
              <div class="spool-preview-desc" id="spoolPreviewDesc">${esc(defaultDiameter)} · ${(defaultWeight / 1000).toFixed(1)} kg net weight</div>
              <div class="spool-preview-badge-row" id="spoolPreviewBadges" style="margin-top:4px;display:flex;align-items:center;gap:6px;">
                <span class="fil-brand-pill" id="spoolPreviewBrandPill">${esc(defaultBrand)}</span>
                <span class="fil-card-hex-pill">
                  <span class="fil-card-hex-dot" id="spoolPreviewDot" style="background:${defaultCol};"></span>
                  <span id="spoolPreviewHexText">${esc(defaultCol)}</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Section A — Filament Specification -->
          <div class="form-section-card">
            <div class="form-section-title">
              <span class="section-step">A</span>
              <span>Filament Specification</span>
            </div>
            <div class="fgrid">
              <!-- Brand / Company -->
              <div class="f">
                <label class="f-lbl" for="m_brand">Brand / Company <span class="req-star">*</span></label>
                <input id="m_brand" type="text" list="brandList" placeholder="e.g. eSUN, Creality, Bambu Lab" value="${esc(defaultBrand)}" required>
                <datalist id="brandList">
                  <option value="eSUN">
                  <option value="Creality">
                  <option value="Bambu Lab">
                  <option value="YLH">
                  <option value="Polymaker">
                  <option value="Sunlu">
                  <option value="Elegoo">
                  <option value="Kingroon">
                </datalist>
              </div>

              <!-- Material / Type -->
              <div class="f">
                <label class="f-lbl" for="m_material">Material / Type <span class="req-star">*</span></label>
                <select id="m_material" required>
                  ${materials.map(m => `<option value="${m}" ${m.toUpperCase() === defaultMat.toUpperCase() ? "selected" : ""}>${m}</option>`).join("")}
                </select>
              </div>

              <!-- Diameter -->
              <div class="f">
                <label class="f-lbl" for="m_diameter">Diameter <span class="req-star">*</span></label>
                <select id="m_diameter" required>
                  <option value="1.75 mm" ${defaultDiameter === "1.75 mm" ? "selected" : ""}>1.75 mm</option>
                  <option value="2.85 mm" ${defaultDiameter === "2.85 mm" ? "selected" : ""}>2.85 mm</option>
                </select>
              </div>

              <!-- Color Name -->
              <div class="f">
                <label class="f-lbl" for="m_colorName">Color Name <span class="req-star">*</span></label>
                <input id="m_colorName" type="text" placeholder="e.g. Purple, White, Black" value="${esc(defaultColName)}" required>
              </div>

              <!-- Color Swatch & Palette -->
              <div class="f wide">
                ${colorPickerHtml("m_color", "Color Swatch & Palette", defaultCol)}
              </div>

              <!-- Print Temp / Notes -->
              <div class="f wide">
                <label class="f-lbl" for="m_notes">Print Temp / Notes <span class="muted" style="font-weight:400;">(optional)</span></label>
                <input id="m_notes" type="text" placeholder="e.g. 210-230°C or special notes" value="${esc(defaultNotes)}">
              </div>
            </div>
          </div>

          <!-- Section B — Quantity & Pricing -->
          <div class="form-section-card">
            <div class="form-section-title">
              <span class="section-step">B</span>
              <span>Quantity & Pricing (${cur()})</span>
            </div>
            <div class="fgrid prod-details-grid">
              <!-- Net Weight per Spool -->
              <div class="f">
                <label class="f-lbl" for="m_weightG">Net Weight per Spool (g) <span class="req-star">*</span></label>
                <input id="m_weightG" type="number" step="any" min="50" placeholder="1000" value="${defaultWeight}" required>
              </div>

              <!-- Quantity -->
              <div class="f">
                <label class="f-lbl" for="m_spoolQty">Quantity (Spools) <span class="req-star">*</span></label>
                <input id="m_spoolQty" type="number" step="1" min="1" placeholder="1" value="${defaultQty}" required>
              </div>

              <!-- Price per Spool -->
              <div class="f">
                <label class="f-lbl" for="m_costPerSpool">Price per Spool (${cur()}) <span class="req-star">*</span></label>
                <input id="m_costPerSpool" type="number" step="0.01" min="0" placeholder="75.00" value="${defaultCost}" required>
              </div>
            </div>

            <!-- Calculation Tile -->
            <div class="pricing-summary-card" style="margin-top: 14px;">
              <div class="pricing-summary-metrics">
                <div class="pricing-metric-tile">
                  <span class="p-tile-label">Total Weight</span>
                  <span class="p-tile-val" id="dispSpoolTotalWeight">1,000 g</span>
                  <span class="p-tile-sub" id="dispSpoolKgSub">1.00 kg</span>
                </div>
                <div class="pricing-metric-tile">
                  <span class="p-tile-label">Filament Rate</span>
                  <span class="p-tile-val" id="dispSpoolRateKg">75.00 ${cur()}/kg</span>
                  <span class="p-tile-sub">Cost per 1,000g</span>
                </div>
                <div class="pricing-metric-tile highlight">
                  <span class="p-tile-label">Total Value</span>
                  <span class="p-tile-val primary" id="dispSpoolTotalCost">75.00 ${cur()}</span>
                  <span class="p-tile-sub highlight" id="dispSpoolUnitSub">1 spool @ 75 ${cur()}</span>
                </div>
              </div>
            </div>

            <!-- Record Expense Option -->
            ${isNew ? `
              <div class="spool-expense-check-row" style="margin-top:14px;display:flex;align-items:center;gap:8px;">
                <input type="checkbox" id="m_recordExpense" checked style="width:16px;height:16px;cursor:pointer;">
                <label for="m_recordExpense" style="cursor:pointer;font-size:13px;color:var(--color-text);">Record this purchase in Expenses under <strong>"Filament purchase"</strong></label>
              </div>
            ` : ""}
          </div>
        </div>

        <!-- Error Banner -->
        <p id="mErr" class="banner" hidden></p>

        <!-- Modal Footer -->
        <div class="mfoot product-modal-footer">
          <span class="muted" style="font-size:12px">${obj.purchasedAt || obj.updatedAt ? "Last updated " + new Date(obj.purchasedAt || obj.updatedAt).toLocaleDateString() : ""}</span>
          <div class="r">
            <button class="btn btn-pill" type="button" id="mCancel">Cancel</button>
            <button class="btn pri btn-pill-primary" type="submit">${isNew ? "Add Filament" : "Save Changes"}</button>
          </div>
        </div>
      </form>
    </div>
  `;

  bindColorPicker();

  function calcSpoolPricing() {
    const wt = Math.max(1, N($("#m_weightG") ? $("#m_weightG").value : 1000));
    const qty = Math.max(1, N($("#m_spoolQty") ? $("#m_spoolQty").value : 1));
    const cost = Math.max(0, N($("#m_costPerSpool") ? $("#m_costPerSpool").value : 75));

    const totalGrams = wt * qty;
    const rateKg = wt > 0 ? (cost / wt) * 1000 : 75;
    const totalCost = cost * qty;
    const c = cur();

    if ($("#dispSpoolTotalWeight")) $("#dispSpoolTotalWeight").textContent = `${totalGrams.toLocaleString()} g`;
    if ($("#dispSpoolKgSub")) $("#dispSpoolKgSub").textContent = `${(totalGrams / 1000).toFixed(2)} kg`;
    if ($("#dispSpoolRateKg")) $("#dispSpoolRateKg").textContent = `${rateKg.toFixed(2)} ${c}/kg`;
    if ($("#dispSpoolTotalCost")) $("#dispSpoolTotalCost").textContent = `${totalCost.toFixed(2)} ${c}`;
    if ($("#dispSpoolUnitSub")) $("#dispSpoolUnitSub").textContent = `${qty} spool${qty > 1 ? 's' : ''} @ ${cost.toFixed(2)} ${c}`;
  }

  ["m_weightG", "m_spoolQty", "m_costPerSpool"].forEach(id => {
    const el = $("#" + id);
    if (el) el.addEventListener("input", calcSpoolPricing);
  });
  calcSpoolPricing();

  function updateSpoolPreview() {
    const brand = $("#m_brand") ? $("#m_brand").value.trim() || "Custom" : "Custom";
    const mat = $("#m_material") ? $("#m_material").value : "PLA+";
    let col = safeColor($("#m_color") ? $("#m_color").value : "#A03CF7");
    let colName = $("#m_colorName") ? $("#m_colorName").value.trim() : "";
    const dia = $("#m_diameter") ? $("#m_diameter").value : "1.75 mm";
    const wt = N($("#m_weightG") ? $("#m_weightG").value : 1000) || 1000;

    // Check if color name matches catalog exactly
    if (colName && EXACT_FILAMENT_COLORS[colName]) {
      col = EXACT_FILAMENT_COLORS[colName];
    }

    const graphic = $("#spoolPreviewGraphic");
    if (graphic) {
      graphic.innerHTML = renderFilamentSpool({
        color: col,
        colorName: colName,
        material: mat,
        size: 96
      });
    }

    const titleEl = $("#spoolPreviewTitle");
    if (titleEl) {
      titleEl.textContent = `${brand} ${mat} · ${colName || "Custom"}`;
    }

    const descEl = $("#spoolPreviewDesc");
    if (descEl) {
      descEl.textContent = `${dia} · ${(wt / 1000).toFixed(1)} kg spool`;
    }

    const brandPill = $("#spoolPreviewBrandPill");
    if (brandPill) {
      brandPill.textContent = brand;
    }

    const dotEl = $("#spoolPreviewDot");
    if (dotEl) {
      dotEl.style.backgroundColor = col;
    }

    const hexText = $("#spoolPreviewHexText");
    if (hexText) {
      hexText.textContent = col.toUpperCase();
    }
  }

  ["m_brand", "m_material", "m_colorName", "m_diameter", "m_weightG", "m_color"].forEach(id => {
    const el = $("#" + id);
    if (el) {
      el.addEventListener("input", updateSpoolPreview);
      el.addEventListener("change", updateSpoolPreview);
    }
  });

  $("#mCancel").onclick = closeModal;
  if ($("#modalCloseX")) $("#modalCloseX").onclick = closeModal;
  $("#scrim").addEventListener("mousedown", e => { if (e.target.id === "scrim") closeModal(); });

  $("#mform").onsubmit = async e => {
    e.preventDefault();
    const brand = $("#m_brand") ? $("#m_brand").value.trim() : "eSUN";
    const material = $("#m_material") ? $("#m_material").value : "PLA+";
    const color = safeColor($("#m_color") ? $("#m_color").value : "#A03CF7");
    const colorName = $("#m_colorName") ? $("#m_colorName").value.trim() : getFilamentColorName(color);
    const diameter = $("#m_diameter") ? $("#m_diameter").value : "1.75 mm";
    const weightG = Math.max(50, N($("#m_weightG") ? $("#m_weightG").value : 1000) || 1000);
    const spoolQty = Math.max(1, N($("#m_spoolQty") ? $("#m_spoolQty").value : 1));
    const costPerSpool = N($("#m_costPerSpool") ? $("#m_costPerSpool").value : 75);
    const notes = $("#m_notes") ? $("#m_notes").value.trim() : "";
    const recordExpense = $("#m_recordExpense") ? $("#m_recordExpense").checked : false;

    const er = $("#mErr");
    if (!brand) {
      if (er) { er.hidden = false; er.textContent = "Please enter a brand name."; }
      $("#m_brand")?.focus();
      return;
    }
    if (!colorName) {
      if (er) { er.hidden = false; er.textContent = "Please enter a color name."; }
      $("#m_colorName")?.focus();
      return;
    }

    const spoolId = obj.id || `spool_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const costKg = Number(((costPerSpool / weightG) * 1000).toFixed(2));
    const totalCost = Number((costPerSpool * spoolQty).toFixed(2));
    const totalWeightG = spoolQty * weightG;

    const spoolData = {
      id: spoolId,
      brand,
      material,
      color,
      colorName,
      diameter,
      weightG,
      quantity: spoolQty,
      spoolQty,
      price: costPerSpool,
      costPerSpool,
      costKg,
      totalCost,
      totalWeightG,
      temp: notes,
      notes,
      purchasedAt: obj.purchasedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await save("filament_stock", spoolId, spoolData);

      // Mirror into S.filaments for Cost Calculator, Product modal, etc.
      const filData = {
        id: spoolId,
        name: `${brand} ${material} · ${colorName}`.trim(),
        brand,
        material,
        color,
        colorName,
        diameter,
        weightG,
        price: costPerSpool,
        quantity: spoolQty,
        costKg,
        temp: notes,
        notes,
        updatedAt: new Date().toISOString()
      };
      await save("filaments", spoolId, filData);

      // Record expense if requested
      if (isNew && recordExpense) {
        const expId = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const expData = {
          id: expId,
          date: today(),
          category: "Filament purchase",
          amount: spoolData.totalCost,
          desc: `${spoolQty}x ${brand} ${material} ${colorName} (${weightG}g)`
        };
        await save("expenses", expId, expData);
      }

      closeModal();
      notify({
        type: isNew ? "success" : "info",
        title: isNew ? "Filament Added" : "Filament Updated",
        message: isNew
          ? `Added ${spoolQty} spool${spoolQty > 1 ? 's' : ''} of ${brand} ${material} ${colorName} (${spoolData.totalCost} ${cur()}).`
          : `Changes to ${brand} ${material} ${colorName} saved.`
      });
    } catch(err) {
      if (er) {
        er.hidden = false;
        er.textContent = `Error saving filament: ${err.message}`;
      }
    }
  };
}

function openForm(coll, obj) {
  if (coll === "invoices") return openInvoice(obj);
  if (coll === "products") return openProductModal(obj);
  if (coll === "filaments" || coll === "filament_stock") return openAddSpoolModal(obj);
  const F = FORMS[coll];
  obj = Object.assign({}, obj || {});
  const isNew = !obj.id;
  if (coll === "prints" && !obj.statusLabel) {
    obj.statusLabel = isNew ? "Success" : (N(obj.qty) > 0 ? "Success" : (N(obj.failed) > 0 ? "Failed" : "Canceled"));
  }
  if (isNew && ("date" in Object.fromEntries(F.fields.map(f => [f[0], 1])))) obj.date = obj.date || today();

  $("#modalRoot").innerHTML = `
    <div class="scrim" id="scrim">
      <form class="modal" id="mform" novalidate>
        <h3>${isNew ? "New" : "Edit"} ${F.title.toLowerCase()}</h3>
        <div class="fgrid">
          ${F.fields.map(([k, l, t]) => fieldHtml(k, String(l).includes("$CUR") ? l.replace("$CUR", cur()) : l, t || "text", obj)).join("")}
        </div>
        ${locOpts()}
        <p id="mErr" class="banner" hidden></p>
        <div class="mfoot">
          <span class="muted" style="font-size:12px">${obj.updatedAt ? "Last saved " + new Date(obj.updatedAt).toLocaleString() : ""}</span>
          <div class="r">
            <button class="btn" type="button" id="mCancel">Cancel</button>
            <button class="btn pri" type="submit">Save</button>
          </div>
        </div>
      </form>
    </div>
  `;

  bindPhoto();
  bindColorPicker();

  if (coll === "prints") {
    const manual = { grams: !isNew, hours: !isNew };
    const hint = k => {
      const s = $("#m_" + k + "Hint");
      if (!s) return;
      if (manual[k]) s.innerHTML = 'Manual override · <button type="button" class="btn sm" data-auto="' + k + '">Use automatic</button>';
      else s.textContent = "auto";
    };
    const upd = () => {
      const p = byId("products", $("#m_productId").value);
      if (!p) return;
      const status = $("#m_statusLabel") ? $("#m_statusLabel").value : "Success";
      const n = N($("#m_qty").value) + N($("#m_failed").value) || (status === "Printing" ? 1 : 1);
      if (p.filamentId && !$("#m_filamentId").value) $("#m_filamentId").value = p.filamentId;
      if (!manual.grams) $("#m_grams").value = +(N(p.grams) * n).toFixed(1);
      if (!manual.hours) $("#m_hours").value = +(N(p.minutes) * n / 60).toFixed(2);
    };
    ["grams", "hours"].forEach(k => {
      const el = $("#m_" + k);
      el.insertAdjacentHTML("afterend", '<span class="muted" id="m_' + k + 'Hint" style="font-size:11px"></span>');
      el.addEventListener("input", () => { manual[k] = true; hint(k); });
      hint(k);
    });
    $("#mform").addEventListener("click", e => {
      const k = e.target.dataset && e.target.dataset.auto;
      if (!k) return;
      manual[k] = false;
      hint(k);
      upd();
    });
    ["m_productId", "m_qty", "m_failed"].forEach(i => $("#" + i).addEventListener("input", upd));
    if ($("#m_statusLabel")) {
      $("#m_statusLabel").addEventListener("change", () => {
        const val = $("#m_statusLabel").value;
        if (val === "Printing") {
          $("#m_qty").value = 0;
          $("#m_failed").value = 0;
        } else if (val === "Success") {
          $("#m_qty").value = 1;
          $("#m_failed").value = 0;
        } else if (val === "Canceled" || val === "Failed") {
          $("#m_qty").value = 0;
          $("#m_failed").value = 1;
        }
        upd();
      });
    }
    if (isNew) {
      if ($("#m_statusLabel")) $("#m_statusLabel").value = obj.statusLabel || "Success";
      if (!$("#m_statusLabel") || $("#m_statusLabel").value === "Success") {
        $("#m_qty").value = $("#m_qty").value || 1;
        $("#m_failed").value = $("#m_failed").value || 0;
      }
      upd();
    }
  }

  $("#mCancel").onclick = closeModal;
  if ($("#modalCloseX")) $("#modalCloseX").onclick = closeModal;
  $("#scrim").addEventListener("mousedown", e => { if (e.target.id === "scrim") closeModal(); });

  $("#mform").onsubmit = async e => {
    e.preventDefault();
    const d = Object.assign({}, obj);
    F.fields.forEach(([k,, t]) => {
      const el = $("#m_" + k);
      if (!el) return;
      d[k] = t === "number" ? (el.value === "" ? "" : N(el.value)) : el.value;
    });
    const req = F.fields.filter(f => f[3]).find(f => d[f[0]] === "" || d[f[0]] == null);
    if (req) {
      const er = $("#mErr");
      er.hidden = false;
      er.textContent = `Add "${req[1]}" to save.`;
      return;
    }
    try {
      const isNew = !obj.id;
      const r = await save(coll, obj.id || uid(), d);
      closeModal();
      if (r === "failed") {
        notify({ type: "warn", title: "Save Failed", message: "Browser storage is full or unavailable." });
      } else {
        const titles = {
          products: isNew ? "Product Added" : "Product Updated",
          filaments: isNew ? "Filament Added" : "Filament Updated",
          prints: isNew ? "Print Logged" : "Print Updated",
          expenses: isNew ? "Expense Recorded" : "Expense Updated"
        };
        const messages = {
          products: isNew ? `"${d.name || "Item"}" saved to inventory.` : `Changes to "${d.name || "item"}" saved.`,
          filaments: isNew ? `"${d.name || "Spool"}" (${d.material || "Filament"}) added.` : `Changes to "${d.name || "spool"}" saved.`,
          prints: isNew ? `Logged ${d.qty || 1} pcs of production.` : `Print log details updated.`,
          expenses: isNew ? `${money(d.amount)} logged for ${d.category || "expense"}.` : `Expense entry updated.`
        };
        notify({
          type: isNew ? "success" : "info",
          title: titles[coll] || (isNew ? "Record Added" : "Record Updated"),
          message: messages[coll] || (isNew ? "Record saved successfully." : "Changes saved.")
        });
      }
    } catch(_) {}
  };
}

function bindPhoto() {
  const f = $("#m_photoFile");
  if (!f) return;
  f.addEventListener("change", () => {
    const file = f.files[0];
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const img = new Image();
      img.onload = () => {
        const m = 480, s = Math.min(1, m / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.78);
        $("#m_photo").value = url;
        $("#m_photoPrev").src = url;
        $("#m_photoPrev").hidden = false;
        $("#m_photoClr").hidden = false;
      };
      img.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
  $("#m_photoClr").onclick = () => {
    $("#m_photo").value = "";
    $("#m_photoPrev").hidden = true;
    $("#m_photoClr").hidden = true;
    f.value = "";
  };
}

/* ==========================================================================
   Invoice Modal & Dynamic Line Items (Ditto Copy)
   ========================================================================== */
function openInvoice(obj) {
  const isNew = !obj || !obj.id;
  const st = set_();
  let inv = Object.assign({ type: "sale", channel: "direct", date: today(), lines: [], discount: 0, paid: 0, vatPct: st.vatPct, status: "issued" }, obj || {});
  inv.lines = (inv.lines || []).map(l => Object.assign({}, l));
  if (!inv.lines.length) inv.lines.push({ productId: "", name: "", qty: 1, price: 0 });
  if (isNew) {
    if (!inv.no) inv.no = nextNo(inv.type);
    if (!inv.date) inv.date = today();
  } else if (obj.date == null) {
    inv.date = "";
  }
  const title = { sale: "Sales invoice", quote: "Price offer", foc: "Free of charge (FOC)" }[inv.type];
  const priceFor = p => p ? N(inv.channel === "agent" ? p.agentPrice : p.directPrice) : 0;

  function linesHtml() {
    return inv.lines.map((l, i) => {
      const p = byId("products", l.productId);
      const s = p ? stockOf(p) : null;
      return `<tr class="inv-line-row">
        <td class="inv-td-item" style="min-width:220px">
          <select class="inv-select-prod" data-li="${i}" data-lk="productId">
            <option value="">Custom item</option>
            ${S.products.map(prod => `<option value="${prod.id}" ${prod.id === l.productId ? "selected" : ""}>${esc(cleanModelTitle(prod.name))}</option>`).join("")}
          </select>
          ${l.productId ? "" : `<input class="inv-input-desc" data-li="${i}" data-lk="name" value="${esc(l.name)}" placeholder="Item description" style="margin-top:6px">`}
          ${s != null ? `<div class="inv-stock-badge ${s <= 0 ? "out" : ""}">${m0(s)} in stock</div>` : ""}
        </td>
        <td class="inv-td-qty" style="width:75px"><input class="inv-input-num" type="number" step="1" data-li="${i}" data-lk="qty" value="${esc(l.qty)}"></td>
        <td class="inv-td-price" style="width:110px"><input class="inv-input-num" type="number" step="0.01" data-li="${i}" data-lk="price" value="${esc(l.price)}"></td>
        <td class="inv-td-cost" style="width:130px">${p ? `<div class="inv-cost-badge" title="Uses this item's recorded cost">${money(l.unitCost != null ? l.unitCost : unitCost(p))}</div>` : `<input class="inv-input-num" type="number" step="0.01" min="0" data-li="${i}" data-lk="unitCost" value="${l.unitCost != null ? esc(l.unitCost) : ""}" placeholder="0.00" aria-label="Unit cost" title="Cost of this custom line — leave blank if unknown"><div class="inv-cost-sub ${l.unitCost == null ? "warn" : ""}">${l.unitCost == null ? "cost not recorded" : "manual cost"}</div>`}</td>
        <td class="n inv-td-amount">${money(N(l.qty) * N(l.price))}</td>
        <td class="inv-td-act" style="width:40px"><button type="button" class="inv-rm-btn" data-rm="${i}" aria-label="Remove line" title="Remove line">✕</button></td>
      </tr>`;
    }).join("");
  }

  function totalsHtml() {
    const t = invTotals(inv);
    if (inv.type === "foc") {
      return `
        <div class="inv-totals-card">
          <div class="inv-totals-rows">
            <div class="inv-total-row">
              <span class="inv-total-label">Value of Goods (FOC)</span>
              <span class="inv-total-val num">${money(t.sub)}</span>
            </div>
          </div>
          <div class="inv-total-banner foc">
            <div class="inv-total-banner-left">
              <span class="inv-total-banner-title">Amount Due</span>
              <span class="inv-total-banner-sub">Promotional / Sample Order (No charge)</span>
            </div>
            <div class="inv-total-banner-val num">${money(0)}</div>
          </div>
        </div>
      `;
    }

    const isPaid = inv.type === "sale" && t.bal <= 0 && t.total > 0;
    const isPartial = inv.type === "sale" && t.paid > 0 && t.bal > 0;

    return `
      <div class="inv-totals-card">
        <div class="inv-totals-rows">
          <div class="inv-total-row">
            <span class="inv-total-label">Subtotal</span>
            <span class="inv-total-val num">${money(t.sub)}</span>
          </div>
          ${t.disc > 0 ? `
            <div class="inv-total-row discount">
              <span class="inv-total-label">Discount</span>
              <span class="inv-total-val num">− ${money(t.disc)}</span>
            </div>
          ` : ""}
          <div class="inv-total-row">
            <span class="inv-total-label">VAT (${m1(t.vatPct)}%)</span>
            <span class="inv-total-val num">${money(t.vat)}</span>
          </div>
        </div>

        <div class="inv-total-banner">
          <div class="inv-total-banner-left">
            <span class="inv-total-banner-title">Total Amount (${cur()})</span>
            <span class="inv-total-banner-sub">Tax-inclusive total payable</span>
          </div>
          <div class="inv-total-banner-val num">${money(t.total)}</div>
        </div>

        ${inv.type === "sale" ? `
          <div class="inv-balance-row">
            <div class="inv-balance-left">
              <span class="inv-balance-label">Payment & Balance Status</span>
              <span class="inv-balance-sub">Received: ${money(t.paid)} · ${esc(inv.method || "Cash")}</span>
            </div>
            <div class="inv-balance-badge-wrap">
              ${isPaid ? `
                <span class="inv-status-pill paid">✓ Fully Paid</span>
              ` : isPartial ? `
                <span class="inv-status-pill partial">Partial · Due ${money(t.bal)}</span>
              ` : `
                <span class="inv-status-pill unpaid">Due ${money(t.bal)}</span>
              `}
            </div>
          </div>
        ` : ""}
      </div>
    `;
  }

  const html = `
    <div class="scrim" id="scrim">
      <form class="modal invoice-modal" id="iform" novalidate>
        <!-- Modal Topbar -->
        <div class="inv-modal-header">
          <div class="inv-header-title-box">
            <div class="inv-header-icon-box">
              ${APP_ICONS.navInvoices}
            </div>
            <div>
              <div class="inv-header-badge-row">
                <span class="inv-type-pill ${inv.type}">${esc(title)}</span>
                <span class="inv-no-badge mono">${esc(inv.no)}</span>
              </div>
              <h3 class="inv-modal-title">${isNew ? "New" : "Edit"} ${esc(title)}</h3>
            </div>
          </div>
          <button type="button" class="inv-close-btn" id="modalCloseX" title="Close modal" aria-label="Close modal">✕</button>
        </div>

        <!-- Scrollable Modal Body -->
        <div class="inv-body-scroll">
          <!-- Section 1: Document Details & Customer Info -->
          <div class="inv-card-section">
            <div class="inv-section-title">Document & Customer Details</div>
            <div class="inv-fgrid-4">
              <label class="f"><span class="f-lbl">Document Number</span><input id="i_no" value="${esc(inv.no)}" class="mono"></label>
              <label class="f"><span class="f-lbl">Issue Date</span><input id="i_date" type="date" value="${esc(inv.date)}"></label>
              <label class="f"><span class="f-lbl">Sales Channel</span><select id="i_channel"><option value="direct" ${inv.channel === "direct" ? "selected" : ""}>Direct Customer</option><option value="agent" ${inv.channel === "agent" ? "selected" : ""}>Agent Wholesale</option></select></label>
              ${inv.type === "sale" ? `<label class="f"><span class="f-lbl">Invoice Status</span><select id="i_status"><option value="issued" ${inv.status !== "void" ? "selected" : ""}>Issued</option><option value="void" ${inv.status === "void" ? "selected" : ""}>Void (Cancelled)</option></select></label>` : ""}
            </div>
            <div class="inv-fgrid-4" style="margin-top:10px;">
              <label class="f"><span class="f-lbl">${inv.channel === "agent" ? "Agent / Company" : "Customer"} Name</span><input id="i_customer" value="${esc(inv.customer || "")}" placeholder="e.g. Acme Corp"></label>
              <label class="f"><span class="f-lbl">Contact Phone</span><input id="i_phone" value="${esc(inv.phone || "")}" placeholder="e.g. +971 50 123 4567"></label>
              <label class="f"><span class="f-lbl">Customer TRN / Tax ID</span><input id="i_ctrn" value="${esc(inv.ctrn || "")}" placeholder="Optional TRN"></label>
              <label class="f"><span class="f-lbl">Billing / Delivery Address</span><input id="i_addr" value="${esc(inv.addr || "")}" placeholder="City, Region"></label>
            </div>
            ${inv.type === "foc" ? `<div style="margin-top:10px;"><label class="f wide"><span class="f-lbl">Reason for FOC</span><input id="i_reason" value="${esc(inv.reason || "")}" placeholder="Sample, gift, marketing event…"></label></div>` : ""}
          </div>

          <!-- Section 2: Line Items -->
          <div class="inv-card-section">
            <div class="inv-section-header">
              <div class="inv-section-title">Line Items & Production Output</div>
              <button type="button" class="btn sm" id="iadd" style="display:inline-flex;align-items:center;gap:5px;">${APP_ICONS.btnAdd(13, 2.2)} <span>Add line</span></button>
            </div>
            <div class="inv-tbl-wrap">
              <table class="inv-lines-table">
                <thead>
                  <tr>
                    <th>Item & Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Unit cost</th>
                    <th class="n">Amount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody id="ilines">${linesHtml()}</tbody>
              </table>
            </div>
            <div class="inv-hint-box">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
              <span>Prices fill from the item's agent / direct price; unit cost fills from the item's recorded cost. Custom lines take a manual unit cost.</span>
            </div>
          </div>

          <!-- Section 3: Financial Adjustments & Document Notes -->
          <div class="inv-card-section">
            <div class="inv-section-title">Adjustments & Payment Terms</div>
            <div class="inv-fgrid-4">
              ${inv.type !== "foc" ? `
                <label class="f"><span class="f-lbl">Discount (${cur()})</span><input id="i_discount" type="number" step="0.01" value="${esc(inv.discount)}"></label>
                <label class="f"><span class="f-lbl">VAT Rate (%)</span><input id="i_vat" type="number" step="0.01" value="${esc(inv.vatPct)}"></label>
              ` : ""}
              ${inv.type === "sale" ? `
                <label class="f"><span class="f-lbl">Amount Received (${cur()})</span><input id="i_paid" type="number" step="0.01" value="${esc(inv.paid)}"></label>
                <label class="f"><span class="f-lbl">Payment Method</span><select id="i_method">${["Cash","Bank transfer","Card","Cheque","Other"].map(m => `<option ${m === inv.method ? "selected" : ""}>${m}</option>`).join("")}</select></label>
              ` : ""}
            </div>
            <div style="margin-top:10px;">
              <label class="f wide"><span class="f-lbl">Notes on Document</span><textarea id="i_notes" rows="2" placeholder="Payment terms, delivery instructions, or notes for customer...">${esc(inv.notes || "")}</textarea></label>
            </div>
          </div>

          <!-- Section 4: Totals Breakdown -->
          <div id="itotals">${totalsHtml()}</div>

          <p id="iErr" class="banner" hidden></p>
        </div>

        <!-- Sticky Modal Footer -->
        <div class="mfoot inv-mfoot">
          <button class="btn" type="button" id="iPdf" style="display:inline-flex;align-items:center;gap:6px;">${APP_ICONS.btnPdf(15, 2)} <span>Save & PDF</span></button>
          <div class="r">
            <button class="btn" type="button" id="mCancel">Cancel</button>
            <button class="btn pri" type="submit" style="display:inline-flex;align-items:center;gap:6px;">${APP_ICONS.btnSave(15, 2)} <span>Save</span></button>
          </div>
        </div>
      </form>
    </div>
  `;

  $("#modalRoot").innerHTML = html;

  const refresh = () => { $("#itotals").innerHTML = totalsHtml(); };
  const readHead = () => {
    inv.no = $("#i_no").value.trim();
    inv.date = $("#i_date").value;
    inv.customer = $("#i_customer").value;
    inv.phone = $("#i_phone").value;
    inv.ctrn = $("#i_ctrn").value;
    inv.addr = $("#i_addr").value;
    inv.notes = $("#i_notes").value;
    if ($("#i_reason")) inv.reason = $("#i_reason").value;
    if ($("#i_status")) inv.status = $("#i_status").value;
    if ($("#i_discount")) inv.discount = N($("#i_discount").value);
    if ($("#i_vat")) inv.vatPct = N($("#i_vat").value);
    if ($("#i_paid")) inv.paid = N($("#i_paid").value);
    if ($("#i_method")) inv.method = $("#i_method").value;
  };

  const redrawLines = () => {
    readHead();
    $("#ilines").innerHTML = linesHtml();
    refresh();
  };

  $("#ilines").addEventListener("input", e => {
    const i = e.target.dataset.li, k = e.target.dataset.lk;
    if (i == null) return;
    const l = inv.lines[+i];
    if (k === "productId") {
      l.productId = e.target.value;
      const p = byId("products", l.productId);
      l.name = p ? p.name : "";
      l.price = priceFor(p);
      redrawLines();
      return;
    }
    l[k] = k === "unitCost" ? (e.target.value === "" ? null : N(e.target.value)) : e.target.value;
    const row = e.target.closest("tr");
    row.querySelector("td.n").textContent = money(N(l.qty) * N(l.price));
    if (k === "unitCost") {
      const h = row.querySelector("td div.muted:last-child");
      if (h) {
        h.textContent = l.unitCost == null ? "cost not recorded" : "manual cost";
        h.style.color = l.unitCost == null ? "var(--warn)" : "var(--muted)";
      }
    }
    refresh();
  });

  $("#ilines").addEventListener("click", e => {
    const r = e.target.dataset.rm;
    if (r == null) return;
    inv.lines.splice(+r, 1);
    if (!inv.lines.length) inv.lines.push({ productId: "", name: "", qty: 1, price: 0 });
    redrawLines();
  });

  $("#iadd").onclick = () => {
    inv.lines.push({ productId: "", name: "", qty: 1, price: 0 });
    redrawLines();
  };

  $("#i_channel").addEventListener("change", e => {
    readHead();
    inv.channel = e.target.value;
    inv.lines.forEach(l => {
      const p = byId("products", l.productId);
      if (p) l.price = priceFor(p);
    });
    openInvoice(Object.assign({}, inv, { id: obj && obj.id }));
  });

  ["i_discount", "i_vat", "i_paid"].forEach(i => {
    const el = $("#" + i);
    el && el.addEventListener("input", () => { readHead(); refresh(); });
  });

  $("#mCancel").onclick = closeModal;
  if ($("#modalCloseX")) $("#modalCloseX").onclick = closeModal;
  $("#scrim").addEventListener("mousedown", e => { if (e.target.id === "scrim") closeModal(); });

  const doSave = async () => {
    readHead();
    inv.lines = inv.lines.filter(l => l.productId || String(l.name).trim());
    const err = t => { const er = $("#iErr"); er.hidden = false; er.textContent = t; };

    if (!inv.lines.length) { err("Add at least one item to save."); inv.lines.push({ productId: "", name: "", qty: 1, price: 0 }); return null; }
    if (!inv.no) { err("Add a document number."); return null; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inv.date || ""))) { err("Add a valid document date — an empty date would drop this document from period totals."); return null; }

    inv.lines.forEach(l => {
      l.qty = N(l.qty);
      l.price = N(l.price);
      const p = byId("products", l.productId);
      if (p) {
        l.name = p.name;
        if (l.unitCost == null || isNew) l.unitCost = +unitCost(p).toFixed(4);
      } else {
        l.name = String(l.name || "").trim();
        l.unitCost = l.unitCost == null ? null : +N(l.unitCost);
      }
    });

    if (inv.lines.some(l => l.qty < 0 || l.price < 0 || (l.unitCost != null && l.unitCost < 0)) || N(inv.discount) < 0 || N(inv.paid) < 0 || N(inv.vatPct) < 0) {
      err("Qty, price, unit cost, discount, VAT and payment can't be negative.");
      return null;
    }

    const id = (obj && obj.id) || uid();
    const d = Object.assign({}, inv);
    delete d.id;
    delete d._fromOffer;
    let r;
    try { r = await save("invoices", id, d); } catch(_) { return null; }

    if (inv._fromOffer) {
      const off = byId("invoices", inv._fromOffer);
      if (off && !off.converted) {
        try { await save("invoices", off.id, Object.assign({}, off, { converted: true, convertedTo: id })); } catch(_) {}
      }
    }

    const o = Object.assign({}, d, { id });
    if (r === "temp") o._tempSave = true;
    return o;
  };

  $("#iform").onsubmit = async e => {
    e.preventDefault();
    const isNew = !obj || !obj.id;
    const r = await doSave();
    if (r) {
      closeModal();
      const typeLabel = inv.type === "quote" ? "Price Offer" : inv.type === "foc" ? "Delivery Note" : "Tax Invoice";
      notify({
        type: isNew ? "success" : "info",
        title: isNew ? `${typeLabel} Created` : `${typeLabel} Updated`,
        message: isNew 
          ? `${inv.no} created for ${inv.customer || "customer"}.`
          : `Changes to ${inv.no} have been saved.`
      });
    }
  };

  $("#iPdf").onclick = async () => {
    const r = await doSave();
    if (r) {
      closeModal();
      invoicePdf(r);
    }
  };
}

/* ==========================================================================
   Global Button Handlers (Navigation, Edit, Delete, Exports)
   ========================================================================== */
const handleDocClickGlobal = async e => {
  // Clear search input
  const qclr = e.target.closest("[data-qclr]");
  if (qclr) {
    const k = qclr.dataset.qclr;
    q[k] = "";
    if (k === "p") prodPage = 1;
    if (k === "pr") printPage = 1;
    render();
    return;
  }

  // Mobile drawer backdrop click
  if (e.target.closest("#sidebarBackdrop")) {
    $("#mainSidebar").classList.remove("mobile-open");
    const bdrop = $("#sidebarBackdrop");
    if (bdrop) bdrop.classList.remove("active");
    return;
  }

  // Sidebar brand click
  if (e.target.closest(".sidebar-brand")) {
    tab = "dashboard";
    try { localStorage.setItem("ps_tab", tab); } catch(_) {}
    $("#mainSidebar").classList.remove("mobile-open");
    const bdrop = $("#sidebarBackdrop");
    if (bdrop) bdrop.classList.remove("active");
    render();
    window.scrollTo(0, 0);
    return;
  }

  // Navigation tabs in sidebar
  const navBtn = e.target.closest("button[data-tab]");
  if (navBtn) {
    tab = navBtn.dataset.tab;
    try { localStorage.setItem("ps_tab", tab); } catch(_) {}
    $("#mainSidebar").classList.remove("mobile-open");
    const bdrop = $("#sidebarBackdrop");
    if (bdrop) bdrop.classList.remove("active");
    render();
    window.scrollTo(0, 0);
    return;
  }

  // Direct tab links (e.g. from Dashboard attention and activity feed items)
  const tabLink = e.target.closest("[data-tab-link]");
  if (tabLink && tabLink.dataset.tabLink) {
    tab = tabLink.dataset.tabLink;
    try { localStorage.setItem("ps_tab", tab); } catch(_) {}
    $("#mainSidebar").classList.remove("mobile-open");
    const bdrop = $("#sidebarBackdrop");
    if (bdrop) bdrop.classList.remove("active");
    render();
    window.scrollTo(0, 0);
    return;
  }

  // Invoices filter segmented tabs
  const invFilterBtn = e.target.closest("[data-inv-filter]");
  if (invFilterBtn) {
    invFilter = invFilterBtn.dataset.invFilter;
    render();
    return;
  }

  // Printed stock filter segmented tabs
  const prodFilterBtn = e.target.closest("[data-prod-filter]");
  if (prodFilterBtn) {
    prodFilter = prodFilterBtn.dataset.prodFilter;
    prodPage = 1;
    render();
    return;
  }

  // Product catalogue view mode toggle (Cards vs Table)
  const prodViewBtn = e.target.closest("[data-prod-view]");
  if (prodViewBtn) {
    prodViewMode = prodViewBtn.dataset.prodView;
    render();
    return;
  }

  // Toggle product totalPrinted sort order
  if (e.target.closest("[data-toggle-prod-sort]")) {
    prodSortOrder = prodSortOrder === "desc" ? "asc" : "desc";
    prodPage = 1;
    render();
    return;
  }

  // Recover product photos button
  if (e.target.closest("[data-recover-photos]")) {
    backfillProductPhotos();
    return;
  }

  // View product details drawer
  const viewProdBtn = e.target.closest("[data-view-prod]");
  if (viewProdBtn) {
    const p = byId("products", viewProdBtn.dataset.viewProd);
    if (p) openProductDrawer(p);
    return;
  }

  // Product card click to view drawer
  const prodCard = e.target.closest(".prod-card[data-prod-card-id]");
  if (prodCard && !e.target.closest("button") && !e.target.closest("a") && !e.target.closest("input")) {
    const p = byId("products", prodCard.dataset.prodCardId);
    if (p) openProductDrawer(p);
    return;
  }

  // Product table row click to view drawer
  const prodRow = e.target.closest("tr.prod-table-row[data-prod-row-id]");
  if (prodRow && !e.target.closest("button") && !e.target.closest("a") && !e.target.closest("input")) {
    const p = byId("products", prodRow.dataset.prodRowId);
    if (p) openProductDrawer(p);
    return;
  }

  // Filament inventory filter segmented tabs
  const filFilterBtn = e.target.closest("[data-fil-filter]");
  if (filFilterBtn) {
    filFilter = filFilterBtn.dataset.filFilter;
    render();
    return;
  }

  // Filament inventory view mode toggle (Cards vs Table)
  const filViewBtn = e.target.closest("[data-fil-view]");
  if (filViewBtn) {
    filViewMode = filViewBtn.dataset.filView;
    render();
    return;
  }


  // Print log filter segmented tabs
  const printFilterBtn = e.target.closest("[data-print-filter]");
  if (printFilterBtn) {
    printFilter = printFilterBtn.dataset.printFilter;
    printPage = 1;
    render();
    return;
  }

  // Pagination clicks for Printed stock
  const prodPageBtn = e.target.closest("[data-prod-page]");
  if (prodPageBtn && !prodPageBtn.disabled) {
    const act = prodPageBtn.dataset.prodPage;
    if (act === "prev") {
      prodPage = Math.max(1, prodPage - 1);
    } else if (act === "next") {
      prodPage = prodPage + 1;
    } else {
      const num = parseInt(act, 10);
      if (!isNaN(num) && num >= 1) prodPage = num;
    }
    render();
    const wrap = document.querySelector(".prod-page-wrapper");
    if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // Pagination clicks for Print log
  const printPageBtn = e.target.closest("[data-print-page]");
  if (printPageBtn && !printPageBtn.disabled) {
    const act = printPageBtn.dataset.printPage;
    if (act === "prev") {
      printPage = Math.max(1, printPage - 1);
    } else if (act === "next") {
      printPage = printPage + 1;
    } else {
      const num = parseInt(act, 10);
      if (!isNaN(num) && num >= 1) printPage = num;
    }
    render();
    const wrap = document.querySelector(".print-page-wrapper");
    if (wrap) wrap.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  // Expenses filter segmented tabs
  const expFilterBtn = e.target.closest("[data-exp-filter]");
  if (expFilterBtn) {
    expFilter = expFilterBtn.dataset.expFilter;
    render();
    return;
  }

  // View print details modal
  const viewPrintBtn = e.target.closest("[data-view-print]");
  if (viewPrintBtn) {
    const p = byId("prints", viewPrintBtn.dataset.viewPrint);
    if (p) openPrintDetailsModal(p);
    return;
  }

  // Row click to view print details
  const printRow = e.target.closest("tr.print-table-row[data-print-row-id]");
  if (printRow && !e.target.closest("button") && !e.target.closest("a") && !e.target.closest("input")) {
    const p = byId("prints", printRow.dataset.printRowId);
    if (p) openPrintDetailsModal(p);
    return;
  }

  // Log print quick action from product row (rerouted to Bambu Cloud sync)
  const printProdBtn = e.target.closest("[data-print-prod]");
  if (printProdBtn) {
    syncBambu(true);
    return;
  }

  // Quick action shortcuts
  const qa = e.target.closest("[data-qa]");
  if (qa) {
    const act = qa.dataset.qa;
    if (act === "new-invoice") openInvoice({ type: "sale" });
    else if (act === "log-print") syncBambu(true);
    else if (act === "add-filament") openAddSpoolModal({});
    else if (act === "cost-calc") { tab = "calc"; render(); }
    else if (act === "needs-attention") { tab = "products"; render(); }
    else if (act === "accounts") { tab = "accounts"; render(); }
    return;
  }

  // ECharts range switcher
  const cr = e.target.closest("[data-crange]");
  if (cr) {
    chartRange = cr.dataset.crange;
    render();
    return;
  }

  // Sidebar collapse
  if (e.target.closest("#collapseSidebarBtn")) {
    const sb = $("#mainSidebar");
    if (sb) sb.classList.toggle("collapsed");
    const app = $("#app");
    if (app) app.classList.toggle("sidebar-collapsed");
    setTimeout(() => {
      if (chartMostInstance) chartMostInstance.resize();
      if (chartLeastInstance) chartLeastInstance.resize();
      if (chartPrintTimeInstance) chartPrintTimeInstance.resize();
      if (chartFilamentUsageInstance) chartFilamentUsageInstance.resize();
    }, 280);
    return;
  }

  // Topbar new invoice
  if (e.target.closest("#topNewInvoiceBtn")) {
    openInvoice({ type: "sale" });
    return;
  }

  // Topbar add expense
  if (e.target.closest('[data-new="expenses"]')) {
    window.dispatchEvent(new CustomEvent("openAddExpenseModal"));
    return;
  }

  // Topbar Sync Bambu button
  if (e.target.closest("#syncBambuBtn")) {
    syncBambu(true);
    return;
  }

  // Topbar Excel & PDF global report triggers
  if (e.target.closest("#xlsAll")) {
    exportXlsx(null, "print-studio-" + today() + ".xlsx");
    return;
  }
  if (e.target.closest("#pdfReport")) {
    reportPdf(["summary", "products", "filaments", "accounts"], "print-studio-report-" + today() + ".pdf");
    return;
  }

  // Topbar Calculator actions
  if (e.target.closest("#calcXls")) {
    exportCalcXls();
    return;
  }
  if (e.target.closest("#calcPdf")) {
    exportCalcPdf();
    return;
  }

  // Theme toggle
  if (e.target.closest("#themeToggleBtn")) {
    toggleTheme();
    return;
  }

  // Mobile menu button
  if (e.target.closest("#mobileMenuBtn")) {
    const sb = $("#mainSidebar");
    const bdrop = $("#sidebarBackdrop");
    const isOpen = sb.classList.toggle("mobile-open");
    if (bdrop) bdrop.classList.toggle("active", isOpen);
    return;
  }

  // Toolbar Add Spool trigger
  if (e.target.closest("#addSpoolBtn")) {
    openAddSpoolModal({});
    return;
  }

  // Filament table actions
  const editFilBtn = e.target.closest("[data-edit-fil]");
  if (editFilBtn) {
    const fId = editFilBtn.dataset.editFil;
    const f = (S.filament_stock || []).find(x => x.id === fId) || (S.filaments || []).find(x => x.id === fId) || byId("filament_stock", fId) || byId("filaments", fId);
    if (f) {
      openAddSpoolModal(f);
    }
    return;
  }

  const delFilBtn = e.target.closest("[data-del-fil]");
  if (delFilBtn) {
    openDeleteModal("filament_stock", delFilBtn.dataset.delFil);
    return;
  }

  // CRUD global buttons
  const t = e.target.closest("button");
  if (!t) return;
  const ds = t.dataset;

  if (ds.new) {
    if (ds.new === "products" || ds.new === "prints") {
      syncBambu(true);
      return;
    }
    if (ds.new === "invoices") openInvoice({ type: ds.type || "sale" });
    else openForm(ds.new, {});
  }
  if (ds.edit) openForm(ds.edit, byId(ds.edit, ds.id));
  if (ds.del) {
    openDeleteModal(ds.del, ds.id);
    return;
  }
  if (ds.delno) render();
  if (ds.delyes) {
    const r = await del(ds.delyes, ds.id);
    if (r === "failed") toast("Couldn't delete — browser storage is unavailable.");
    else if (r === "temp") toast("Deleted for this session only — browser storage unavailable");
    else if (r !== "error") toast("Deleted");
  }
  if (ds.invpdf) invoicePdf(byId("invoices", ds.invpdf));
  if (ds.convert) {
    const qt = byId("invoices", ds.convert);
    if (!qt) return;
    if (qt.converted) { toast("This offer was already converted."); return; }
    const c = JSON.parse(JSON.stringify(qt));
    delete c.id;
    delete c.updatedAt;
    delete c.converted;
    delete c.convertedTo;
    delete c.example;
    c.type = "sale";
    c.no = nextNo("sale");
    c.date = today();
    c.paid = 0;
    c.notes = (c.notes ? c.notes + "\n" : "") + "Ref. offer " + qt.no;
    c._fromOffer = qt.id;
    openInvoice(c);
  }
  if (ds.xls) {
    exportXlsx({ products: ["Product Catalogue"], filaments: ["Filament"], prints: ["Print log"], invoices: ["Invoices", "Invoice lines"], expenses: ["Expenses"], accounts: ["Accounts"] }[ds.xls], ds.xls + "-" + today() + ".xlsx");
  }
  if (ds.pdf) reportPdf([ds.pdf], ds.pdf + "-" + today() + ".pdf");
};
document.addEventListener("click", handleDocClickGlobal);

const handleDocKeyDownGlobal = e => {
  if (e.key === "Escape") {
    const colorPopover = $("#colorPickerPopover");
    if (colorPopover && !colorPopover.hidden) {
      colorPopover.hidden = true;
      const btn = $("#colorPickerBtn");
      if (btn) {
        btn.setAttribute("aria-expanded", "false");
        btn.classList.remove("open");
      }
      const grp = $("#colorPickerGroup");
      if (grp) grp.classList.remove("open");
      return;
    }
    const delScrim = $("#delModalScrim");
    if (delScrim) {
      const card = $(".del-modal-card");
      if (card) {
        card.classList.add("del-out");
        delScrim.classList.add("del-out");
        setTimeout(closeModal, 160);
      } else {
        closeModal();
      }
      return;
    }
    if ($("#scrim")) {
      closeModal();
    }
  }
};
document.addEventListener("keydown", handleDocKeyDownGlobal);

/* ==========================================================================
   Full SheetJS & jsPDF Export Engine (Ditto Copy)
   ========================================================================== */
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "file";

async function offer(filename, data) {
  if (dl) {
    try {
      await dl.save({ filename, data });
    } catch(e) {
      if (e.code === "declined") return;
      toast(e.code === "rate_limited" ? "A download is already waiting for your answer." : "Couldn't save the file here.");
    }
    return;
  }
  try {
    const type = /\.xlsx$/i.test(filename) ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : /\.pdf$/i.test(filename) ? "application/pdf" : "application/octet-stream";
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch(e) {
    toast("Couldn't save the file here.");
  }
}

function sheets() {
  const r2 = v => Math.round(N(v) * 100) / 100;
  const currency = cur();

  // 1. Summary
  const summarySheet = (() => {
    const sales = liveInv().filter(i => i.type === "sale");
    const rev = sales.reduce((a, i) => { const t = invTotals(i); return a + t.sub - t.disc; }, 0);
    const cogs = sales.reduce((a, i) => a + invCost(i), 0);
    const foc = liveInv().filter(i => i.type === "foc").reduce((a, i) => a + invCost(i), 0);
    const exp = S.expenses.filter(e => e.category !== "Filament purchase").reduce((a, e) => a + N(e.amount), 0);
    const rec = sales.reduce((a, i) => a + invTotals(i).bal, 0);
    const prodCount = S.products.length;
    const stockPcs = S.products.reduce((a, p) => a + Math.max(0, stockOf(p)), 0);
    const stockVal = S.products.reduce((a, p) => a + Math.max(0, stockOf(p)) * unitCost(p), 0);
    const filCount = S.filaments.length;
    const filGrams = S.filaments.reduce((a, f) => a + Math.max(0, filLeft(f)), 0);
    const filVal = S.filaments.reduce((a, f) => a + (Math.max(0, filLeft(f)) * filCostKg(f) / 1000), 0);

    return [
      { "Metric": "Invoiced Sales (ex VAT)", "Amount": r2(rev), "Currency / Unit": currency, "Notes": sales.length + " sales invoices issued" },
      { "Metric": "Cost of Goods Sold (COGS)", "Amount": r2(cogs), "Currency / Unit": currency, "Notes": "Raw material, power & machine wear for sold goods" },
      { "Metric": "Gross Operating Profit", "Amount": r2(rev - cogs), "Currency / Unit": currency, "Notes": rev > 0 ? ((rev - cogs) / rev * 100).toFixed(1) + "% gross margin" : "0%" },
      { "Metric": "Free of Charge / Marketing Cost", "Amount": r2(foc), "Currency / Unit": currency, "Notes": "Cost of promotional & sample prints" },
      { "Metric": "Operational Expenses (excl. filament)", "Amount": r2(exp), "Currency / Unit": currency, "Notes": "Rent, utilities, packaging & studio costs" },
      { "Metric": "Net Operating Profit", "Amount": r2(rev - cogs - foc - exp), "Currency / Unit": currency, "Notes": "Net bottom-line studio earnings" },
      { "Metric": "Accounts Receivable (Unpaid)", "Amount": r2(rec), "Currency / Unit": currency, "Notes": "Outstanding balance from clients" },
      { "Metric": "Finished Goods in Stock", "Amount": stockPcs, "Currency / Unit": "Pieces", "Notes": prodCount + " catalog items registered" },
      { "Metric": "Finished Goods Stock Valuation", "Amount": r2(stockVal), "Currency / Unit": currency, "Notes": "Valued at base unit production cost" },
      { "Metric": "Active Filament Inventory", "Amount": r2(filGrams), "Currency / Unit": "Grams", "Notes": filCount + " registered spools on hand" },
      { "Metric": "Filament Inventory Valuation", "Amount": r2(filVal), "Currency / Unit": currency, "Notes": "Valued at individual spool purchase rates" }
    ];
  })();

  // 2. Printed Stock
  const stockRows = S.products.map((p, idx) => ({
    "No.": idx + 1,
    "Item Name": p.name || "",
    "SKU": p.sku || "",
    "Category": p.category || "",
    "Storage Location": p.location || "",
    "Default Filament": (byId("filaments", p.filamentId) || {}).name || "",
    "Weight (g)": N(p.grams),
    "Print Time (min)": N(p.minutes),
    "Opening Stock": N(p.openingStock),
    "In Stock (pcs)": stockOf(p),
    ["Unit Cost (" + currency + ")"]: r2(unitCost(p)),
    ["Wholesale Price (" + currency + ")"]: r2(p.agentPrice),
    ["Direct Retail Price (" + currency + ")"]: r2(p.directPrice),
    ["Stock Valuation (" + currency + ")"]: r2(Math.max(0, stockOf(p)) * unitCost(p))
  }));
  if (stockRows.length > 0) {
    const totStockPcs = S.products.reduce((a, p) => a + stockOf(p), 0);
    const totStockVal = S.products.reduce((a, p) => a + Math.max(0, stockOf(p)) * unitCost(p), 0);
    stockRows.push({
      "No.": "TOTAL",
      "Item Name": "TOTAL SUMMARY (" + S.products.length + " ITEMS)",
      "SKU": "",
      "Category": "",
      "Storage Location": "",
      "Default Filament": "",
      "Weight (g)": "",
      "Print Time (min)": "",
      "Opening Stock": "",
      "In Stock (pcs)": totStockPcs,
      ["Unit Cost (" + currency + ")"]: "",
      ["Wholesale Price (" + currency + ")"]: "",
      ["Direct Retail Price (" + currency + ")"]: "",
      ["Stock Valuation (" + currency + ")"]: r2(totStockVal)
    });
  }

  // 3. Filament Inventory
  const filRows = S.filaments.map((f, idx) => ({
    "No.": idx + 1,
    "Spool Name": f.name || "",
    "Material": f.material || "",
    "Brand": f.brand || "",
    "Colour": f.color || "",
    "Storage Location": f.location || "",
    "Purchased (g)": N(f.weightG),
    "Consumed (g)": r2(filUsed(f)),
    "Remaining (g)": r2(filLeft(f)),
    ["Price Paid (" + currency + ")"]: r2(f.price),
    ["Cost / kg (" + currency + ")"]: r2(filCostKg(f)),
    ["Remaining Value (" + currency + ")"]: r2(Math.max(0, filLeft(f)) * filCostKg(f) / 1000),
    "Purchase Date": f.date || ""
  }));
  if (filRows.length > 0) {
    const totBought = S.filaments.reduce((a, f) => a + N(f.weightG), 0);
    const totUsed = S.filaments.reduce((a, f) => a + filUsed(f), 0);
    const totLeft = S.filaments.reduce((a, f) => a + filLeft(f), 0);
    const totVal = S.filaments.reduce((a, f) => a + (Math.max(0, filLeft(f)) * filCostKg(f) / 1000), 0);
    filRows.push({
      "No.": "TOTAL",
      "Spool Name": "TOTAL SUMMARY (" + S.filaments.length + " SPOOLS)",
      "Material": "",
      "Brand": "",
      "Colour": "",
      "Storage Location": "",
      "Purchased (g)": r2(totBought),
      "Consumed (g)": r2(totUsed),
      "Remaining (g)": r2(totLeft),
      ["Price Paid (" + currency + ")"]: "",
      ["Cost / kg (" + currency + ")"]: "",
      ["Remaining Value (" + currency + ")"]: r2(totVal),
      "Purchase Date": ""
    });
  }

  // 4. Print Log
  const printRows = S.prints.map((p, idx) => ({
    "No.": idx + 1,
    "Date": p.date || "",
    "Product Item": (byId("products", p.productId) || {}).name || "",
    "Good (pcs)": N(p.qty),
    "Failed (pcs)": N(p.failed),
    "Filament Spool": (byId("filaments", p.filamentId) || {}).name || "",
    "Grams Extruded": N(p.grams),
    "Machine Hours": N(p.hours),
    "Operator Notes": p.note || ""
  }));
  if (printRows.length > 0) {
    const totGood = S.prints.reduce((a, p) => a + N(p.qty), 0);
    const totFail = S.prints.reduce((a, p) => a + N(p.failed), 0);
    const totGrams = S.prints.reduce((a, p) => a + N(p.grams), 0);
    const totHours = S.prints.reduce((a, p) => a + N(p.hours), 0);
    printRows.push({
      "No.": "TOTAL",
      "Date": "",
      "Product Item": "TOTAL SUMMARY (" + S.prints.length + " PRINT JOBS)",
      "Good (pcs)": totGood,
      "Failed (pcs)": totFail,
      "Filament Spool": "",
      "Grams Extruded": r2(totGrams),
      "Machine Hours": r2(totHours),
      "Operator Notes": ""
    });
  }

  // 5. Invoices
  const invRows = S.invoices.map((i, idx) => {
    const t = invTotals(i);
    const cost = invCost(i);
    const margin = i.type === "sale" ? (t.sub - t.disc) - cost : -cost;
    return {
      "No.": i.no,
      "Document Type": { sale: "Tax Invoice", quote: "Price Offer", foc: "FOC Delivery Note" }[i.type] || i.type,
      "Issue Date": i.date || "",
      "Channel": i.channel === "agent" ? "Agent / Wholesale" : "Direct Retail",
      "Customer Name": i.customer || "",
      "Phone": i.phone || "",
      ["Subtotal (" + currency + ")"]: r2(t.sub),
      ["Discount (" + currency + ")"]: r2(t.disc),
      ["VAT (" + currency + ")"]: r2(t.vat),
      ["Grand Total (" + currency + ")"]: r2(t.total),
      ["Amount Paid (" + currency + ")"]: r2(t.paid),
      ["Balance Due (" + currency + ")"]: r2(t.bal),
      "Status": payStatus(i)[0],
      ["Production Cost (" + currency + ")"]: r2(cost),
      ["Net Margin (" + currency + ")"]: r2(margin)
    };
  });
  if (invRows.length > 0) {
    const salesInvs = S.invoices.filter(i => i.type === "sale");
    const totSub = salesInvs.reduce((a, i) => a + invTotals(i).sub, 0);
    const totDisc = salesInvs.reduce((a, i) => a + invTotals(i).disc, 0);
    const totVat = salesInvs.reduce((a, i) => a + invTotals(i).vat, 0);
    const totGrand = salesInvs.reduce((a, i) => a + invTotals(i).total, 0);
    const totPaid = salesInvs.reduce((a, i) => a + invTotals(i).paid, 0);
    const totBal = salesInvs.reduce((a, i) => a + invTotals(i).bal, 0);
    const totCost = S.invoices.reduce((a, i) => a + invCost(i), 0);
    const totMargin = (totSub - totDisc) - totCost;
    invRows.push({
      "No.": "TOTAL",
      "Document Type": "TOTAL SALES SUMMARY",
      "Issue Date": "",
      "Channel": "",
      "Customer Name": "",
      "Phone": "",
      ["Subtotal (" + currency + ")"]: r2(totSub),
      ["Discount (" + currency + ")"]: r2(totDisc),
      ["VAT (" + currency + ")"]: r2(totVat),
      ["Grand Total (" + currency + ")"]: r2(totGrand),
      ["Amount Paid (" + currency + ")"]: r2(totPaid),
      ["Balance Due (" + currency + ")"]: r2(totBal),
      "Status": "",
      ["Production Cost (" + currency + ")"]: r2(totCost),
      ["Net Margin (" + currency + ")"]: r2(totMargin)
    });
  }

  // 6. Invoice Line Items
  const lineRows = S.invoices.flatMap(i => (i.lines || []).map((l, lIdx) => ({
    "Invoice No": i.no,
    "Date": i.date || "",
    "Type": i.type,
    "Line #": lIdx + 1,
    "Item Description": l.name || "",
    "Quantity": N(l.qty),
    ["Unit Price (" + currency + ")"]: r2(l.price),
    ["Line Total (" + currency + ")"]: r2(N(l.qty) * N(l.price)),
    ["Unit Cost (" + currency + ")"]: l.unitCost != null ? r2(l.unitCost) : (byId("products", l.productId) ? r2(unitCost(byId("products", l.productId))) : 0),
    ["Total Cost (" + currency + ")"]: r2((l.unitCost != null ? N(l.unitCost) : (byId("products", l.productId) ? unitCost(byId("products", l.productId)) : 0)) * N(l.qty))
  })));

  // 7. Expenses
  const expRows = S.expenses.map((e, idx) => ({
    "No.": idx + 1,
    "Date": e.date || "",
    "Category": e.category || "",
    "Description": e.desc || "",
    ["Amount (" + currency + ")"]: r2(e.amount)
  }));
  if (expRows.length > 0) {
    const totExp = S.expenses.reduce((a, e) => a + N(e.amount), 0);
    expRows.push({
      "No.": "TOTAL",
      "Date": "",
      "Category": "TOTAL SUMMARY (" + S.expenses.length + " EXPENSES)",
      "Description": "",
      ["Amount (" + currency + ")"]: r2(totExp)
    });
  }

  // 8. Accounts (Monthly P&L)
  const accRows = (() => {
    const m = {};
    liveInv().forEach(i => {
      const k = String(i.date || "").slice(0, 7) || "Unspecified";
      const t = invTotals(i);
      m[k] = m[k] || { Month: k, "Sales ex VAT": 0, "Cost of Goods": 0, "FOC Cost": 0, "Operating Expenses": 0, "Output VAT": 0 };
      if (i.type === "sale") {
        m[k]["Sales ex VAT"] += t.sub - t.disc;
        m[k]["Cost of Goods"] += invCost(i);
        m[k]["Output VAT"] += t.vat;
      } else {
        m[k]["FOC Cost"] += invCost(i);
      }
    });
    S.expenses.filter(e => e.category !== "Filament purchase").forEach(e => {
      const k = String(e.date || "").slice(0, 7) || "Unspecified";
      m[k] = m[k] || { Month: k, "Sales ex VAT": 0, "Cost of Goods": 0, "FOC Cost": 0, "Operating Expenses": 0, "Output VAT": 0 };
      m[k]["Operating Expenses"] += N(e.amount);
    });
    const months = Object.values(m).sort((a, b) => a.Month.localeCompare(b.Month)).map(r => {
      const net = r["Sales ex VAT"] - r["Cost of Goods"] - r["FOC Cost"] - r["Operating Expenses"];
      const margin = r["Sales ex VAT"] > 0 ? ((net / r["Sales ex VAT"]) * 100).toFixed(1) + "%" : "0.0%";
      return {
        "Month": r.Month,
        ["Sales ex VAT (" + currency + ")"]: r2(r["Sales ex VAT"]),
        ["Cost of Goods (" + currency + ")"]: r2(r["Cost of Goods"]),
        ["FOC Samples Cost (" + currency + ")"]: r2(r["FOC Cost"]),
        ["Operating Expenses (" + currency + ")"]: r2(r["Operating Expenses"]),
        ["Output VAT (" + currency + ")"]: r2(r["Output VAT"]),
        ["Net Profit (" + currency + ")"]: r2(net),
        "Net Margin %": margin
      };
    });
    if (months.length > 0) {
      const totSales = months.reduce((a, r) => a + r["Sales ex VAT (" + currency + ")"], 0);
      const totCogs = months.reduce((a, r) => a + r["Cost of Goods (" + currency + ")"], 0);
      const totFoc = months.reduce((a, r) => a + r["FOC Samples Cost (" + currency + ")"], 0);
      const totExp = months.reduce((a, r) => a + r["Operating Expenses (" + currency + ")"], 0);
      const totVat = months.reduce((a, r) => a + r["Output VAT (" + currency + ")"], 0);
      const totNet = months.reduce((a, r) => a + r["Net Profit (" + currency + ")"], 0);
      const avgMargin = totSales > 0 ? ((totNet / totSales) * 100).toFixed(1) + "%" : "0.0%";
      months.push({
        "Month": "TOTAL SUMMARY",
        ["Sales ex VAT (" + currency + ")"]: r2(totSales),
        ["Cost of Goods (" + currency + ")"]: r2(totCogs),
        ["FOC Samples Cost (" + currency + ")"]: r2(totFoc),
        ["Operating Expenses (" + currency + ")"]: r2(totExp),
        ["Output VAT (" + currency + ")"]: r2(totVat),
        ["Net Profit (" + currency + ")"]: r2(totNet),
        "Net Margin %": avgMargin
      });
    }
    return months;
  })();

  const allSheets = {
    "Summary": summarySheet,
    "Product Catalogue": stockRows,
    "Printed stock": stockRows,
    "Filament": filRows,
    "Print log": printRows,
    "Invoices": invRows,
    "Invoice lines": lineRows,
    "Expenses": expRows,
    "Accounts": accRows
  };
  return allSheets;
}

function exportXlsx(names, filename) {
  if (!window.XLSX) { notify({ type: "warn", title: "Library Missing", message: "Excel library didn't load — check your connection." }); return; }
  try {
    const all = sheets(), wb = XLSX.utils.book_new();
    wb.Props = {
      Title: "3D Print Studio Export",
      Subject: "Production & Financial Data",
      Author: "3D Print Studio",
      Company: "3D Print Studio",
      CreatedDate: new Date()
    };
    const defaultSheetOrder = ["Summary", "Product Catalogue", "Filament", "Print log", "Invoices", "Invoice lines", "Expenses", "Accounts"];
    const targetSheets = names || defaultSheetOrder;
    targetSheets.forEach(n => {
      const data = all[n] || [];
      const ws = data.length ? XLSX.utils.json_to_sheet(data) : XLSX.utils.aoa_to_sheet([["No records recorded yet"]]);
      if (data.length > 0) {
        ws["!autofilter"] = { ref: ws["!ref"] };
        const keys = Object.keys(data[0]);
        ws["!cols"] = keys.map(k => {
          let maxLen = k.length;
          for (let rowIdx = 0; rowIdx < Math.min(data.length, 100); rowIdx++) {
            const v = String(data[rowIdx][k] ?? "");
            if (v.length > maxLen) maxLen = v.length;
          }
          return { wch: Math.min(45, Math.max(10, maxLen + 3)) };
        });
      } else {
        ws["!cols"] = [{ wch: 25 }];
      }
      XLSX.utils.book_append_sheet(wb, ws, n.slice(0, 31));
    });
    saveXlsx(wb, filename);
  } catch(e) {
    console.error(e);
    notify({ type: "warn", title: "Export Failed", message: "Couldn't generate the Excel spreadsheet." });
  }
}

function saveXlsx(wb, filename) {
  try {
    offer(filename, XLSX.write(wb, { bookType: "xlsx", type: "array" }));
    notify({ type: "info", title: "Excel Downloaded", message: `${filename} downloaded successfully.` });
  } catch(e) {
    notify({ type: "warn", title: "Export Failed", message: "Couldn't build the Excel file." });
  }
}

function pdfHead(title, landscape, docSubtitle) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const st = set_();
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // 1. Top Decorative Dual Brand Bar
  doc.setFillColor(6, 44, 47); // Dark studio teal
  doc.rect(0, 0, W, 3.8, "F");
  doc.setFillColor(10, 108, 116); // Vibrant brand accent
  doc.rect(0, 3.8, W, 0.8, "F");

  // 2. High-DPI Studio Logo Badge
  if (STUDIO_LOGO_BASE64) {
    try {
      doc.addImage(STUDIO_LOGO_BASE64, "PNG", 14, 8, 16.5, 16.5);
    } catch(e) {
      console.warn("Logo render error:", e);
    }
  }

  // 3. Studio Profile (Left)
  const leftX = 34;
  const maxLeftW = (W / 2) - 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(6, 44, 47);
  doc.text(st.bizName || "3D PRINT STUDIO", leftX, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(80, 104, 103);
  doc.text("Precision Additive Manufacturing & Rapid Prototyping", leftX, 18);

  doc.setFontSize(7);
  doc.setTextColor(110, 130, 130);
  const contactLines = [
    st.address,
    [st.phone && "Tel: " + st.phone, st.email].filter(Boolean).join("  •  "),
    st.trn ? "TRN: " + st.trn : ""
  ].filter(Boolean);
  const contactStr = contactLines.join("  •  ");
  const wrappedContact = doc.splitTextToSize(contactStr, maxLeftW);
  doc.text(wrappedContact, leftX, 22);

  // 4. Document Classification & Metadata (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(10, 108, 116);
  doc.text(title, W - 14, 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(docSubtitle || ("Generated: " + new Date().toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })), W - 14, 19, { align: "right" });

  doc.setFontSize(7.5);
  doc.setTextColor(130, 145, 145);
  doc.text("Currency: " + cur() + " (" + (cur() === "AED" ? "UAE Dirham" : cur()) + ")", W - 14, 23, { align: "right" });

  // 5. Crisp Divider Rule
  doc.setDrawColor(215, 230, 229);
  doc.setLineWidth(0.35);
  doc.line(14, 27, W - 14, 27);

  return doc;
}

function savePdf(doc, filename) {
  try {
    const n = doc.internal.getNumberOfPages();
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    for (let i = 1; i <= n; i++) {
      doc.setPage(i);

      // Bottom Divider Rule
      doc.setDrawColor(220, 232, 231);
      doc.setLineWidth(0.3);
      doc.line(14, H - 10, W - 14, H - 10);

      // Studio Tagline (Left)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(130, 145, 145);
      doc.text("3D Print Studio  •  Precision Additive Manufacturing & Ledger System", 14, H - 6.5);

      // Pagination (Right)
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 120, 120);
      doc.text(`Page ${i} of ${n}`, W - 14, H - 6.5, { align: "right" });
    }

    offer(filename, doc.output("arraybuffer"));
    notify({ type: "info", title: "PDF Downloaded", message: `${filename} downloaded successfully.` });
  } catch(e) {
    console.error(e);
    notify({ type: "warn", title: "PDF Failed", message: "Couldn't build the PDF file." });
  }
}

function invoicePdf(i) {
  if (!window.jspdf) { notify({ type: "warn", title: "Library Missing", message: "PDF library didn't load — check your connection." }); return; }
  try {
    const st = set_();
    const t = invTotals(i);
    const title = { sale: "TAX INVOICE", quote: "PRICE OFFER", foc: "FOC DELIVERY NOTE" }[i.type] || "TAX INVOICE";
    const doc = pdfHead(title, false, `Ref: ${i.no}`);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Two column recipient & status box
    const boxY = 32;
    const colWidth = (W - 28 - 6) / 2;

    // Recipient Card (Left)
    doc.setFillColor(248, 251, 251);
    doc.setDrawColor(220, 235, 234);
    doc.roundedRect(14, boxY, colWidth, 27, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(10, 108, 116);
    doc.text(i.type === "foc" ? "DELIVERED TO / RECIPIENT" : "BILL TO / CLIENT DETAILS", 18, boxY + 5.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(6, 44, 47);
    doc.text(i.customer || "Walk-in Client", 18, boxY + 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 100, 100);
    const addr = i.addr || "Dubai, United Arab Emirates";
    const contact = [i.phone ? "Tel: " + i.phone : "", i.ctrn ? "TRN: " + i.ctrn : ""].filter(Boolean).join("  •  ");
    doc.text(doc.splitTextToSize(addr, colWidth - 8)[0] || "", 18, boxY + 15.5);
    doc.text(contact || "Contact info on file", 18, boxY + 19.5);
    if (i.type === "foc" && i.reason) {
      doc.text("Purpose: " + i.reason, 18, boxY + 23.5);
    }

    // Status Card (Right)
    doc.setFillColor(248, 251, 251);
    doc.setDrawColor(220, 235, 234);
    doc.roundedRect(14 + colWidth + 6, boxY, colWidth, 27, 2, 2, "FD");

    const rightX = 14 + colWidth + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(10, 108, 116);
    doc.text("COMMERCIAL & PAYMENT STATUS", rightX, boxY + 5.5);

    // Pill Badge
    const badgeX = rightX;
    const badgeY = boxY + 7.5;
    let badgeText = "PAID IN FULL", badgeBg = [209, 250, 229], badgeFg = [6, 95, 70];
    if (i.type === "quote") {
      badgeText = "OFFER / QUOTATION"; badgeBg = [204, 251, 241]; badgeFg = [15, 118, 110];
    } else if (i.type === "foc") {
      badgeText = "FREE OF CHARGE / SAMPLE"; badgeBg = [237, 233, 254]; badgeFg = [109, 40, 217];
    } else if (t.bal <= 0.005) {
      badgeText = "PAID IN FULL"; badgeBg = [209, 250, 229]; badgeFg = [6, 95, 70];
    } else if (t.paid <= 0.005) {
      badgeText = "PAYMENT PENDING"; badgeBg = [255, 228, 230]; badgeFg = [190, 18, 60];
    } else {
      badgeText = "PARTIALLY PAID"; badgeBg = [254, 243, 199]; badgeFg = [180, 83, 9];
    }

    doc.setFillColor(badgeBg[0], badgeBg[1], badgeBg[2]);
    const badgeW = doc.getTextWidth(badgeText) + 8;
    doc.roundedRect(badgeX, badgeY, badgeW, 5.5, 1.2, 1.2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(badgeFg[0], badgeFg[1], badgeFg[2]);
    doc.text(badgeText, badgeX + badgeW / 2, badgeY + 3.8, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 100, 100);
    doc.text(`Issue Date: ${i.date || today()}   •   Channel: ${i.channel === "agent" ? "Wholesale" : "Direct Retail"}`, rightX, boxY + 18);
    doc.text(i.type === "quote" ? "Validity: 14 days from issue date" : (i.type === "foc" ? "Free promotional distribution" : (t.bal <= 0.005 ? "Settled in full upon fulfillment" : "Payment terms: due on delivery")), rightX, boxY + 22.5);

    // Line Items Table
    const body = (i.lines || []).map((l, k) => [
      k + 1,
      l.name || "Custom Printed Part",
      m0(l.qty) + " pcs",
      money(l.price),
      money(N(l.qty) * N(l.price))
    ]);

    doc.autoTable({
      startY: boxY + 31,
      head: [["#", "ITEM DESCRIPTION & DETAILS", "QUANTITY", "UNIT PRICE (" + cur() + ")", "LINE TOTAL (" + cur() + ")"]],
      body: body.length ? body : [["—", "No line items registered", "0", money(0), money(0)]],
      theme: "plain",
      headStyles: {
        fillColor: [6, 44, 47],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 }
      },
      styles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineColor: [225, 235, 235],
        lineWidth: 0.2
      },
      alternateRowStyles: {
        fillColor: [250, 252, 252]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: "auto" },
        2: { cellWidth: 26, halign: "right" },
        3: { cellWidth: 34, halign: "right" },
        4: { cellWidth: 36, halign: "right", fontStyle: "bold" }
      },
      margin: { left: 14, right: 14 }
    });

    const currentY = doc.lastAutoTable.finalY + 6;
    const totWidth = 76;
    const totX = W - 14 - totWidth;

    // Notes
    if (i.notes) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(10, 108, 116);
      doc.text("DOCUMENT NOTES & INSTRUCTIONS", 14, currentY + 3);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(80, 100, 100);
      doc.text(doc.splitTextToSize(i.notes, totX - 22), 14, currentY + 7.5);
    }

    // Terms
    const termsY = i.notes ? currentY + 22 : currentY + 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(10, 108, 116);
    doc.text(i.type === "foc" ? "DELIVERY ACKNOWLEDGMENT" : "TERMS & CONDITIONS", 14, termsY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 115, 115);
    const terms = i.type === "foc"
      ? "Goods supplied free of charge for testing/sampling purposes. Received in good condition and dimensional specification."
      : (st.invoiceTerms || "Payment due within agreed terms. Dimensional accuracy covered under studio quality warranty.");
    doc.text(doc.splitTextToSize(terms, totX - 22), 14, termsY + 4.5);

    // Totals Box (Right)
    const isFoc = i.type === "foc";
    const boxHeight = isFoc ? 26 : (t.disc ? 44 : 38);
    doc.setFillColor(248, 251, 251);
    doc.setDrawColor(215, 230, 229);
    doc.roundedRect(totX, currentY, totWidth, boxHeight, 2, 2, "FD");

    let ty = currentY + 5;
    if (isFoc) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 100, 100);
      doc.text("Value of Goods", totX + 5, ty);
      doc.text(money(t.sub), W - 19, ty, { align: "right" });

      ty += 5.5;
      doc.setTextColor(109, 40, 217);
      doc.text("Sample / FOC Discount", totX + 5, ty);
      doc.text("- " + money(t.sub), W - 19, ty, { align: "right" });

      ty += 6;
      doc.setFillColor(6, 44, 47);
      doc.roundedRect(totX + 4, ty, totWidth - 8, 7.5, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(255, 255, 255);
      doc.text("Amount Due", totX + 7, ty + 5);
      doc.text(money(0), W - 19, ty + 5, { align: "right" });
    } else {
      const lines = [
        ["Subtotal", money(t.sub)],
        ...(t.disc ? [["Discount", "- " + money(t.disc), true]] : []),
        [`VAT (${m1(t.vatPct)}%)`, money(t.vat)]
      ];
      lines.forEach(([lbl, val, red]) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(red ? 220 : 80, red ? 38 : 100, red ? 38 : 100);
        doc.text(lbl, totX + 5, ty);
        doc.text(val, W - 19, ty, { align: "right" });
        ty += 5.2;
      });

      doc.setDrawColor(215, 230, 229);
      doc.line(totX + 5, ty - 1, W - 19, ty - 1);

      doc.setFillColor(6, 44, 47);
      doc.roundedRect(totX + 4, ty + 1, totWidth - 8, 8, 1.5, 1.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text("Total Amount", totX + 7, ty + 6.2);
      doc.text(money(t.total), W - 19, ty + 6.2, { align: "right" });

      ty += 12.5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 100, 100);
      doc.text("Amount Paid", totX + 5, ty);
      doc.text(money(t.paid), W - 19, ty, { align: "right" });

      ty += 4.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      if (t.bal <= 0.005) {
        doc.setTextColor(5, 150, 105);
        doc.text("Balance Settled", totX + 5, ty);
        doc.text(money(0), W - 19, ty, { align: "right" });
      } else {
        doc.setTextColor(225, 29, 72);
        doc.text("Balance Due", totX + 5, ty);
        doc.text(money(t.bal), W - 19, ty, { align: "right" });
      }
    }

    // Signatures
    const sigY = Math.max(currentY + boxHeight + 8, currentY + 46);
    const sigColW = (W - 28 - 20) / 2;
    doc.setDrawColor(200, 215, 215);
    doc.line(14, sigY + 10, 14 + sigColW, sigY + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 100, 100);
    doc.text(i.type === "foc" ? "Recipient Signature & Date" : "Client Acceptance & Signature", 14, sigY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 145, 145);
    doc.text("Signature: ______________________    Date: ____/____/________", 14, sigY + 18);

    doc.line(W - 14 - sigColW, sigY + 10, W - 14, sigY + 10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(80, 100, 100);
    doc.text("Authorized Studio Representative", W - 14 - sigColW, sigY + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 145, 145);
    doc.text(`${st.bizName || "3D Print Studio"} Laboratory    Official Stamp`, W - 14 - sigColW, sigY + 18);

    savePdf(doc, `${i.no}-${slug(i.customer || "doc")}.pdf`);
  } catch(e) {
    console.error(e);
    notify({ type: "warn", title: "PDF Failed", message: "Couldn't build the invoice PDF." });
  }
}

function reportPdf(parts, filename) {
  if (!window.jspdf) { notify({ type: "warn", title: "Library Missing", message: "PDF library didn't load — check your connection." }); return; }
  try {
    const isMulti = parts.length > 1 || parts.includes("summary");
    const titleMap = {
      summary: "EXECUTIVE BUSINESS REPORT",
      products: "PRODUCT CATALOGUE REPORT",
      filaments: "FILAMENT INVENTORY REPORT",
      prints: "PRODUCTION & PRINT LOG REPORT",
      invoices: "INVOICES & COMMERCIAL REPORT",
      expenses: "OPERATIONAL EXPENSES REPORT",
      accounts: "FINANCIAL ACCOUNTS & P&L REPORT"
    };
    const mainTitle = isMulti ? "EXECUTIVE BUSINESS & INVENTORY REPORT" : (titleMap[parts[0]] || "BUSINESS REPORT");
    const doc = pdfHead(mainTitle, true, isMulti ? "Comprehensive Operations Report" : `Report Section: ${parts[0]}`);
    const W = doc.internal.pageSize.getWidth(); // 297mm
    const H = doc.internal.pageSize.getHeight(); // 210mm
    const currency = cur();

    let y = 32;

    // If multi-section report or summary is included, show 4 Executive KPI Stat Cards
    if (isMulti) {
      const sales = liveInv().filter(i => i.type === "sale");
      const rev = sales.reduce((a, i) => { const t = invTotals(i); return a + t.sub - t.disc; }, 0);
      const cogs = sales.reduce((a, i) => a + invCost(i), 0);
      const foc = liveInv().filter(i => i.type === "foc").reduce((a, i) => a + invCost(i), 0);
      const exp = S.expenses.filter(e => e.category !== "Filament purchase").reduce((a, e) => a + N(e.amount), 0);
      const netProfit = rev - cogs - foc - exp;
      const stockPcs = S.products.reduce((a, p) => a + Math.max(0, stockOf(p)), 0);
      const stockVal = S.products.reduce((a, p) => a + Math.max(0, stockOf(p)) * unitCost(p), 0);
      const filGrams = S.filaments.reduce((a, f) => a + Math.max(0, filLeft(f)), 0);
      const filVal = S.filaments.reduce((a, f) => a + (Math.max(0, filLeft(f)) * filCostKg(f) / 1000), 0);

      const cardW = (W - 28 - 9) / 4;
      const kpis = [
        { label: "TOTAL INVOICED SALES", val: money(rev), sub: `${sales.length} sales invoices • ${S.invoices.filter(i => i.type === "quote").length} offers`, color: [5, 150, 105], bg: [236, 253, 245] },
        { label: "NET OPERATING PROFIT", val: money(netProfit), sub: "After COGS, FOC & expenses", color: [10, 108, 116], bg: [239, 249, 249] },
        { label: "FINISHED GOODS STOCK", val: `${stockPcs} pcs`, sub: `Valuation: ${money(stockVal)}`, color: [225, 29, 72], bg: [255, 241, 242] },
        { label: "FILAMENT ON HAND", val: `${m0(filGrams)} g`, sub: `${S.filaments.length} spools • Val: ${money(filVal)}`, color: [109, 40, 217], bg: [245, 243, 255] }
      ];

      kpis.forEach((kpi, idx) => {
        const kx = 14 + idx * (cardW + 3);
        doc.setFillColor(kpi.bg[0], kpi.bg[1], kpi.bg[2]);
        doc.setDrawColor(220, 235, 234);
        doc.roundedRect(kx, y, cardW, 18, 1.8, 1.8, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
        doc.text(kpi.label, kx + 4, y + 4.8);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text(kpi.val, kx + 4, y + 11);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.8);
        doc.setTextColor(100, 116, 139);
        doc.text(kpi.sub, kx + 4, y + 15.5);
      });

      y += 24;
    }

    const sectionsToRender = parts.filter(p => p !== "summary");
    if (sectionsToRender.length === 0 && parts.includes("summary")) {
      sectionsToRender.push("summary_table");
    }

    sectionsToRender.forEach((sec, sIdx) => {
      if (sIdx > 0 && y > 140) {
        doc.addPage();
        y = 20;
      }

      if (sec === "products") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text("Product Catalogue & Production Metrics", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total recorded items: ${S.products.length}`, W - 14, y, { align: "right" });

        const body = S.products.map((p, i) => [
          i + 1,
          p.name || "—",
          p.sku || "—",
          p.category || "General",
          p.location || "—",
          (byId("filaments", p.filamentId) || {}).name || "Default",
          m1(p.grams) + " g",
          m0(p.minutes) + " m",
          stockOf(p),
          money(unitCost(p)),
          money(p.agentPrice),
          money(p.directPrice),
          money(Math.max(0, stockOf(p)) * unitCost(p))
        ]);

        if (body.length > 0) {
          const totPcs = S.products.reduce((a, p) => a + stockOf(p), 0);
          const totVal = S.products.reduce((a, p) => a + Math.max(0, stockOf(p)) * unitCost(p), 0);
          body.push(["TOTAL", `SUMMARY (${S.products.length} PRODUCTS)`, "", "", "", "", "", "", totPcs + " pcs", "", "", "", money(totVal)]);
        }

        doc.autoTable({
          startY: y + 3,
          head: [["#", "ITEM NAME", "SKU", "CATEGORY", "LOCATION", "FILAMENT", "WEIGHT", "TIME", "STOCK", "UNIT COST", "WHOLESALE", "RETAIL", "VALUATION"]],
          body: body.length ? body : [["—", "No products recorded yet", "", "", "", "", "", "", "", "", "", "", ""]],
          theme: "plain",
          headStyles: { fillColor: [6, 44, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } },
          styles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: [225, 235, 235], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 20 },
            3: { cellWidth: 18 },
            4: { cellWidth: 16 },
            5: { cellWidth: 24 },
            6: { cellWidth: 15, halign: "right" },
            7: { cellWidth: 15, halign: "right" },
            8: { cellWidth: 15, halign: "right", fontStyle: "bold" },
            9: { cellWidth: 20, halign: "right" },
            10: { cellWidth: 20, halign: "right" },
            11: { cellWidth: 20, halign: "right" },
            12: { cellWidth: 22, halign: "right", fontStyle: "bold" }
          },
          margin: { left: 14, right: 14 },
          didParseCell: function(data) {
            if (body.length > 0 && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 248, 248];
              data.cell.styles.textColor = [6, 44, 47];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      else if (sec === "filaments") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text("Filament Spool Inventory & Stock Valuation", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total recorded spools: ${S.filaments.length}`, W - 14, y, { align: "right" });

        const body = S.filaments.map((f, i) => [
          i + 1,
          f.name || "—",
          f.material || "—",
          f.brand || "—",
          f.color || "—",
          f.location || "—",
          m0(f.weightG) + " g",
          m0(filUsed(f)) + " g",
          m0(filLeft(f)) + " g",
          money(f.price),
          money(filCostKg(f)) + "/kg",
          money(Math.max(0, filLeft(f)) * filCostKg(f) / 1000)
        ]);

        if (body.length > 0) {
          const totBought = S.filaments.reduce((a, f) => a + N(f.weightG), 0);
          const totUsed = S.filaments.reduce((a, f) => a + filUsed(f), 0);
          const totLeft = S.filaments.reduce((a, f) => a + filLeft(f), 0);
          const totVal = S.filaments.reduce((a, f) => a + (Math.max(0, filLeft(f)) * filCostKg(f) / 1000), 0);
          body.push(["TOTAL", `SUMMARY (${S.filaments.length} SPOOLS)`, "", "", "", "", m0(totBought) + " g", m0(totUsed) + " g", m0(totLeft) + " g", "", "", money(totVal)]);
        }

        doc.autoTable({
          startY: y + 3,
          head: [["#", "SPOOL NAME", "MATERIAL", "BRAND", "COLOR", "LOCATION", "BOUGHT", "USED", "REMAINING", "PRICE", "COST/KG", "VALUATION"]],
          body: body.length ? body : [["—", "No filaments registered yet", "", "", "", "", "", "", "", "", "", ""]],
          theme: "plain",
          headStyles: { fillColor: [6, 44, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } },
          styles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: [225, 235, 235], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 22 },
            3: { cellWidth: 22 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18 },
            6: { cellWidth: 18, halign: "right" },
            7: { cellWidth: 18, halign: "right" },
            8: { cellWidth: 20, halign: "right", fontStyle: "bold" },
            9: { cellWidth: 20, halign: "right" },
            10: { cellWidth: 22, halign: "right" },
            11: { cellWidth: 24, halign: "right", fontStyle: "bold" }
          },
          margin: { left: 14, right: 14 },
          didParseCell: function(data) {
            if (body.length > 0 && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 248, 248];
              data.cell.styles.textColor = [6, 44, 47];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      else if (sec === "prints") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text("3D Print Production & Machine Run Log", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total print jobs: ${S.prints.length}`, W - 14, y, { align: "right" });

        const body = S.prints.map((p, i) => [
          i + 1,
          p.date || "—",
          (byId("products", p.productId) || {}).name || "Custom Job",
          m0(p.qty) + " pcs",
          m0(p.failed) + " pcs",
          (byId("filaments", p.filamentId) || {}).name || "—",
          m0(p.grams) + " g",
          m1(p.hours) + " hrs",
          p.note || "—"
        ]);

        if (body.length > 0) {
          const totGood = S.prints.reduce((a, p) => a + N(p.qty), 0);
          const totFail = S.prints.reduce((a, p) => a + N(p.failed), 0);
          const totGrams = S.prints.reduce((a, p) => a + N(p.grams), 0);
          const totHours = S.prints.reduce((a, p) => a + N(p.hours), 0);
          body.push(["TOTAL", "", `SUMMARY (${S.prints.length} PRINT JOBS)`, totGood + " pcs", totFail + " pcs", "", m0(totGrams) + " g", m1(totHours) + " hrs", ""]);
        }

        doc.autoTable({
          startY: y + 3,
          head: [["#", "DATE", "PRODUCT ITEM", "GOOD", "FAILED", "FILAMENT USED", "WEIGHT", "TIME", "OPERATOR NOTES"]],
          body: body.length ? body : [["—", "No print runs logged yet", "", "", "", "", "", "", ""]],
          theme: "plain",
          headStyles: { fillColor: [6, 44, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } },
          styles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: [225, 235, 235], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 20 },
            2: { cellWidth: "auto" },
            3: { cellWidth: 18, halign: "right" },
            4: { cellWidth: 18, halign: "right" },
            5: { cellWidth: 32 },
            6: { cellWidth: 20, halign: "right" },
            7: { cellWidth: 20, halign: "right" },
            8: { cellWidth: 42 }
          },
          margin: { left: 14, right: 14 },
          didParseCell: function(data) {
            if (body.length > 0 && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 248, 248];
              data.cell.styles.textColor = [6, 44, 47];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      else if (sec === "invoices") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text("Invoices, Price Offers & Commercial Documents", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total recorded documents: ${S.invoices.length}`, W - 14, y, { align: "right" });

        const body = S.invoices.map((inv, i) => {
          const t = invTotals(inv);
          return [
            i + 1,
            inv.no,
            { sale: "Invoice", quote: "Offer", foc: "FOC" }[inv.type] || inv.type,
            inv.date || "—",
            inv.customer || "—",
            inv.channel === "agent" ? "Wholesale" : "Direct",
            money(t.sub),
            t.disc ? "- " + money(t.disc) : "—",
            money(t.vat),
            money(t.total),
            money(t.paid),
            money(t.bal),
            payStatus(inv)[0]
          ];
        });

        if (body.length > 0) {
          const salesInvs = S.invoices.filter(i => i.type === "sale");
          const totSub = salesInvs.reduce((a, i) => a + invTotals(i).sub, 0);
          const totDisc = salesInvs.reduce((a, i) => a + invTotals(i).disc, 0);
          const totVat = salesInvs.reduce((a, i) => a + invTotals(i).vat, 0);
          const totGrand = salesInvs.reduce((a, i) => a + invTotals(i).total, 0);
          const totPaid = salesInvs.reduce((a, i) => a + invTotals(i).paid, 0);
          const totBal = salesInvs.reduce((a, i) => a + invTotals(i).bal, 0);
          body.push(["TOTAL", "", "SALES SUMMARY", "", "", "", money(totSub), totDisc ? "- " + money(totDisc) : "—", money(totVat), money(totGrand), money(totPaid), money(totBal), ""]);
        }

        doc.autoTable({
          startY: y + 3,
          head: [["#", "DOC NO", "TYPE", "DATE", "CUSTOMER", "CHANNEL", "SUBTOTAL", "DISC", "VAT", "TOTAL", "PAID", "BALANCE", "STATUS"]],
          body: body.length ? body : [["—", "No invoices or offers recorded yet", "", "", "", "", "", "", "", "", "", "", ""]],
          theme: "plain",
          headStyles: { fillColor: [6, 44, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } },
          styles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: [225, 235, 235], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 20 },
            2: { cellWidth: 16 },
            3: { cellWidth: 18 },
            4: { cellWidth: "auto" },
            5: { cellWidth: 18 },
            6: { cellWidth: 20, halign: "right" },
            7: { cellWidth: 16, halign: "right" },
            8: { cellWidth: 16, halign: "right" },
            9: { cellWidth: 22, halign: "right", fontStyle: "bold" },
            10: { cellWidth: 20, halign: "right" },
            11: { cellWidth: 20, halign: "right", fontStyle: "bold" },
            12: { cellWidth: 22, halign: "center" }
          },
          margin: { left: 14, right: 14 },
          didParseCell: function(data) {
            if (body.length > 0 && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 248, 248];
              data.cell.styles.textColor = [6, 44, 47];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      else if (sec === "expenses") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text("Operational Studio Expenses", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total recorded expenses: ${S.expenses.length}`, W - 14, y, { align: "right" });

        const body = S.expenses.map((e, i) => [
          i + 1,
          e.date || "—",
          e.category || "General",
          e.desc || "—",
          money(e.amount)
        ]);

        if (body.length > 0) {
          const totExp = S.expenses.reduce((a, e) => a + N(e.amount), 0);
          body.push(["TOTAL", "", "TOTAL EXPENSES SUMMARY", "", money(totExp)]);
        }

        doc.autoTable({
          startY: y + 3,
          head: [["#", "DATE", "EXPENSE CATEGORY", "DESCRIPTION / VENDOR", "AMOUNT (" + cur() + ")"]],
          body: body.length ? body : [["—", "No expenses recorded yet", "", "", ""]],
          theme: "plain",
          headStyles: { fillColor: [6, 44, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } },
          styles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: [225, 235, 235], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 252] },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: 24 },
            2: { cellWidth: 45 },
            3: { cellWidth: "auto" },
            4: { cellWidth: 32, halign: "right", fontStyle: "bold" }
          },
          margin: { left: 14, right: 14 },
          didParseCell: function(data) {
            if (body.length > 0 && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 248, 248];
              data.cell.styles.textColor = [6, 44, 47];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 8;
      }

      else if (sec === "accounts") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(6, 44, 47);
        doc.text("Monthly Financial Accounts & P&L Statement", 14, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text("All figures in " + cur(), W - 14, y, { align: "right" });

        const m = {};
        liveInv().forEach(i => {
          const k = String(i.date || "").slice(0, 7) || "Unspecified";
          const t = invTotals(i);
          m[k] = m[k] || { Month: k, sales: 0, cogs: 0, foc: 0, exp: 0, vat: 0 };
          if (i.type === "sale") {
            m[k].sales += t.sub - t.disc;
            m[k].cogs += invCost(i);
            m[k].vat += t.vat;
          } else {
            m[k].foc += invCost(i);
          }
        });
        S.expenses.filter(e => e.category !== "Filament purchase").forEach(e => {
          const k = String(e.date || "").slice(0, 7) || "Unspecified";
          m[k] = m[k] || { Month: k, sales: 0, cogs: 0, foc: 0, exp: 0, vat: 0 };
          m[k].exp += N(e.amount);
        });

        const rows = Object.values(m).sort((a, b) => a.Month.localeCompare(b.Month));
        const body = rows.map(r => {
          const net = r.sales - r.cogs - r.foc - r.exp;
          const margin = r.sales > 0 ? ((net / r.sales) * 100).toFixed(1) + "%" : "0.0%";
          return [
            r.Month,
            money(r.sales),
            money(r.cogs),
            money(r.foc),
            money(r.exp),
            money(r.vat),
            money(net),
            margin
          ];
        });

        if (body.length > 0) {
          const totSales = rows.reduce((a, r) => a + r.sales, 0);
          const totCogs = rows.reduce((a, r) => a + r.cogs, 0);
          const totFoc = rows.reduce((a, r) => a + r.foc, 0);
          const totExp = rows.reduce((a, r) => a + r.exp, 0);
          const totVat = rows.reduce((a, r) => a + r.vat, 0);
          const totNet = totSales - totCogs - totFoc - totExp;
          const avgMargin = totSales > 0 ? ((totNet / totSales) * 100).toFixed(1) + "%" : "0.0%";
          body.push(["TOTAL", money(totSales), money(totCogs), money(totFoc), money(totExp), money(totVat), money(totNet), avgMargin]);
        }

        doc.autoTable({
          startY: y + 3,
          head: [["MONTH", "SALES EX VAT", "COST OF GOODS", "FOC SAMPLES", "OPERATING EXP", "OUTPUT VAT", "NET PROFIT", "MARGIN %"]],
          body: body.length ? body : [["—", "No monthly financial activity recorded yet", "", "", "", "", "", ""]],
          theme: "plain",
          headStyles: { fillColor: [6, 44, 47], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7, cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 } },
          styles: { fontSize: 7, textColor: [30, 41, 59], cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: [225, 235, 235], lineWidth: 0.2 },
          alternateRowStyles: { fillColor: [250, 252, 252] },
          columnStyles: {
            0: { cellWidth: 26, fontStyle: "bold" },
            1: { cellWidth: "auto", halign: "right" },
            2: { cellWidth: "auto", halign: "right" },
            3: { cellWidth: "auto", halign: "right" },
            4: { cellWidth: "auto", halign: "right" },
            5: { cellWidth: "auto", halign: "right" },
            6: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
            7: { cellWidth: 26, halign: "right", fontStyle: "bold" }
          },
          margin: { left: 14, right: 14 },
          didParseCell: function(data) {
            if (body.length > 0 && data.row.index === body.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = [240, 248, 248];
              data.cell.styles.textColor = [6, 44, 47];
            }
          }
        });
        y = doc.lastAutoTable.finalY + 8;
      }
    });

    savePdf(doc, filename);
  } catch(e) {
    console.error(e);
    notify({ type: "warn", title: "PDF Report Failed", message: "Couldn't build the PDF report." });
  }
}

function exportCalcPdf() {
  if (!window.jspdf) { notify({ type: "warn", title: "Library Missing", message: "PDF library didn't load — check your connection." }); return; }
  try {
    const r = calcResult();
    const itemName = calc.name || "Custom 3D Print";
    const fil = calc.filamentId ? byId("filaments", calc.filamentId) : null;
    const filName = fil ? fil.name : "Custom Spool";
    const costKgVal = r.costKg;
    const qtyVal = Math.max(1, N(calc.qty) || 1);

    const doc = pdfHead("COST ESTIMATION SHEET", false, "Ref: " + itemName);
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();

    // Specifications Box
    const boxY = 32;
    doc.setFillColor(248, 251, 251);
    doc.setDrawColor(220, 235, 234);
    doc.roundedRect(14, boxY, W - 28, 20, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(10, 108, 116);
    doc.text("PRODUCTION SPECIFICATIONS & PARAMETERS", 18, boxY + 5.5);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(6, 44, 47);
    doc.text("Item Name: " + itemName, 18, boxY + 11);
    doc.text("Filament: " + filName + "  •  Material Rate: " + money(costKgVal) + "/kg", 18, boxY + 16);

    doc.text("Weight / Item: " + m1(calc.grams) + " g", W / 2 + 10, boxY + 11);
    doc.text("Print Time: " + m0(calc.minutes) + " min (" + (N(calc.minutes)/60).toFixed(1) + " hrs)  •  Batch Qty: " + qtyVal + " pcs", W / 2 + 10, boxY + 16);

    // Breakdown Table
    const costItems = [
      ["1", "Filament Material Cost", m1(calc.grams) + " g extruded @ " + money(costKgVal) + "/kg raw spool cost", money(r.material)],
      ["2", "Electricity Consumption", m0(calc.minutes) + " min machine heating & stepper power", money(r.power)],
      ["3", "Machine Wear & Maintenance", "Nozzle, PEI sheet, belts & gantry depreciation", money(r.machine)],
      ["4", "Labor & Post-Processing", (N(calc.laborMin) || 0) + " min support removal, cleaning & dimensional check", money(r.labor)],
      ["5", "Packaging & Consumables", "Packaging box, anti-static wrap & labeling", money(r.pack)],
      ["TOTAL", "SUBTOTAL UNIT PRODUCTION COST", "Base cost of producing 1 finished piece", money(r.total)]
    ];

    doc.autoTable({
      startY: boxY + 24,
      head: [["#", "COST COMPONENT", "CALCULATION BASIS / DETAILS", "COST PER PIECE (" + cur() + ")"]],
      body: costItems,
      theme: "plain",
      headStyles: {
        fillColor: [6, 44, 47],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 }
      },
      styles: {
        fontSize: 8.5,
        textColor: [30, 41, 59],
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineColor: [225, 235, 235],
        lineWidth: 0.2
      },
      alternateRowStyles: {
        fillColor: [250, 252, 252]
      },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 55, fontStyle: "bold" },
        2: { cellWidth: "auto" },
        3: { cellWidth: 42, halign: "right", fontStyle: "bold" }
      },
      margin: { left: 14, right: 14 },
      didParseCell: function(data) {
        if (data.row.index === costItems.length - 1) {
          data.cell.styles.fillColor = [240, 248, 248];
          data.cell.styles.textColor = [6, 44, 47];
        }
      }
    });

    const curY = doc.lastAutoTable.finalY + 8;
    const colW = (W - 28 - 6) / 2;

    const agentProfit = r.agent - r.total;
    const agentMargin = r.total > 0 ? ((agentProfit / r.total) * 100).toFixed(1) : "0.0";
    const directProfit = r.direct - r.total;
    const directMargin = r.total > 0 ? ((directProfit / r.total) * 100).toFixed(1) : "0.0";

    // Wholesale Card (Left)
    doc.setFillColor(248, 251, 251);
    doc.setDrawColor(220, 235, 234);
    doc.roundedRect(14, curY, colW, 36, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(10, 108, 116);
    doc.text("WHOLESALE / AGENT PRICING", 18, curY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(6, 44, 47);
    doc.text(money(r.agent), 18, curY + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 100, 100);
    doc.text("Profit per unit: " + money(agentProfit) + " (+" + agentMargin + "% markup)", 18, curY + 20);
    doc.text("Batch Total (" + qtyVal + " pcs): " + money(r.agent * qtyVal), 18, curY + 25);
    doc.text("Batch Profit: " + money(agentProfit * qtyVal), 18, curY + 29.5);

    // Retail Card (Right)
    doc.roundedRect(14 + colW + 6, curY, colW, 36, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(10, 108, 116);
    doc.text("DIRECT RETAIL PRICING", 14 + colW + 10, curY + 6);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(5, 150, 105);
    doc.text(money(r.direct), 14 + colW + 10, curY + 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 100, 100);
    doc.text("Profit per unit: " + money(directProfit) + " (+" + directMargin + "% markup)", 14 + colW + 10, curY + 20);
    doc.text("Batch Total (" + qtyVal + " pcs): " + money(r.direct * qtyVal), 14 + colW + 10, curY + 25);
    doc.text("Batch Profit: " + money(directProfit * qtyVal), 14 + colW + 10, curY + 29.5);

    savePdf(doc, "cost-" + slug(itemName) + ".pdf");
  } catch(e) {
    console.error(e);
    notify({ type: "warn", title: "PDF Failed", message: "Couldn't build the cost sheet PDF." });
  }
}

function exportCalcXls() {
  if (!window.XLSX) { notify({ type: "warn", title: "Library Missing", message: "Excel library didn't load — check your connection." }); return; }
  try {
    const r = calcResult();
    const itemName = calc.name || "Custom 3D Print";
    const fil = calc.filamentId ? byId("filaments", calc.filamentId) : null;
    const filName = fil ? fil.name : "Custom Spool";
    const qtyVal = Math.max(1, N(calc.qty) || 1);
    const agentProfit = r.agent - r.total;
    const directProfit = r.direct - r.total;

    const data = [
      { "Parameter / Metric": "Item Name", "Value": itemName, "Unit / Notes": "" },
      { "Parameter / Metric": "Default Filament", "Value": filName, "Unit / Notes": "" },
      { "Parameter / Metric": "Filament Spool Rate", "Value": r.costKg, "Unit / Notes": cur() + "/kg" },
      { "Parameter / Metric": "Extruded Weight per Item", "Value": N(calc.grams), "Unit / Notes": "grams" },
      { "Parameter / Metric": "Print Time per Item", "Value": N(calc.minutes), "Unit / Notes": "minutes" },
      { "Parameter / Metric": "Batch Production Quantity", "Value": qtyVal, "Unit / Notes": "pieces" },
      { "Parameter / Metric": "--- COST BREAKDOWN ---", "Value": "-----------------", "Unit / Notes": "-----------------" },
      { "Parameter / Metric": "1. Filament Material Cost", "Value": r.material, "Unit / Notes": cur() },
      { "Parameter / Metric": "2. Electricity Consumption", "Value": r.power, "Unit / Notes": cur() },
      { "Parameter / Metric": "3. Machine Depreciation & Wear", "Value": r.machine, "Unit / Notes": cur() },
      { "Parameter / Metric": "4. Labor & Post-Processing", "Value": r.labor, "Unit / Notes": cur() },
      { "Parameter / Metric": "5. Packaging & Consumables", "Value": r.pack, "Unit / Notes": cur() },
      { "Parameter / Metric": "TOTAL UNIT PRODUCTION COST", "Value": r.total, "Unit / Notes": cur() + " / finished item" },
      { "Parameter / Metric": "--- COMMERCIAL PRICING ---", "Value": "-----------------", "Unit / Notes": "-----------------" },
      { "Parameter / Metric": "Wholesale / Agent Price", "Value": r.agent, "Unit / Notes": cur() + " / item" },
      { "Parameter / Metric": "Wholesale Profit per Item", "Value": agentProfit, "Unit / Notes": cur() },
      { "Parameter / Metric": "Wholesale Batch Total", "Value": r.agent * qtyVal, "Unit / Notes": cur() + " (" + qtyVal + " pcs)" },
      { "Parameter / Metric": "Wholesale Batch Profit", "Value": agentProfit * qtyVal, "Unit / Notes": cur() },
      { "Parameter / Metric": "Direct Retail Price", "Value": r.direct, "Unit / Notes": cur() + " / item" },
      { "Parameter / Metric": "Direct Retail Profit per Item", "Value": directProfit, "Unit / Notes": cur() },
      { "Parameter / Metric": "Direct Retail Batch Total", "Value": r.direct * qtyVal, "Unit / Notes": cur() + " (" + qtyVal + " pcs)" },
      { "Parameter / Metric": "Direct Retail Batch Profit", "Value": directProfit * qtyVal, "Unit / Notes": cur() }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!cols"] = [
      { wch: 34 },
      { wch: 22 },
      { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Cost Estimation");
    saveXlsx(wb, "cost-" + slug(itemName) + ".xlsx");
  } catch(e) {
    console.error(e);
    notify({ type: "warn", title: "Export Failed", message: "Couldn't build the cost sheet Excel." });
  }
}

/* ==========================================================================
   Boot & Initialization
   ========================================================================== */
try {
  let t = localStorage.getItem("ps_tab");
  if (t === "stock") {
    t = "expenses";
    try { localStorage.setItem("ps_tab", "expenses"); } catch(_) {}
  }
  if (t && ["dashboard", "calc", "products", "filaments", "prints", "orders", "enquiries", "customers", "reports", "expenses", "accounts", "settings"].includes(t)) tab = t;
} catch(_) {}

const resizeCharts = () => {
  if (chartMostInstance) chartMostInstance.resize();
  if (chartLeastInstance) chartLeastInstance.resize();
  if (chartPrintTimeInstance) chartPrintTimeInstance.resize();
  if (chartFilamentUsageInstance) chartFilamentUsageInstance.resize();
};
window.addEventListener("resize", resizeCharts);
const handleOrientationChange = () => {
  setTimeout(resizeCharts, 150);
};
window.addEventListener("orientationchange", handleOrientationChange);

async function checkNeonSync(force = false) {
  if (HOST) return;
  // If user is currently typing in an open input or a modal is displayed, defer re-rendering to prevent cursor disruptions
  const isUserTyping = !!document.querySelector(".modal-wrap, .scrim, #delModalBackdrop") ||
    (document.activeElement && ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName));

  try {
    const res = await fetch("/api/data?status=1", { cache: "no-store" });
    if (!res.ok) {
      if (neonConnected) setSyncNeon(false);
      return;
    }
    const json = await res.json();
    neonConnected = true;
    setSyncNeon("live");

    if (json.version && json.version !== lastSyncVersion) {
      lastSyncVersion = json.version;
      // Remote database has been updated! Fetch updated collections
      await loadLedgerData(!isUserTyping || force);
    }
  } catch (err) {
    setSyncNeon(false);
  }
}

const handleWindowFocus = () => checkNeonSync(false);
const handleVisibilityChange = () => { if (document.visibilityState === "visible") checkNeonSync(false); };
const handleOnline = () => checkNeonSync(true);

window.addEventListener("focus", handleWindowFocus);
document.addEventListener("visibilitychange", handleVisibilityChange);
window.addEventListener("online", handleOnline);

if (!HOST) {
  booted = true;
  store.load();

  // Strip any legacy sample records from local storage if previously saved
  COLLS.forEach(k => {
    if (Array.isArray(S[k])) {
      S[k] = S[k].filter(x => !x.example);
      store.persist(k);
    }
  });

  setSyncStandalone();
  render();

  // Initial fetch and synchronization with Neon Lakebase Postgres
  (async () => {
    try {
      setSyncNeon("syncing");
      const loaded = await loadLedgerData(true);
      if (!loaded) {
        setSyncStandalone();
        return;
      }
      // Automatic background live sync from Bambu Lab Cloud on initial page mount
      syncBambu(false);
    } catch(e) {
      console.log("Neon sync initial fetch fallback:", e);
      setSyncStandalone();
    }
  })();

  // Start background realtime sync polling every 3.5 seconds
  if (syncPollingTimer) clearInterval(syncPollingTimer);
  syncPollingTimer = setInterval(checkNeonSync, 3500);
} else {
  render();
  (async () => {
    const c = window.claude;
    [db, dl] = await Promise.all([c.use("db").catch(() => null), c.use("downloads").catch(() => null)]);
    booted = true;
    setSync(!!db);
    if (!db) { render(); return; }
    let pend = null;
    const later = () => {
      if (pend) return;
      pend = requestAnimationFrame(() => {
        pend = null;
        if (!document.querySelector(".scrim")) render(); else needsRender = true;
      });
    };
    COLLS.forEach(k => db.collection(k).onSnapshot(s => { S[k] = s.docs.map(d => Object.assign({}, d.data(), { id: d.id })); later(); }, () => setSync(false)));
    db.doc("meta/settings").onSnapshot(s => { S.settings = s.exists ? Object.assign({}, s.data()) : {}; later(); }, () => {});
  })();
}

let needsRender = false;
let observer = null;
const mRoot = $("#modalRoot");
if (mRoot) {
  observer = new MutationObserver(() => {
    if (needsRender && !document.querySelector(".scrim")) {
      needsRender = false;
      render();
    }
  });
  observer.observe(mRoot, { childList: true });
}

return function cleanup() {
  if (syncPollingTimer) clearInterval(syncPollingTimer);
  if (syncChannel) { try { syncChannel.close(); } catch(_) {} }
  window.removeEventListener("focus", handleWindowFocus);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("online", handleOnline);
  document.removeEventListener("input", handleDocInput);
  document.removeEventListener("change", handleDocChange);
  document.removeEventListener("click", handleDocClickSettings);
  document.removeEventListener("click", handleDocClickGlobal);
  document.removeEventListener("keydown", handleDocKeyDownGlobal);
  window.removeEventListener("resize", resizeCharts);
  window.removeEventListener("orientationchange", handleOrientationChange);
  if (observer) observer.disconnect();
  if (chartMostInstance) { chartMostInstance.dispose(); chartMostInstance = null; }
  if (chartLeastInstance) { chartLeastInstance.dispose(); chartLeastInstance = null; }
  if (chartPrintTimeInstance) { chartPrintTimeInstance.dispose(); chartPrintTimeInstance = null; }
  if (chartFilamentUsageInstance) { chartFilamentUsageInstance.dispose(); chartFilamentUsageInstance = null; }
};

function setSync(on) {
  const dot = $("#syncDot"), txt = $("#syncTxt");
  if (dot) dot.className = "dot " + (on ? "on" : "off");
  if (txt) txt.textContent = on ? "Saved & shared with team" : "Not saving";
}

function setSyncStandalone() {
  if (HOST) return;
  const ok = store.ok();
  const dot = $("#syncDot"), txt = $("#syncTxt");
  if (dot) dot.className = "dot " + (ok ? "on" : "off");
  if (txt) txt.textContent = ok ? "Saved in this browser" : "Not saving — changes are temporary";
}


}
