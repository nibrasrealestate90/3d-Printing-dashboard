import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { EnquiryManagementView } from "@/components/admin/EnquiryManagementView";

export default async function EnquiriesPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/enquiries"
      title="Enquiries"
      breadcrumbs="Sales & Pipeline"
    >
      <EnquiryManagementView />
    </BusinessWorkspaceLayout>
  );
}
