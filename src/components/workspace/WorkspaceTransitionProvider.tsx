"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  WorkspaceType,
  TransitionState,
  WorkspaceTransitionContext,
} from "./WorkspaceTransitionContext";
import { WorkspaceTransition } from "./WorkspaceTransition";

interface WorkspaceTransitionProviderProps {
  children: React.ReactNode;
}

export function WorkspaceTransitionProvider({ children }: WorkspaceTransitionProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [transitionState, setTransitionState] = useState<TransitionState>("idle");
  const [targetWorkspace, setTargetWorkspace] = useState<WorkspaceType | null>(null);
  const [targetUrl, setTargetUrl] = useState<string | null>(null);

  const startTimeRef = useRef<number>(0);
  const revealTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear all timers safely
  const clearAllTimers = useCallback(() => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    revealTimerRef.current = null;
    exitTimerRef.current = null;
    safetyTimerRef.current = null;
  }, []);

  const cancelTransition = useCallback(() => {
    clearAllTimers();
    setTransitionState("idle");
    setTargetWorkspace(null);
    setTargetUrl(null);
  }, [clearAllTimers]);

  const switchToWorkspace = useCallback(
    async (target: WorkspaceType, href: string) => {
      // Prevent repeated clicks while already switching
      if (transitionState !== "idle") {
        return;
      }

      // If already at target destination, no-op
      if (pathname === href) {
        return;
      }

      clearAllTimers();
      startTimeRef.current = performance.now();
      setTargetWorkspace(target);
      setTargetUrl(href);
      setTransitionState("switching");

      // 5-second safety fallback: prevent user from ever getting stuck
      safetyTimerRef.current = setTimeout(() => {
        console.warn("[WorkspaceTransition] Navigation safety timeout reached. Recovering...");
        cancelTransition();
      }, 5000);

      try {
        // Trigger Next.js client-side navigation
        router.push(href);
      } catch (err) {
        console.error("[WorkspaceTransition] Navigation failed:", err);
        setTransitionState("error");
        setTimeout(cancelTransition, 800);
      }
    },
    [transitionState, pathname, clearAllTimers, cancelTransition, router]
  );

  // Detect when Next.js route has transitioned to destination
  useEffect(() => {
    if (transitionState === "switching" && targetUrl) {
      const isBusinessTarget =
        targetUrl === "/admin" ||
        (targetUrl.startsWith("/admin") && targetUrl !== "/admin/production");

      const isProductionTarget =
        targetUrl === "/admin/production" || targetUrl === "/";

      const reachedDestination =
        (isBusinessTarget && pathname.startsWith("/admin") && pathname !== "/admin/production") ||
        (isProductionTarget && (pathname === "/admin/production" || pathname === "/")) ||
        pathname === targetUrl;

      if (reachedDestination) {
        const elapsed = performance.now() - startTimeRef.current;
        // Controlled minimum duration to allow entrance & orbital animation to be perceptible (650ms)
        const minDuration = 650;
        const delay = Math.max(0, minDuration - elapsed);

        revealTimerRef.current = setTimeout(() => {
          setTransitionState("revealing");

          // Loader exit duration (300ms) matches prompt specifications
          exitTimerRef.current = setTimeout(() => {
            setTransitionState("completed");
            clearAllTimers();

            // Reset back to idle on subsequent frame
            setTimeout(() => {
              setTransitionState("idle");
              setTargetWorkspace(null);
              setTargetUrl(null);
            }, 50);
          }, 300);
        }, delay);
      }
    }
  }, [pathname, transitionState, targetUrl, clearAllTimers]);

  // Clean up on component unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const isSwitching = transitionState !== "idle";
  const isRevealing = transitionState === "revealing";

  return (
    <WorkspaceTransitionContext.Provider
      value={{
        isSwitching,
        targetWorkspace,
        transitionState,
        switchToWorkspace,
        cancelTransition,
      }}
    >
      {/* Workspace Content with Subtle Smooth Reveal */}
      <div
        className={`workspace-page-wrapper ${isRevealing ? "workspace-content-reveal" : ""}`}
        key={pathname}
      >
        {children}
      </div>

      {/* Full-screen Centered Transition Overlay */}
      <WorkspaceTransition state={transitionState} targetWorkspace={targetWorkspace} />
    </WorkspaceTransitionContext.Provider>
  );
}
