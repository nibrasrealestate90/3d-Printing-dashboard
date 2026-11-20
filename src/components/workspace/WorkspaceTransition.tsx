"use client";

import React from "react";
import Image from "next/image";
import { TransitionState, WorkspaceType } from "./WorkspaceTransitionContext";

export interface WorkspaceTransitionProps {
  state: TransitionState;
  targetWorkspace: WorkspaceType | null;
}

/**
 * Clean Vector-Style Workspace Switching Transition Overlay
 *
 * Minimalist, purposeful SaaS loader:
 * - Frosted backdrop dim & blur (250ms)
 * - Clean SVG vector spinner ring around the central brand logo
 * - Contextual workspace status typography
 * - Smooth exit reveal (300ms)
 */
export function WorkspaceTransition({ state, targetWorkspace }: WorkspaceTransitionProps) {
  if (state === "idle" || !targetWorkspace) {
    return null;
  }

  const isBusiness = targetWorkspace === "business";
  const statusLabel = isBusiness
    ? "Switching to Business Management workspace"
    : "Switching to Manufacturing workspace";

  const subtitleText = isBusiness
    ? "Preparing your business management workspace..."
    : "Preparing your manufacturing workspace...";

  const isExiting = state === "revealing" || state === "completed";

  return (
    <div
      className={`wt-overlay ${isExiting ? "wt-overlay-exit" : "wt-overlay-enter"}`}
      data-target={targetWorkspace}
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
      tabIndex={-1}
    >
      {/* Background Dim & Blur Backdrop */}
      <div className="wt-backdrop" />

      {/* Centered Minimalist Transformation Card */}
      <div className="wt-center-box">
        {/* Simple Vector Animated Logo */}
        <div className="wt-vector-loader-wrap">
          {/* Circular SVG Vector Spinner */}
          <svg
            className="wt-vector-spinner"
            viewBox="0 0 80 80"
            width="80"
            height="80"
            aria-hidden="true"
          >
            {/* Background Track */}
            <circle
              className="wt-spinner-track"
              cx="40"
              cy="40"
              r="35"
              fill="none"
              strokeWidth="2.5"
            />
            {/* Rotating Vector Arc */}
            <circle
              className="wt-spinner-arc"
              cx="40"
              cy="40"
              r="35"
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>

          {/* Central Logo Badge */}
          <div className="wt-logo-core">
            <Image
              src="/logo.svg"
              alt="3D Studio"
              width={38}
              height={38}
              className="wt-logo-img"
              priority
            />
          </div>
        </div>

        {/* Dynamic Contextual Typography */}
        <div className="wt-text-container">
          <h2 className="wt-title">Switching Workspace</h2>
          <p className="wt-subtitle">{subtitleText}</p>
        </div>
      </div>
    </div>
  );
}
