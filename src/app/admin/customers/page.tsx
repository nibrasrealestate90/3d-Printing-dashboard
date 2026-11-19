import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { CustomerManagementView } from "@/components/admin/CustomerManagementView";

export default async function CustomersPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/customers"
      title="Customers"
      breadcrumbs="Sales & Clients"
    >
      <CustomerManagementView />
    </BusinessWorkspaceLayout>
  );
}
