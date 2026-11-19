import React from "react";
import { verifyServerSession } from "@/lib/server-auth";
import { BusinessWorkspaceLayout } from "@/components/admin/BusinessWorkspaceLayout";
import { InstagramGalleryView } from "@/components/admin/InstagramGalleryView";

export default async function InstagramPage() {
  const auth = await verifyServerSession();

  return (
    <BusinessWorkspaceLayout
      user={auth.user}
      currentPath="/admin/instagram"
      title="Instagram Showcase Gallery"
      breadcrumbs="Business Management > Instagram"
    >
      <InstagramGalleryView />
    </BusinessWorkspaceLayout>
  );
}
