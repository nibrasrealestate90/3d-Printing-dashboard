"use client";

import React from "react";
import Image from "next/image";
import { TransitionState, WorkspaceType } from "./WorkspaceTransitionContext";

export interface WorkspaceTransitionProps {
  state: TransitionState;
  targetWorkspace: WorkspaceType | null;
}

/**
 * Premium Workspace Switching Transition Overlay
 *
 * Sequence:
 * 1. Dims and blurs background (250ms).
 * 2. Center-screen orbital animation and emblem entrance (400ms).
 * 3. Continuous orbital transformation with luminous particles.
 * 4. Contextual messaging for destination workspace.
 * 5. Smooth exit reveal when destination is ready (300ms).
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

      {/* Centered Transformation Card */}
      <div className="wt-center-box">
        {/* Visual Orb Animation Container */}
        <div className="wt-visual-stage">
          {/* Ambient Glow */}
          <div className="wt-ambient-glow" />

          {/* Expanding Energy Pulse Ring */}
          <div className="wt-ring-pulse" />

          {/* Outer Orbital Ring + Particle */}
          <div className="wt-ring-outer">
            <span className="wt-particle-outer" />
          </div>

          {/* Inner Orbital Ring + Particle */}
          <div className="wt-ring-inner">
            <span className="wt-particle-inner" />
          </div>

          {/* Center Brand Emblem */}
          <div className="wt-emblem-badge">
            <div className="wt-emblem-inner">
              <Image
                src="/logo.svg"
                alt="3D Studio"
                width={40}
                height={40}
                className="wt-emblem-logo"
                priority
              />
            </div>
          </div>
        </div>

        {/* Dynamic Contextual Typography */}
        <div className="wt-text-container">
          <h2 className="wt-title">Switching Workspace</h2>
          <p className="wt-subtitle">{subtitleText}</p>
        </div>

        {/* Luminous Activity Shimmer */}
        <div className="wt-shimmer-track">
          <div className="wt-shimmer-glow" />
        </div>
      </div>
    </div>
  );
}
