"use client";

import dynamic from "next/dynamic";

const PrintStudioLedger = dynamic(
  () => import("@/components/PrintStudioLedger"),
  { ssr: false }
);

export default function Home() {
  return <PrintStudioLedger />;
}
