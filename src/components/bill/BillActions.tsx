"use client";

import { Button } from "@/components/ui/Button";

// Both buttons trigger the same browser print dialog — there is no
// separate PDF-generation step or library. "Save as PDF" is just
// "Print" with the hint to choose that destination in the dialog; see
// PROJECT_PROGRESS.md for why this was preferred over introducing a PDF
// library (requirement B: avoid unnecessary paid PDF services, and
// justify any library actually introduced — none was).
export function BillActions({ backHref, backLabel }: { backHref: string; backLabel: string }) {
  return (
    <div className="no-print mx-auto flex max-w-2xl items-center justify-between gap-3 pb-4">
      <a href={backHref} className="text-sm text-muted-foreground hover:text-primary">
        &larr; {backLabel}
      </a>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          Print Bill
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          title="In the print dialog, choose &quot;Save as PDF&quot; as the destination."
        >
          Save as PDF
        </Button>
      </div>
    </div>
  );
}
