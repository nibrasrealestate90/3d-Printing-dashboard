"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Mail01Icon,
  LockIcon,
  ViewIcon,
  ViewOffSlashIcon,
  AlertCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { getSafeRedirectUrl } from "@/lib/safe-redirect";
import "@/app/admin-login.css";

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const redirectParam = searchParams ? searchParams.get("redirect") : null;

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Validation & Error State
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --------------------------------------------------------------------------
  // 1. Session Verification on Mount (GET /api/admin/auth/me)
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isMounted = true;

    async function checkExistingSession() {
      try {
        const res = await fetch("/api/admin/auth/me", {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.user) {
            const targetUrl = getSafeRedirectUrl(redirectParam);
            window.location.href = targetUrl;
            return;
          }
        }
      } catch {
        // Network failure or unauthenticated: proceed to login form
      } finally {
        if (isMounted) {
          setIsCheckingSession(false);
        }
      }
    }

    checkExistingSession();

    return () => {
      isMounted = false;
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [redirectParam]);

  // --------------------------------------------------------------------------
  // 2. Rate-Limit Countdown Timer
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (rateLimitCountdown && rateLimitCountdown > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRateLimitCountdown((prev) => {
          if (!prev || prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            setGeneralError(null);
            return null;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [rateLimitCountdown]);

  // --------------------------------------------------------------------------
  // 3. Client-Side Input Validation
  // --------------------------------------------------------------------------
  function validateInputs(): boolean {
    const errors: { email?: string; password?: string } = {};

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      errors.email = "Administrator email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!password) {
      errors.password = "Password is required.";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // --------------------------------------------------------------------------
  // 4. Form Submission (POST /api/admin/auth/login)
  // --------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setGeneralError(null);

    if (rateLimitCountdown && rateLimitCountdown > 0) {
      return;
    }

    if (!validateInputs()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      if (res.status === 200) {
        const data = await res.json();
        if (data.success && data.user) {
          setPassword("");
          const targetUrl = getSafeRedirectUrl(redirectParam);
          window.location.href = targetUrl;
          return;
        } else {
          setGeneralError("Authentication succeeded but session payload was incomplete.");
        }
      } else if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        const retryAfterSeconds = Number(data.retryAfter) || 60;
        setRateLimitCountdown(retryAfterSeconds);
        setGeneralError(
          `Security rate limit active. Too many failed attempts. Please retry in ${retryAfterSeconds} seconds.`
        );
      } else if (res.status === 401) {
        setGeneralError("Invalid email or password. Please verify your credentials and try again.");
      } else if (res.status === 503) {
        setGeneralError("Database service unavailable. Please contact the technical administrator.");
      } else {
        setGeneralError("An unexpected server error occurred during authentication. Please try again.");
      }
    } catch {
      setGeneralError("Network connection failure. Unable to reach the authentication service.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // --------------------------------------------------------------------------
  // Render: Loading Initial Session State
  // --------------------------------------------------------------------------
  if (isCheckingSession) {
    return (
      <div
        className="admin-login-card"
        style={{ minHeight: "380px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
        role="status"
        aria-live="polite"
      >
        <div className="admin-login-logo-wrap">
          <Image
            src="/logo.svg"
            alt="Print Studio Logo"
            width={38}
            height={38}
            priority
          />
        </div>
        <div
          style={{
            height: "20px",
            width: "20px",
            borderRadius: "50%",
            border: "2px solid var(--color-text-muted)",
            borderTopColor: "var(--color-focus)",
            animation: "spin 1s linear infinite",
          }}
        />
        <p style={{ marginTop: "16px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text-muted)" }}>
          Verifying security session...
        </p>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Administrator Sign-In Form
  // --------------------------------------------------------------------------
  return (
    <div
      className="admin-login-card"
      role="region"
      aria-labelledby="admin-login-heading"
    >
      {/* Brand & Emblem Header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div className="admin-login-logo-wrap">
          <Image
            src="/logo.svg"
            alt="Print Studio Logo"
            width={38}
            height={38}
            priority
          />
        </div>

        <h1 id="admin-login-heading" className="admin-login-heading">
          Administrator Sign In
        </h1>
      </div>

      {/* Global / Rate-Limit Alert Banner */}
      {generalError && (
        <div
          id="auth-error-alert"
          data-testid="auth-error-alert"
          className="admin-login-alert"
          role="alert"
          aria-live="polite"
        >
          <div style={{ color: "#EF4444", flexShrink: 0, marginTop: "2px" }}>
            <HugeIcon icon={AlertCircleIcon} size={16} strokeWidth={2} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{generalError}</p>
            {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
              <div style={{ marginTop: "6px", fontSize: "11px", fontWeight: 600, color: "#DC2626" }}>
                <span>Cooldown window: {rateLimitCountdown}s remaining</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} noValidate>
        {/* Email Input Field */}
        <div className="admin-login-form-group">
          <label htmlFor="admin-email" className="admin-login-label">
            Administrator Email
          </label>
          <div className="admin-login-input-wrap">
            <div className="admin-login-input-icon">
              <HugeIcon icon={Mail01Icon} size={18} strokeWidth={1.8} />
            </div>
            <input
              id="admin-email"
              type="email"
              name="email"
              autoComplete="email"
              spellCheck={false}
              disabled={isSubmitting}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => ({ ...prev, email: undefined }));
                }
              }}
              placeholder="admin@printstudio.ae"
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? "admin-email-error" : undefined}
              className={`admin-login-input ${fieldErrors.email ? "has-error" : ""}`}
            />
          </div>
          {fieldErrors.email && (
            <div id="admin-email-error" className="admin-login-error-msg">
              {fieldErrors.email}
            </div>
          )}
        </div>

        {/* Password Input Field */}
        <div className="admin-login-form-group">
          <label htmlFor="admin-password" className="admin-login-label">
            Master Password
          </label>
          <div className="admin-login-input-wrap">
            <div className="admin-login-input-icon">
              <HugeIcon icon={LockIcon} size={18} strokeWidth={1.8} />
            </div>
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldErrors.password) {
                  setFieldErrors((prev) => ({ ...prev, password: undefined }));
                }
              }}
              placeholder="••••••••••••"
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? "admin-password-error" : undefined}
              className={`admin-login-input ${fieldErrors.password ? "has-error" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password text" : "Show password text"}
              aria-pressed={showPassword}
              className="admin-login-toggle-btn"
            >
              <HugeIcon
                icon={showPassword ? ViewOffSlashIcon : ViewIcon}
                size={18}
                strokeWidth={1.8}
              />
            </button>
          </div>
          {fieldErrors.password && (
            <div id="admin-password-error" className="admin-login-error-msg">
              {fieldErrors.password}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
          className="admin-login-submit-btn"
        >
          {isSubmitting ? (
            <>
              <div
                style={{
                  height: "16px",
                  width: "16px",
                  borderRadius: "50%",
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  borderTopColor: "#FFFFFF",
                  animation: "spin 1s linear infinite",
                }}
              />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log In</span>
          )}
        </button>
      </form>

      {/* Security Context Footnote */}
      <div className="admin-login-footnote">
        <span>🔒 Restricted Access · All authentication events are cryptographically audited</span>
      </div>
    </div>
  );
}
