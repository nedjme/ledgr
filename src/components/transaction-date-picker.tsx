"use client";

import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = eachDayOfInterval({
  start: startOfWeek(new Date()),
  end: endOfWeek(new Date()),
}).map((d) => format(d, "EEEEE"));

function DayGrid({
  viewMonth,
  selected,
  onPick,
}: {
  viewMonth: Date;
  selected: Date;
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
          const selectedDay = isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPick(day)}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-full text-sm transition-colors",
                !inMonth && "text-muted-foreground/40 hover:bg-muted/60",
                inMonth && !selectedDay && "hover:bg-muted",
                selectedDay && "bg-primary font-semibold text-primary-foreground hover:bg-primary",
              )}
            >
              {isToday(day) && !selectedDay && (
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

// A transaction's date field, styled and behaving like every other date
// picker in the app (see period-date-picker.tsx) rather than the browser's
// native <input type="date"> -- opens as a Sheet (bottom sheet on mobile,
// same as the Add/Edit transaction form it lives inside) instead of a
// Popover, since a full calendar grid wants more room than a popover corner
// gives it, especially on a phone. The visible control is a button; the
// actual form value is a hidden input so this drops into `form.get(name)`
// the same way the native input did.
export function TransactionDatePicker({
  id,
  name,
  defaultValue,
  required,
}: {
  id?: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue ?? new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const selected = new Date(`${value}T00:00:00`);
  const [viewMonth, setViewMonth] = useState(selected);

  function pick(date: Date) {
    setValue(format(date, "yyyy-MM-dd"));
    setOpen(false);
  }

  return (
    <>
      <input type="hidden" name={name} value={value} required={required} />
      <Button
        id={id}
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 font-normal"
        onClick={() => {
          setViewMonth(selected);
          setOpen(true);
        }}
      >
        <CalendarDays className="size-4 text-muted-foreground" />
        {format(selected, "MMM d, yyyy")}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-xs">
          <SheetHeader>
            <SheetTitle>Choose a date</SheetTitle>
          </SheetHeader>
          <div className="px-1 pb-1">
            <div className="mb-2 flex items-center justify-between px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                title="Previous month"
                onClick={() => setViewMonth((d) => subMonths(d, 1))}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-semibold">{format(viewMonth, "MMMM yyyy")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                title="Next month"
                onClick={() => setViewMonth((d) => addMonths(d, 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <DayGrid viewMonth={viewMonth} selected={selected} onPick={pick} />
            <div className="mt-1 flex justify-center border-t border-border pt-2">
              <button
                type="button"
                onClick={() => pick(new Date())}
                className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
              >
                Today
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
