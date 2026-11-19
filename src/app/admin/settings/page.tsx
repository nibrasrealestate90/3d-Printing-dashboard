import React from "react";
import { Settings01Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function SettingsPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/settings"
      title="Commercial Settings"
      subtitle="Studio Profile & Preferences"
      icon={Settings01Icon}
      iconBgColor="var(--bm-pastel-lavender)"
      description="Configure commercial studio preferences including currency display (AED), tax rates, default labor rates, notification emails, and team access roles."
      capabilities={[
        "Dubai studio address, commercial license number, and tax registration (TRN)",
        "Default currency formatting (AED) and VAT percentage configuration (5%)",
        "Role-based access control (ADMIN, STUDIO_OPERATOR, VIEWER)",
        "Bambu Cloud API connection status and sync telemetry preferences",
      ]}
    />
  );
}
