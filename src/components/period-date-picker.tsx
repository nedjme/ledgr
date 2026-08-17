"use client";

import { useState } from "react";
import {
  addMonths,
  addYears,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameDay,
  isSameMonth,
  isSameWeek,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subYears,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Period } from "@/lib/period";

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => format(new Date(2000, i, 1), "MMM"));

// Matches date-fns' default startOfWeek/endOfWeek (Sunday-start, no locale
// override) -- the same convention lib/period.ts uses to compute a
// "week", so the row highlighted here always matches what the app
// actually filters by.
const WEEKDAY_LABELS = eachDayOfInterval({
  start: startOfWeek(new Date()),
  end: endOfWeek(new Date()),
}).map((d) => format(d, "EEEEE"));

function NavButton({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function YearGrid({
  viewYear,
  anchor,
  onPick,
}: {
  viewYear: number;
  anchor: Date;
  onPick: (date: Date) => void;
}) {
  const selectedYear = getYear(anchor);
  const nowYear = getYear(new Date());
  const blockStart = Math.floor(viewYear / 12) * 12;
  const years = Array.from({ length: 12 }, (_, i) => blockStart + i);

  return (
    <div className="grid grid-cols-3 gap-1.5 p-1">
      {years.map((year) => {
        const selected = year === selectedYear;
        const current = year === nowYear;
        return (
          <button
            key={year}
            type="button"
            onClick={() => onPick(new Date(year, 0, 1))}
            className={cn(
              "rounded-xl px-2 py-3 text-sm font-medium transition-colors hover:bg-muted",
              selected && "bg-primary text-primary-foreground hover:bg-primary",
              !selected && current && "text-primary",
            )}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}

function MonthGrid({
  viewYear,
  anchor,
  onPick,
}: {
  viewYear: number;
  anchor: Date;
  onPick: (date: Date) => void;
}) {
  const selectedYear = getYear(anchor);
  const selectedMonth = getMonth(anchor);
  const now = new Date();

  return (
    <div className="grid grid-cols-3 gap-1.5 p-1">
      {MONTH_LABELS.map((label, i) => {
        const selected = viewYear === selectedYear && i === selectedMonth;
        const current = viewYear === getYear(now) && i === getMonth(now);
        return (
          <button
            key={label}
            type="button"
            onClick={() => onPick(new Date(viewYear, i, 1))}
            className={cn(
              "rounded-xl px-2 py-3 text-sm font-medium transition-colors hover:bg-muted",
              selected && "bg-primary text-primary-foreground hover:bg-primary",
              !selected && current && "text-primary",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function DayGrid({
  viewMonth,
  anchor,
  onPick,
}: {
  viewMonth: Date;
  anchor: Date;
  onPick: (date: Date) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(viewMonth)),
    end: endOfWeek(endOfMonth(viewMonth)),
  });

  return (
    <div>
      <div className="grid grid-cols-7 px-1 pb-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i}>{label}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 p-1">
        {days.map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const inSelectedWeek = isSameWeek(day, anchor);
          const isAnchorDay = isSameDay(day, anchor);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPick(day)}
              className={cn(
                "relative flex h-10 items-center justify-center text-sm transition-colors",
                !inMonth && "text-muted-foreground/40 hover:bg-muted/60",
                inMonth && !inSelectedWeek && "hover:bg-muted",
                inSelectedWeek && "bg-primary/15",
                isAnchorDay && "font-semibold text-primary",
              )}
            >
              {isToday(day) && (
                <span className="absolute bottom-1.5 size-1 rounded-full bg-primary" />
              )}
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PeriodDatePicker({
  period,
  anchor,
  onSelect,
  className,
  title,
  children,
}: {
  period: Period;
  anchor: Date;
  onSelect: (date: Date) => void;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(anchor);

  function pick(date: Date) {
    onSelect(date);
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViewDate(anchor);
      }}
    >
      <SheetTrigger className={className} title={title}>
        {children}
      </SheetTrigger>
      <SheetContent className="sm:max-w-xs">
        <SheetHeader>
          <SheetTitle>Choose a {period}</SheetTitle>
        </SheetHeader>
        {period === "year" ? (
          <>
            <div className="mb-2 flex items-center justify-between px-1">
              <NavButton label="Previous years" onClick={() => setViewDate((d) => subYears(d, 12))}>
                <ChevronLeft className="size-4" />
              </NavButton>
              <span className="text-sm font-semibold">
                {Math.floor(getYear(viewDate) / 12) * 12} – {Math.floor(getYear(viewDate) / 12) * 12 + 11}
              </span>
              <NavButton label="Next years" onClick={() => setViewDate((d) => addYears(d, 12))}>
                <ChevronRight className="size-4" />
              </NavButton>
            </div>
            <YearGrid viewYear={getYear(viewDate)} anchor={anchor} onPick={pick} />
          </>
        ) : period === "month" ? (
          <>
            <div className="mb-2 flex items-center justify-between px-1">
              <NavButton label="Previous year" onClick={() => setViewDate((d) => subYears(d, 1))}>
                <ChevronLeft className="size-4" />
              </NavButton>
              <span className="text-sm font-semibold">{getYear(viewDate)}</span>
              <NavButton label="Next year" onClick={() => setViewDate((d) => addYears(d, 1))}>
                <ChevronRight className="size-4" />
              </NavButton>
            </div>
            <MonthGrid viewYear={getYear(viewDate)} anchor={anchor} onPick={pick} />
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between px-1">
              <NavButton label="Previous month" onClick={() => setViewDate((d) => subMonths(d, 1))}>
                <ChevronLeft className="size-4" />
              </NavButton>
              <span className="text-sm font-semibold">{format(viewDate, "MMMM yyyy")}</span>
              <NavButton label="Next month" onClick={() => setViewDate((d) => addMonths(d, 1))}>
                <ChevronRight className="size-4" />
              </NavButton>
            </div>
            <DayGrid viewMonth={viewDate} anchor={anchor} onPick={pick} />
          </>
        )}
        <div className="mt-1 flex justify-center border-t border-border pt-2">
          <button
            type="button"
            onClick={() => pick(new Date())}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            Today
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
