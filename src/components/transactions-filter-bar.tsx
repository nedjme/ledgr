"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const UNCATEGORIZED = "uncategorized";
const ALL_CATEGORIES = "all";

export function TransactionsFilterBar({
  categories,
  showScope,
  scope,
  q,
  category,
}: {
  categories: { id: string; name: string }[];
  showScope: boolean;
  scope: "personal" | "household";
  q: string;
  category: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(q);

  function navigate(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(next)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const categoryItems = {
    [ALL_CATEGORIES]: "All categories",
    [UNCATEGORIZED]: "Uncategorized",
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showScope && (
        <Tabs
          value={scope}
          onValueChange={(v) => v && navigate({ scope: v === "personal" ? null : v })}
        >
          <TabsList>
            <TabsTrigger value="personal">Mine</TabsTrigger>
            <TabsTrigger value="household">Household</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ q: search });
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={() => navigate({ q: search })}
          placeholder="Search description..."
          className="w-48 pl-8"
        />
      </form>

      <Select
        value={category || ALL_CATEGORIES}
        onValueChange={(v) => v && navigate({ category: v === ALL_CATEGORIES ? null : v })}
        items={categoryItems}
      >
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
          <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
