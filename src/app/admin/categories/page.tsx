import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { CategoryManagementView } from "@/components/admin/CategoryManagementView";

export default async function CategoriesPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/categories"
      title="Categories"
      breadcrumbs="Core Operations"
    >
      <CategoryManagementView />
    </BusinessWorkspaceLayout>
  );
}
