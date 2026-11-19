import React from "react";
import { Invoice01Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function OrdersPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/orders"
      title="Commercial Orders"
      subtitle="Order Management & Fulfillment"
      icon={Invoice01Icon}
      iconBgColor="var(--bm-pastel-mint)"
      description="Track client sales, manufacturing fulfillment stages, invoice creation, and payment collection status across all active print contracts."
      capabilities={[
        "Order lifecycle tracking: Pending, In-Production, Completed, Delivered",
        "Integration with Bambu print queue for automated fulfillment progress",
        "Commercial tax invoice generation and payment receipts",
        "Direct export to PDF and accounting spreadsheets",
      ]}
    />
  );
}
