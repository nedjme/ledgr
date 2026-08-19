"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryCombobox } from "@/components/category-combobox";
import { useOptimisticParams } from "@/lib/use-optimistic-params";

const UNCATEGORIZED = "uncategorized";

export function TransactionsFilterBar({
  categories,
  showScope,
  q,
}: {
  categories: { id: string; name: string; parent_id?: string | null }[];
  showScope: boolean;
  q: string;
}) {
  const [search, setSearch] = useState(q);

  // Derived from the client-known (optimistic) URL, not passed down as a
  // prop -- see use-optimistic-params.ts. Updates the instant a tab or the
  // category combobox is clicked, before the server round-trip lands.
  const { params: rawParams, navigate: navigateParams } = useOptimisticParams();
  const scope = rawParams.scope === "household" ? "household" : "personal";
  const category = rawParams.category ?? "";

  function navigate(next: Record<string, string | null>) {
    navigateParams((params) => {
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      params.delete("page");
    });
  }

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

      <div className="w-44">
        <CategoryCombobox
          categories={[{ id: UNCATEGORIZED, name: "Uncategorized" }, ...categories]}
          categoryId={category || null}
          onCategoryIdChange={(v) => navigate({ category: v })}
          placeholder="All categories"
        />
      </div>
    </div>
  );
}
