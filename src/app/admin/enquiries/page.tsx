import React from "react";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function EnquiriesPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/enquiries"
      title="Customer Enquiries"
      subtitle="Public Inquiries Inbox"
      icon={Mail01Icon}
      iconBgColor="var(--bm-pastel-pink)"
      description="Manage general inquiries and bulk manufacturing requests submitted by prospective customers through the public storefront."
      capabilities={[
        "Real-time storefront enquiry triage and response management",
        "Direct conversion from enquiry to quotation request",
        "Customer message threads and communication timeline",
        "Spam prevention and IP rate-limiting telemetry",
      ]}
    />
  );
}
