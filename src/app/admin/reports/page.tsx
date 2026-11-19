import React from "react";
import { Analytics01Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function ReportsPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/reports"
      title="Financial and Production Reports"
      subtitle="Analytics & Business Intelligence"
      icon={Analytics01Icon}
      iconBgColor="var(--bm-pastel-mint)"
      description="Comprehensive analytics combining real-time printer telemetry from Bambu Cloud with commercial sales, material yields, and profit margins."
      capabilities={[
        "Gross and net profit calculations by product category and client",
        "Printer utilization rates, failure ratios, and maintenance downtime",
        "Filament gram consumption trends vs purchased spool inventory",
        "Quarterly financial summaries with Excel and CSV export",
      ]}
    />
  );
}
