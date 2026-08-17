"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import type { BreakdownDatum } from "@/lib/breakdown";

export function CategoryBreakdownSheet({
  data,
  currency,
  open,
  onOpenChange,
}: {
  data: BreakdownDatum[];
  currency?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>All categories</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <BreakdownChart data={data} currency={currency} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
