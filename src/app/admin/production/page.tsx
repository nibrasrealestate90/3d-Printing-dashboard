"use client";

import React from "react";
import dynamic from "next/dynamic";

const PrintStudioLedger = dynamic(
  () => import("@/components/PrintStudioLedger"),
  { ssr: false }
);

export default function BambuProductionPage() {
  return <PrintStudioLedger />;
}
