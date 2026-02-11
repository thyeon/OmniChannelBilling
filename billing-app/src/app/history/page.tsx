"use client";

import { InvoiceHistoryPanel } from "@/components/invoice-history";

export default function HistoryPage(): React.ReactElement {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-foreground mb-6">
        Invoice History
      </h1>
      <InvoiceHistoryPanel />
    </div>
  );
}
