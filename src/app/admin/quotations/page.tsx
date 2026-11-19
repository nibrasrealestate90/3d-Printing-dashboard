import React from "react";
import { Calculator01Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function QuotationsPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/quotations"
      title="Quotations (RFQ)"
      subtitle="CAD & 3D Print Cost Estimator"
      icon={Calculator01Icon}
      iconBgColor="var(--bm-pastel-coral)"
      description="Process customer 3D model uploads (STEP, STL, 3MF), evaluate material volumes, slicer toolpaths, machine hourly rates, and generate formal quotations."
      capabilities={[
        "Cloudflare R2 CAD asset viewer with 3D mesh boundary calculation",
        "Automated filament gram weight and electricity consumption estimation",
        "Dynamic profit margin algorithms with quantity discount curves",
        "One-click customer quotation email delivery with PDF export",
      ]}
    />
  );
}
