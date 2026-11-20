"use client";

import React, { createContext, useContext } from "react";

export type WorkspaceType = "business" | "production";

export type TransitionState = "idle" | "switching" | "revealing" | "completed" | "error";

export interface WorkspaceTransitionContextValue {
  isSwitching: boolean;
  targetWorkspace: WorkspaceType | null;
  transitionState: TransitionState;
  switchToWorkspace: (target: WorkspaceType, href: string) => Promise<void>;
  cancelTransition: () => void;
}

export const WorkspaceTransitionContext = createContext<WorkspaceTransitionContextValue | null>(null);

export function useWorkspaceTransition(): WorkspaceTransitionContextValue {
  const context = useContext(WorkspaceTransitionContext);
  if (!context) {
    throw new Error("useWorkspaceTransition must be used within a WorkspaceTransitionProvider");
  }
  return context;
}
