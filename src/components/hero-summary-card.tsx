import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function HeroSummaryCard({
  eyebrow,
  label,
  value,
  meta,
  className,
}: {
  eyebrow: string;
  label: string;
  value: string;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-linear-to-br from-primary to-brand-accent px-6 py-6 text-primary-foreground shadow-card sm:px-8 sm:py-8",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 right-10 size-40 rounded-full bg-white/10"
      />
      <div className="relative">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-foreground/70">
          {eyebrow}
        </p>
        <p className="mt-2 text-sm text-primary-foreground/80">{label}</p>
        <p className="mt-1 font-heading text-4xl font-bold tabular-nums">
          {value}
        </p>
        {meta && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-primary-foreground/80">
            {meta}
          </div>
        )}
      </div>
    </div>
  );
}
