"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subQuarters,
  subWeeks,
  subYears,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dateRangeLabel, type DateRange } from "@/lib/period";

const WEEKDAY_LABELS = eachDayOfInterval({
  start: startOfWeek(new Date()),
  end: endOfWeek(new Date()),
}).map((d) => format(d, "EEEEE"));

type PresetGroup = { label: string; range: () => { start: Date; end: Date } }[];

// Grouped to match the reference: "this ___" spans, then "last ___" spans,
// then rolling day windows. "All time" is deliberately left out -- it's
// already its own top-level tab next to Custom, so repeating it here would
// just be a second way to reach the same state.
const PRESET_GROUPS: PresetGroup[] = [
  [
    { label: "This week", range: () => ({ start: startOfWeek(new Date()), end: endOfWeek(new Date()) }) },
    { label: "This month", range: () => ({ start: startOfMonth(new Date()), end: endOfMonth(new Date()) }) },
    {
      label: "This quarter",
      range: () => ({ start: startOfQuarter(new Date()), end: endOfQuarter(new Date()) }),
    },
    { label: "This year", range: () => ({ start: startOfYear(new Date()), end: endOfYear(new Date()) }) },
  ],
  [
    {
      label: "Last week",
      range: () => {
        const d = subWeeks(new Date(), 1);
        return { start: startOfWeek(d), end: endOfWeek(d) };
      },
    },
    {
      label: "Last month",
      range: () => {
        const d = subMonths(new Date(), 1);
        return { start: startOfMonth(d), end: endOfMonth(d) };
      },
    },
    {
      label: "Last quarter",
      range: () => {
        const d = subQuarters(new Date(), 1);
        return { start: startOfQuarter(d), end: endOfQuarter(d) };
      },
    },
    {
      label: "Last year",
      range: () => {
        const d = subYears(new Date(), 1);
        return { start: startOfYear(d), end: endOfYear(d) };
      },
    },
  ],
  [
    { label: "Last 30 days", range: () => ({ start: subDays(new Date(), 29), end: new Date() }) },
    { label: "Last 90 days", range: () => ({ start: subDays(new Date(), 89), end: new Date() }) },
    { label: "Last 365 days", range: () => ({ start: subDays(new Date(), 364), end: new Date() }) },
  ],
];

function MonthCalendar({
  viewMonth,
  pendingStart,
  previewEnd,
  onDayClick,
  onDayHover,
}: {
  viewMonth: Date;
  pendingStart: Date | null;
  previewEnd: Date | null;
  onDayClick: (day: Date) => void;
  onDayHover: (day: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  });

  return (
    <div>
      <p className="mb-2 px-1 text-sm font-semibold">{format(viewMonth, "MMMM yyyy")}</p>
      <div className="grid grid-cols-7 px-1 pb-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 p-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const isStart = pendingStart != null && isSameDay(day, pendingStart);
          const isEnd = previewEnd != null && pendingStart != null && isSameDay(day, previewEnd);
          const inRange =
            pendingStart != null &&
            previewEnd != null &&
            isWithinInterval(day, {
              start: isBefore(previewEnd, pendingStart) ? previewEnd : pendingStart,
              end: isBefore(previewEnd, pendingStart) ? pendingStart : previewEnd,
            });
          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!inMonth}
              onClick={() => onDayClick(day)}
              onMouseEnter={() => onDayHover(day)}
              className={cn(
                "relative flex h-9 items-center justify-center text-sm transition-colors",
                !inMonth && "pointer-events-none text-transparent",
                inMonth && !inRange && "hover:bg-muted",
                inRange && !isStart && !isEnd && "bg-primary/15",
                (isStart || isEnd) &&
                  "rounded-full bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {isToday(day) && !isStart && !isEnd && (
                <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
              )}
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CustomRangePicker({
  range,
  onSelect,
  className,
  title,
  children,
}: {
  range: DateRange | null;
  onSelect: (range: DateRange) => void;
  className?: string;
  title?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() =>
    range ? new Date(`${range.start}T00:00:00`) : new Date(),
  );
  const [pendingStart, setPendingStart] = useState<Date | null>(null);
  const [pendingEnd, setPendingEnd] = useState<Date | null>(null);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  function resetToRange() {
    if (range) {
      const start = new Date(`${range.start}T00:00:00`);
      const end = new Date(`${range.end}T00:00:00`);
      setPendingStart(start);
      setPendingEnd(end);
      setViewMonth(start);
    } else {
      setPendingStart(null);
      setPendingEnd(null);
    }
  }

  // First click of a new selection (or clicking again after a range is
  // already complete) starts over; the second click completes it, swapping
  // start/end if the user picked backwards.
  function handleDayClick(day: Date) {
    if (!pendingStart || (pendingStart && pendingEnd)) {
      setPendingStart(day);
      setPendingEnd(null);
      return;
    }
    if (isBefore(day, pendingStart)) {
      setPendingEnd(pendingStart);
      setPendingStart(day);
    } else {
      setPendingEnd(day);
    }
  }

  function applyPreset(preset: { start: Date; end: Date }) {
    setPendingStart(preset.start);
    setPendingEnd(preset.end);
    setViewMonth(preset.start);
  }

  function apply() {
    if (!pendingStart) return;
    const end = pendingEnd ?? pendingStart;
    onSelect({ start: format(pendingStart, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") });
    setOpen(false);
  }

  const previewEnd = pendingEnd ?? hoverDate;
  const secondMonth = addMonths(viewMonth, 1);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) resetToRange();
      }}
    >
      <PopoverTrigger className={className} title={title}>
        {children ?? (range ? dateRangeLabel(range) : "Pick dates")}
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[min(92vw,42rem)] p-0">
        <div className="flex items-center justify-end gap-2 border-b border-border p-3">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!pendingStart} onClick={apply}>
            Select
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row">
          <div className="min-w-0 flex-1 p-3">
            <div className="mb-1 flex items-center justify-between px-1">
              <button
                type="button"
                onClick={() => setViewMonth((d) => subMonths(d, 1))}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Previous month"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="h-4 text-xs text-muted-foreground">
                {!pendingStart
                  ? "Pick a start date"
                  : !pendingEnd
                    ? "Pick an end date"
                    : `${format(pendingStart, "MMM d")} – ${format(pendingEnd, "MMM d, yyyy")}`}
              </p>
              <button
                type="button"
                onClick={() => setViewMonth((d) => addMonths(d, 1))}
                className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Next month"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MonthCalendar
                viewMonth={viewMonth}
                pendingStart={pendingStart}
                previewEnd={previewEnd}
                onDayClick={handleDayClick}
                onDayHover={setHoverDate}
              />
              <div className="hidden sm:block">
                <MonthCalendar
                  viewMonth={secondMonth}
                  pendingStart={pendingStart}
                  previewEnd={previewEnd}
                  onDayClick={handleDayClick}
                  onDayHover={setHoverDate}
                />
              </div>
            </div>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-0.5 border-t border-border p-2 sm:w-48 sm:border-t-0 sm:border-l">
            {PRESET_GROUPS.map((group, gi) => (
              <div key={gi} className={cn(gi > 0 && "mt-1 border-t border-border pt-1")}>
                {group.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset.range())}
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
