"use client";

import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/components/currency-context";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export type BalanceTotal = { currency: string; amount: number };
export type BalancePerson = { id: string; name: string; amount: number; isYou: boolean };
export type BalancePersonGroup = { currency: string; people: BalancePerson[] };

export function BalanceCard({
  title = "Current balance",
  totals,
  byPerson,
}: {
  title?: string;
  totals: BalanceTotal[];
  byPerson?: BalancePersonGroup[];
}) {
  const currency = useCurrency();
  // Only worth making the tiles clickable when there's more than one to
  // choose between, and only when something's actually listening for the
  // pick -- otherwise this renders exactly as it always did.
  const interactive = totals.length > 1 && currency != null;
  const selected = interactive ? currency.selected : (totals[0]?.currency ?? null);

  if (totals.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Wallet className="size-5" />
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            totals.length > 1 && "sm:grid-cols-2",
          )}
        >
          {totals.map((t) => {
            const isSelected = t.currency === selected;
            const tile = (
              <>
                <p
                  className={cn(
                    "text-xs font-medium tracking-wide uppercase",
                    interactive && isSelected ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {t.currency}
                </p>
                <p
                  className={cn(
                    "mt-1 truncate font-heading text-2xl font-bold tabular-nums sm:text-3xl",
                    t.amount < 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {formatCurrency(t.amount, t.currency)}
                </p>
              </>
            );

            // A bottom border that lights up in the brand color on the
            // active tile -- same underline-the-active-tab language as the
            // rest of the app (see Tabs' "line" variant), just hand-rolled
            // here since these are a grid of amount tiles, not a pill row.
            if (interactive) {
              return (
                <button
                  key={t.currency}
                  type="button"
                  onClick={() => currency.setSelected(t.currency)}
                  className={cn(
                    "rounded-xl border-b-2 bg-muted/60 px-4 py-3 text-left transition-colors",
                    isSelected ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted",
                  )}
                >
                  {tile}
                </button>
              );
            }

            return (
              <div key={t.currency} className="rounded-xl bg-muted/60 px-4 py-3">
                {tile}
              </div>
            );
          })}
        </div>

        {byPerson && byPerson.length > 0 && (
          <>
            <Separator />
            <div className="space-y-5">
              {byPerson.map((group) => (
                <div key={group.currency}>
                  {byPerson.length > 1 && (
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {group.currency}
                    </p>
                  )}
                  <div className="space-y-1">
                    {group.people.map((person) => (
                      <div
                        key={person.id}
                        className="flex items-center gap-3 rounded-xl px-1 py-1.5"
                      >
                        <Avatar className="size-8">
                          <AvatarFallback
                            className={
                              person.isYou
                                ? "bg-primary text-[11px] font-semibold text-primary-foreground"
                                : "bg-muted text-[11px] font-semibold text-foreground"
                            }
                          >
                            {initialsOf(person.name)}
                          </AvatarFallback>
                        </Avatar>
                        <p className="flex-1 truncate text-sm font-medium">
                          {person.name}
                          {person.isYou && (
                            <Badge variant="secondary" className="ml-2">
                              You
                            </Badge>
                          )}
                        </p>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            person.amount < 0 ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(person.amount, group.currency)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
