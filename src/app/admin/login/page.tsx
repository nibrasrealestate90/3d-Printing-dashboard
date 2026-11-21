import { Suspense } from "react";
import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/auth/AdminLoginForm";
import "@/app/admin-login.css";

export const metadata: Metadata = {
  title: "Administrator Sign In — Print Studio Ledger",
  description: "Secure administrator sign in for Dubai Print Studio management and manufacturing console.",
};

export default function AdminLoginPage() {
  return (
    <main className="admin-login-page">
      <Suspense fallback={<div className="admin-login-split-card" style={{ minHeight: "520px" }} />}>
        <AdminLoginForm />
      </Suspense>
    </main>
  );
}
