"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/supabase/types";

type CategoryRow = Pick<Category, "id" | "name" | "icon">;

function CategoryItem({
  category,
  onRename,
  onDelete,
}: {
  category: CategoryRow;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(category.name);

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/60">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {category.name.slice(0, 1).toUpperCase()}
      </span>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const trimmed = name.trim();
          if (trimmed && trimmed !== category.name) onRename(category.id, trimmed);
          else setName(category.name);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setName(category.name);
        }}
        className="h-9 flex-1 border-transparent bg-transparent shadow-none focus-visible:border-input focus-visible:bg-background"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        title="Delete category"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(category.id)}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export function CategoryManager({
  categories,
  householdId,
}: {
  categories: CategoryRow[];
  householdId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("categories").insert({
      name: name.trim(),
      household_id: householdId,
    });
    setName("");
    setSaving(false);
    router.refresh();
  }

  async function renameCategory(id: string, newName: string) {
    await supabase.from("categories").update({ name: newName }).eq("id", id);
    router.refresh();
  }

  async function removeCategory(id: string) {
    if (!confirm("Delete this category? Transactions using it become uncategorized.")) {
      return;
    }
    await supabase.from("categories").delete().eq("id", id);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={addCategory}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
          />
          <Button type="submit" disabled={saving}>
            Add
          </Button>
        </form>

        {categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No categories yet. Add one above, or import a statement — new
            categories found in the file are added automatically.
          </p>
        ) : (
          <div className="space-y-0.5">
            {categories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                onRename={renameCategory}
                onDelete={removeCategory}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
