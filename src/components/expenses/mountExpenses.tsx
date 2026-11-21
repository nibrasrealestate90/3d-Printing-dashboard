"use client";

import React from "react";
import { createRoot, Root } from "react-dom/client";
import { ExpenseManagementView } from "./ExpenseManagementView";

let currentRoot: Root | null = null;
let currentContainer: HTMLElement | null = null;

export function mountExpenses(container: HTMLElement) {
  if (!container) return;

  if (currentRoot && currentContainer !== container) {
    try {
      currentRoot.unmount();
    } catch (_) {}
    currentRoot = null;
    currentContainer = null;
  }

  if (!currentRoot) {
    currentRoot = createRoot(container);
    currentContainer = container;
  }

  currentRoot.render(<ExpenseManagementView />);
}

export function unmountExpenses() {
  if (currentRoot) {
    try {
      currentRoot.unmount();
    } catch (_) {}
    currentRoot = null;
    currentContainer = null;
  }
}
