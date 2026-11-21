"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Logout01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";

export interface LogoutConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  isLoggingOut?: boolean;
}

export function LogoutConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoggingOut = false,
}: LogoutConfirmationModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle ESC key and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isLoggingOut) {
        onClose();
      }
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, isLoggingOut, onClose]);

  if (!mounted || !isOpen) return null;

  const content = (
    <div
      className="logout-modal-scrim"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoggingOut) {
          onClose();
        }
      }}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(6, 44, 47, 0.48)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 99999,
        animation: "logoutFadeIn 0.18s ease-out forwards",
      }}
    >
      <div
        className="logout-modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-desc"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "430px",
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(6, 44, 47, 0.14)",
          borderRadius: "24px",
          padding: "28px 26px 24px 26px",
          boxShadow: "0 24px 64px -12px rgba(6, 44, 47, 0.35), 0 4px 16px rgba(0, 0, 0, 0.06)",
          boxSizing: "border-box",
          animation: "logoutScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          color: "#062C2F",
          fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isLoggingOut}
          aria-label="Close dialog"
          className="logout-modal-close-btn"
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            border: "none",
            background: "transparent",
            color: "var(--color-text-muted, var(--bm-text-muted, #729693))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: isLoggingOut ? "not-allowed" : "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <HugeIcon icon={Cancel01Icon} size={16} strokeWidth={2} />
        </button>

        {/* Header: Icon & Warning Text */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
          <div
            className="logout-modal-icon-badge"
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "14px",
              background: "rgba(244, 63, 94, 0.12)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              color: "#F43F5E",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <HugeIcon icon={Logout01Icon} size={22} strokeWidth={2} />
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: "2px" }}>
            <h3
              id="logout-dialog-title"
              style={{
                fontSize: "17px",
                fontWeight: 700,
                color: "var(--color-text-primary, var(--bm-text-primary, #062C2F))",
                margin: "0 0 4px 0",
                letterSpacing: "-0.01em",
              }}
            >
              Sign Out of Session
            </h3>
            <p
              id="logout-dialog-desc"
              style={{
                fontSize: "13px",
                color: "var(--color-text-secondary, var(--bm-text-secondary, #397F7C))",
                margin: 0,
                lineHeight: 1.45,
              }}
            >
              Are you sure you want to log out? Any unsaved changes in your current workspace will be discarded.
            </p>
          </div>
        </div>

        {/* Security Note Box */}
        <div
          className="logout-modal-note-box"
          style={{
            background: "#F4F8F8",
            border: "1px solid rgba(6, 44, 47, 0.1)",
            borderRadius: "12px",
            padding: "10px 14px",
            marginBottom: "20px",
            fontSize: "12px",
            color: "#5B7C79",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "14px" }}>🔒</span>
          <span>Authentication tokens will be revoked on the server.</span>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isLoggingOut}
            className="logout-modal-cancel-btn"
            id="logoutModalCancelBtn"
            style={{
              padding: "9px 18px",
              borderRadius: "9999px",
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--color-text-primary, var(--bm-text-primary, #062C2F))",
              background: "var(--color-surface, var(--bm-surface, #EFF9F9))",
              border: "1px solid var(--color-border, var(--bm-border, #C4D9D7))",
              cursor: isLoggingOut ? "not-allowed" : "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => onConfirm()}
            disabled={isLoggingOut}
            className="logout-modal-confirm-btn"
            id="logoutModalConfirmBtn"
            style={{
              padding: "9px 20px",
              borderRadius: "9999px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#FFFFFF",
              background: "linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)",
              border: "1px solid #E11D48",
              cursor: isLoggingOut ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              boxShadow: "0 4px 14px rgba(244, 63, 94, 0.35)",
              transition: "all 0.15s ease",
            }}
          >
            <HugeIcon icon={Logout01Icon} size={15} strokeWidth={2} />
            <span>{isLoggingOut ? "Signing out..." : "Log Out"}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
