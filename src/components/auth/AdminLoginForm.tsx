"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Mail01Icon,
  LockIcon,
  ViewIcon,
  ViewOffSlashIcon,
  ArrowRight01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { HugeIcon } from "@/components/hugeIcons";
import { getSafeRedirectUrl } from "@/lib/safe-redirect";
import "@/app/admin-login.css";

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams ? searchParams.get("redirect") : null;

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // Interaction State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [authenticatedUser, setAuthenticatedUser] = useState<UserProfile | null>(null);

  // Validation & Error State
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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
            Accept: "application/json",
          },
          credentials: "include",
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.user) {
            setAuthenticatedUser(data.user);
          }
        }
      } catch {
        // Network failure or unauthenticated
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
  }, []);

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
          Accept: "application/json",
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
          setAuthenticatedUser(data.user);
          setPassword("");
          const targetUrl = getSafeRedirectUrl(redirectParam);
          router.push(targetUrl);
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
  // 5. Logout Action (POST /api/admin/auth/logout)
  // --------------------------------------------------------------------------
  async function handleLogout() {
    setIsLoggingOut(true);
    setGeneralError(null);

    try {
      const res = await fetch("/api/admin/auth/logout", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });

      if (res.ok) {
        setAuthenticatedUser(null);
        setEmail("");
        setPassword("");
      } else {
        setGeneralError("Logout failed on server. Please refresh and try again.");
      }
    } catch {
      setGeneralError("Network error while communicating logout to server.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  // --------------------------------------------------------------------------
  // Render: Loading Initial Session State
  // --------------------------------------------------------------------------
  if (isCheckingSession) {
    return (
      <div className="admin-login-split-card" role="status" aria-live="polite">
        <div className="admin-login-illustration-pane">
          <Image
            src="/login-printer-art.png"
            alt="3D Printing Studio"
            width={340}
            height={430}
            priority
            className="admin-login-illustration-img"
          />
        </div>
        <div className="admin-login-form-pane">
          <div className="admin-login-logo-badge">
            <Image
              src="/logo-print-studio-ledger.svg"
              alt="Print Studio Ledger"
              width={88}
              height={88}
              priority
              className="admin-login-logo-svg"
            />
          </div>
          <div
            style={{
              height: "24px",
              width: "24px",
              borderRadius: "50%",
              border: "2px solid rgba(255, 255, 255, 0.3)",
              borderTopColor: "#80D9D5",
              animation: "spin 1s linear infinite",
              margin: "20px 0",
            }}
          />
          <p
            style={{
              fontSize: "12px",
              fontWeight: 500,
              letterSpacing: "0.04em",
              color: "rgba(255, 255, 255, 0.7)",
            }}
          >
            Verifying security session...
          </p>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Authenticated Session View
  // --------------------------------------------------------------------------
  if (authenticatedUser) {
    return (
      <div
        className="admin-login-split-card"
        role="region"
        aria-label="Active Administrator Session"
      >
        <div className="admin-login-illustration-pane">
          <Image
            src="/login-printer-art.png"
            alt="3D Printing Studio"
            width={340}
            height={430}
            priority
            className="admin-login-illustration-img"
          />
        </div>
        <div className="admin-login-form-pane">
          <div className="admin-login-logo-badge">
            <Image
              src="/logo-print-studio-ledger.svg"
              alt="Print Studio Ledger"
              width={88}
              height={88}
              priority
              className="admin-login-logo-svg"
            />
          </div>

          <div className="admin-session-box">
            <div className="admin-session-verified-badge">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "rgba(128, 217, 213, 0.2)",
                  color: "#80D9D5",
                  flexShrink: 0,
                }}
              >
                <HugeIcon icon={CheckmarkCircle02Icon} size={16} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "13px", fontWeight: 600, color: "#FFFFFF", margin: 0 }}>
                  Active Session Verified
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    color: "rgba(255, 255, 255, 0.75)",
                    wordBreak: "break-all",
                    margin: "2px 0 0 0",
                  }}
                >
                  {authenticatedUser.email}
                </p>
              </div>
              <span className="admin-session-role-pill">{authenticatedUser.role}</span>
            </div>

            {generalError && (
              <div
                id="auth-session-error-alert"
                data-testid="auth-session-error-alert"
                className="admin-login-alert"
                role="alert"
              >
                <HugeIcon icon={AlertCircleIcon} size={16} strokeWidth={2} />
                <p style={{ margin: 0 }}>{generalError}</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => router.push(getSafeRedirectUrl(redirectParam))}
              className="admin-login-primary-btn"
              style={{ marginTop: "8px" }}
            >
              <span>Open Dashboard</span>
              <HugeIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="admin-session-outline-btn"
            >
              {isLoggingOut ? "Signing out..." : "Sign Out of Console"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Render: Minimal Split Sign-In Form (Matching Design System Exactly)
  // --------------------------------------------------------------------------
  return (
    <div
      className="admin-login-split-card"
      role="region"
      aria-label="Administrator Sign In"
    >
      {/* Left 50% Pane: 3D Printer Illustration Artwork */}
      <div className="admin-login-illustration-pane">
        <Image
          src="/login-printer-art.png"
          alt="3D Printing Studio"
          width={340}
          height={430}
          priority
          className="admin-login-illustration-img"
        />
      </div>

      {/* Right 50% Pane: Dark Forest Teal Minimal Login Form */}
      <div className="admin-login-form-pane">
        {/* Distinctive Circular Vector Brand Badge */}
        <div className="admin-login-logo-badge">
          <Image
            src="/logo-print-studio-ledger.svg"
            alt="3D Print Studio Ledger"
            width={88}
            height={88}
            priority
            className="admin-login-logo-svg"
          />
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
            <div style={{ color: "#FCA5A5", flexShrink: 0, marginTop: "1px" }}>
              <HugeIcon icon={AlertCircleIcon} size={16} strokeWidth={2} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 500 }}>{generalError}</p>
              {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
                <div style={{ marginTop: "4px", fontSize: "11px", fontWeight: 600, color: "#FCA5A5" }}>
                  <span>Cooldown window: {rateLimitCountdown}s remaining</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} noValidate className="admin-login-form-inner">
          {/* Email Address Input */}
          <div className="admin-login-group">
            <div className={`admin-login-input-box ${fieldErrors.email ? "has-error" : ""}`}>
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
                placeholder="Email address"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "admin-email-error" : undefined}
                className="admin-login-text-input"
              />
            </div>
            {fieldErrors.email && (
              <div id="admin-email-error" className="admin-login-error-msg">
                {fieldErrors.email}
              </div>
            )}
          </div>

          {/* Password Input */}
          <div className="admin-login-group">
            <div className={`admin-login-input-box ${fieldErrors.password ? "has-error" : ""}`}>
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
                placeholder="Password"
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? "admin-password-error" : undefined}
                className="admin-login-text-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password text" : "Show password text"}
                aria-pressed={showPassword}
                className="admin-login-eye-btn"
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

          {/* "Keep me logged in" Checkbox Option */}
          <div className="admin-login-options-row">
            <input
              type="checkbox"
              id="keepLoggedIn"
              checked={keepLoggedIn}
              onChange={(e) => setKeepLoggedIn(e.target.checked)}
              className="admin-login-checkbox"
            />
            <label htmlFor="keepLoggedIn" className="admin-login-checkbox-label">
              Keep me logged in
            </label>
          </div>

          {/* Submit Action Button ("Log in") */}
          <button
            type="submit"
            disabled={isSubmitting || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
            className="admin-login-primary-btn"
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
                <span>Signing in...</span>
              </>
            ) : (
              <span>Log in</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
