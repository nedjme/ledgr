"use client";

import { useState } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { CategoryBreakdownSheet } from "@/components/category-breakdown-sheet";
import type { BreakdownDatum } from "@/lib/breakdown";

export function CategorySpendCard({
  title = "Spend by category",
  compact,
  full,
  currency,
}: {
  title?: string;
  compact: BreakdownDatum[];
  full: BreakdownDatum[];
  currency?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasMore = full.length > compact.length || compact.some((r) => r.id === null);

  return (
    <Card className="[--card-spacing:--spacing(4)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {hasMore && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setSheetOpen(true)}>
              View all
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <BreakdownChart
          data={compact}
          currency={currency}
          onOtherClick={() => setSheetOpen(true)}
        />
      </CardContent>
      <CategoryBreakdownSheet
        data={full}
        currency={currency}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </Card>
  );
}
