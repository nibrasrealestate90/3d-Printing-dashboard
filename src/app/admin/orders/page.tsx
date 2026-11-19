import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { OrderManagementView } from "@/components/admin/OrderManagementView";

export default async function OrdersPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/orders"
      title="Orders"
      breadcrumbs="Core Operations"
    >
      <OrderManagementView />
    </BusinessWorkspaceLayout>
  );
}
