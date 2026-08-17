"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { PeriodDatePicker } from "@/components/period-date-picker";
import { CustomRangePicker } from "@/components/custom-range-picker";
import { PERIOD_LABEL_MIN_WIDTH_SM } from "@/components/period-toggle";
import { cn } from "@/lib/utils";
import { anchorParam, periodLabel, shiftAnchor, type DateRange, type Period } from "@/lib/period";

// The comparison period is always the same *type* as the primary one
// (week vs. week, month vs. month, custom range vs. custom range) --
// `period` here is the primary's own mode, just reused to lock the
// compare side to match. Which specific instance is fully pickable via
// the same prev/next/jump UI as the primary picker, defaulting to the
// immediately-preceding one the moment Compare switches on.
export function CompareToggle({
  compareOn,
  period,
  compareAnchor,
  compareRange,
  className,
}: {
  compareOn: boolean;
  period: Period | "custom";
  compareAnchor: Date;
  compareRange: DateRange | null;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    mutate(params);
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggle() {
    updateParams((params) => {
      if (compareOn) {
        params.delete("compare");
        params.delete("compareAnchor");
        params.delete("compareStart");
        params.delete("compareEnd");
      } else {
        params.set("compare", "on");
      }
    });
  }

  function navigateCompareAnchor(anchor: Date) {
    updateParams((params) => params.set("compareAnchor", anchorParam(anchor)));
  }

  function navigateCompareRange(range: DateRange) {
    updateParams((params) => {
      params.set("compareStart", range.start);
      params.set("compareEnd", range.end);
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <button
        type="button"
        onClick={toggle}
        title="Compare to another period"
        className={cn(
          "flex h-8 items-center gap-1.5 rounded-lg border border-input px-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-muted sm:px-2.5",
          compareOn && "border-primary/30 bg-primary/10 text-primary hover:bg-primary/15",
        )}
      >
        <ArrowLeftRight className="size-3.5" />
        <span className="hidden sm:inline">Compare</span>
      </button>
      {compareOn && period !== "custom" && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigateCompareAnchor(shiftAnchor(period, compareAnchor, -1))}
            className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            title="Earlier"
          >
            <ChevronLeft className="size-4" />
          </button>
          <PeriodDatePicker
            period={period}
            anchor={compareAnchor}
            onSelect={navigateCompareAnchor}
            title="Choose a comparison period"
            className={cn(
              "rounded-lg px-2 py-1 text-center text-sm font-medium text-primary transition-colors hover:bg-primary/10",
              PERIOD_LABEL_MIN_WIDTH_SM[period],
            )}
          >
            {periodLabel(period, compareAnchor)}
          </PeriodDatePicker>
          <button
            type="button"
            onClick={() => navigateCompareAnchor(shiftAnchor(period, compareAnchor, 1))}
            className="hidden size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            title="Later"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
      {compareOn && period === "custom" && compareRange && (
        <CustomRangePicker
          range={compareRange}
          onSelect={navigateCompareRange}
          title="Choose a comparison range"
          className="rounded-lg px-2 py-1 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
        />
      )}
    </div>
  );
}
