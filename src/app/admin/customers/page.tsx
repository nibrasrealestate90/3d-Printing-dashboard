import React from "react";
import { UserMultiple02Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function CustomersPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/customers"
      title="Customer Directory"
      subtitle="Client Profiles & Contacts"
      icon={UserMultiple02Icon}
      iconBgColor="var(--bm-pastel-neutral)"
      description="Maintain a directory of corporate clients, engineering firms, and retail buyers with order history and preferred material specifications."
      capabilities={[
        "Client contact details, delivery addresses, and TRN tax registration numbers",
        "Lifetime order value, print volume history, and payment terms",
        "Customer-specific discounts and preferred filament profiles",
        "Activity audit logs for customer data modifications",
      ]}
    />
  );
}
