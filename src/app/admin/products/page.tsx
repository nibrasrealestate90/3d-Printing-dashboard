import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { ProductManagementView } from "@/components/admin/ProductManagementView";

export default async function ProductsPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/products"
      title="Commercial Products"
      breadcrumbs="Business Management > Products"
    >
      <ProductManagementView />
    </BusinessWorkspaceLayout>
  );
}
