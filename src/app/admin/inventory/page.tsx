import React from "react";
import { Layers01Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function InventoryPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/inventory"
      title="Commercial Inventory"
      subtitle="Stock & Finished Goods"
      icon={Layers01Icon}
      iconBgColor="var(--bm-pastel-lavender)"
      description="Monitor finished printed parts, packaging materials, and ready-to-ship stock levels alongside raw filament spools."
      capabilities={[
        "Finished goods SKU tracking with low-stock threshold alerts",
        "Warehouse storage location tagging and batch serial numbers",
        "Automated stock reduction upon order fulfillment",
        "Multi-material production inventory reconciliation",
      ]}
    />
  );
}
