import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { MediaLibraryView } from "@/components/admin/MediaLibraryView";

export default async function MediaPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/media"
      title="Reusable Media Library"
      breadcrumbs="Business Management > Media Library"
    >
      <MediaLibraryView />
    </BusinessWorkspaceLayout>
  );
}
