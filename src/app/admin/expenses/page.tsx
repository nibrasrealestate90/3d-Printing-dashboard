import React from "react";
import { CreditCardIcon } from "@hugeicons/core-free-icons";
import { verifyServerSession } from "@/lib/server-auth";
import { ModulePlaceholderView } from "@/components/admin/ModulePlaceholderView";

export default async function ExpensesPage() {
  const auth = await verifyServerSession();

  return (
    <ModulePlaceholderView
      user={auth.user}
      currentPath="/admin/expenses"
      title="Business Expenses"
      subtitle="Operational Overhead & Capex"
      icon={CreditCardIcon}
      iconBgColor="var(--bm-pastel-coral)"
      description="Track studio overhead including printer maintenance, replacement nozzles, build plates, packaging, studio rent, and electricity."
      capabilities={[
        "Expense categorisation: Consumables, Maintenance, Utilities, Facilities",
        "VAT tax logging and receipt attachment storage",
        "Direct incorporation into net margin calculation engine",
        "Monthly burn rate and cash flow telemetry",
      ]}
    />
  );
}
