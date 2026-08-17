"use client";

import { CornerDownRight, CornerUpLeft, Pipette, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CategoryCombobox } from "@/components/category-combobox";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_PRESET_HEX, OTHER_COLOR, categoryColor } from "@/lib/category-color";
import { CATEGORY_ICONS, categoryIconComponent } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/supabase/types";

type CategoryRow = Pick<Category, "id" | "name" | "icon" | "color" | "parent_id">;

// The avatar circle doubles as the picker trigger: it always shows the
// category's actual resolved color and icon (SVGs tint to `currentColor`,
// so the same icon reads differently per category instead of carrying a
// fixed emoji color), and opening it reveals an icon grid, quick color
// presets, and a full native color picker for anything else -- instead of
// a color row sitting permanently under every category.
function IconColorPicker({
  icon,
  fallbackLetter,
  resolvedColor,
  manualColor,
  onIconChange,
  onColorChange,
}: {
  icon: string;
  fallbackLetter: string;
  resolvedColor: string;
  manualColor: string | null;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string | null) => void;
}) {
  const SelectedIcon = categoryIconComponent(icon);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Change icon & color"
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        style={{ backgroundColor: resolvedColor }}
      >
        {SelectedIcon ? (
          // eslint-disable-next-line react-hooks/static-components -- SelectedIcon is a stable lookup from a static registry, not a component defined during render
          <SelectedIcon className="size-4.5" />
        ) : (
          fallbackLetter
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 space-y-3 p-3">
        <div className="grid max-h-40 grid-cols-7 gap-1 overflow-y-auto">
          {CATEGORY_ICONS.map(({ key, label, Icon }) => (
            <DropdownMenuItem
              key={key}
              title={label}
              className={cn(
                "size-7 items-center justify-center rounded-lg p-0",
                icon === key && "bg-accent text-accent-foreground",
              )}
              onClick={() => onIconChange(icon === key ? "" : key)}
            >
              <Icon className="size-4" />
            </DropdownMenuItem>
          ))}
        </div>
        <div className="flex items-center gap-1.5 border-t border-border pt-3">
          {CATEGORY_PRESET_HEX.map((swatch) => (
            <DropdownMenuItem
              key={swatch}
              title={swatch}
              className="size-7 items-center justify-center rounded-full p-0 focus:bg-transparent"
              onClick={() => onColorChange(swatch)}
            >
              <span
                className="size-5 rounded-full transition-transform"
                style={{
                  backgroundColor: swatch,
                  boxShadow:
                    manualColor === swatch
                      ? `0 0 0 2px var(--popover), 0 0 0 4px ${swatch}`
                      : "none",
                }}
              />
            </DropdownMenuItem>
          ))}
          <label
            title="Custom color"
            className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground hover:text-foreground"
          >
            <Pipette className="size-3.5" />
            <input
              type="color"
              value={manualColor ?? "#888888"}
              onChange={(e) => onColorChange(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        {manualColor !== null && (
          <button
            type="button"
            onClick={() => onColorChange(null)}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Reset to automatic
          </button>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryItem({
  category,
  indented,
  canNest,
  onRename,
  onIconChange,
  onColorChange,
  onNestClick,
  onRemoveFromParent,
  onDelete,
}: {
  category: CategoryRow;
  indented: boolean;
  canNest: boolean;
  onRename: (id: string, name: string) => void;
  onIconChange: (id: string, icon: string) => void;
  onColorChange: (id: string, color: string | null) => void;
  onNestClick: (category: CategoryRow) => void;
  onRemoveFromParent: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [name, setName] = useState(category.name);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-muted/60",
        indented && "ml-8",
      )}
    >
      <IconColorPicker
        icon={category.icon ?? ""}
        fallbackLetter={category.name.slice(0, 1).toUpperCase()}
        resolvedColor={categoryColor(category.id, category.color)}
        manualColor={category.color}
        onIconChange={(icon) => onIconChange(category.id, icon)}
        onColorChange={(color) => onColorChange(category.id, color)}
      />
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
      {category.parent_id !== null && (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Remove from parent category"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onRemoveFromParent(category.id)}
        >
          <CornerUpLeft className="size-4" />
        </Button>
      )}
      {canNest && (
        <Button
          variant="ghost"
          size="icon-sm"
          title="Make a subcategory of..."
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onNestClick(category)}
        >
          <CornerDownRight className="size-4" />
        </Button>
      )}
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

function NestCategoryDialog({
  category,
  targets,
  onOpenChange,
  onConfirm,
}: {
  category: CategoryRow | null;
  targets: CategoryRow[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (source: CategoryRow, target: CategoryRow) => Promise<void>;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const target = targets.find((c) => c.id === targetId) ?? null;

  async function handleConfirm() {
    if (!category || !target) return;
    setBusy(true);
    await onConfirm(category, target);
    setBusy(false);
    setTargetId(null);
  }

  return (
    <Sheet
      open={category !== null}
      onOpenChange={(next) => {
        if (!next) setTargetId(null);
        onOpenChange(next);
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Make &ldquo;{category?.name}&rdquo; a subcategory</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Choose a category for &ldquo;{category?.name}&rdquo; to nest under. Its
            spend rolls up into that category&apos;s totals everywhere, and shows
            its own breakdown when you drill into it -- nothing is deleted or
            renamed, and you can remove it from the parent again later.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nest_target">Parent category</Label>
            <CategoryCombobox
              id="nest_target"
              categories={targets}
              categoryId={targetId}
              onCategoryIdChange={setTargetId}
              placeholder="Search categories..."
            />
          </div>
          <SheetFooter>
            <Button disabled={!target || busy} onClick={handleConfirm}>
              {busy ? "Saving..." : "Make subcategory"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
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
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nestingCategory, setNestingCategory] = useState<CategoryRow | null>(null);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("categories").insert({
      name: name.trim(),
      icon: icon.trim() || null,
      color,
      household_id: householdId,
    });
    setName("");
    setIcon("");
    setColor(null);
    setSaving(false);
    router.refresh();
  }

  async function renameCategory(id: string, newName: string) {
    await supabase.from("categories").update({ name: newName }).eq("id", id);
    router.refresh();
  }

  async function changeIcon(id: string, newIcon: string) {
    await supabase.from("categories").update({ icon: newIcon || null }).eq("id", id);
    router.refresh();
  }

  async function changeColor(id: string, newColor: string | null) {
    await supabase.from("categories").update({ color: newColor }).eq("id", id);
    router.refresh();
  }

  async function removeCategory(id: string) {
    if (!confirm("Delete this category? Transactions using it become uncategorized.")) {
      return;
    }
    await supabase.from("categories").delete().eq("id", id);
    router.refresh();
  }

  async function nestCategory(source: CategoryRow, target: CategoryRow) {
    const { error } = await supabase
      .from("categories")
      .update({ parent_id: target.id })
      .eq("id", source.id);
    if (error) {
      alert(error.message);
      return;
    }
    setNestingCategory(null);
    router.refresh();
  }

  async function removeFromParent(id: string) {
    await supabase.from("categories").update({ parent_id: null }).eq("id", id);
    router.refresh();
  }

  const topLevel = categories.filter((c) => c.parent_id === null);
  const childrenByParent = new Map<string, CategoryRow[]>();
  for (const c of categories) {
    if (!c.parent_id) continue;
    childrenByParent.set(c.parent_id, [...(childrenByParent.get(c.parent_id) ?? []), c]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categories</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex gap-2" onSubmit={addCategory}>
          <IconColorPicker
            icon={icon}
            fallbackLetter={name.slice(0, 1).toUpperCase() || "?"}
            resolvedColor={color ?? OTHER_COLOR}
            manualColor={color}
            onIconChange={setIcon}
            onColorChange={setColor}
          />
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
            {topLevel.map((category) => {
              const children = childrenByParent.get(category.id) ?? [];
              return (
                <div key={category.id}>
                  <CategoryItem
                    category={category}
                    indented={false}
                    canNest={children.length === 0 && topLevel.length > 1}
                    onRename={renameCategory}
                    onIconChange={changeIcon}
                    onColorChange={changeColor}
                    onNestClick={setNestingCategory}
                    onRemoveFromParent={removeFromParent}
                    onDelete={removeCategory}
                  />
                  {children.map((child) => (
                    <CategoryItem
                      key={child.id}
                      category={child}
                      indented
                      canNest={topLevel.length > 1}
                      onRename={renameCategory}
                      onIconChange={changeIcon}
                      onColorChange={changeColor}
                      onNestClick={setNestingCategory}
                      onRemoveFromParent={removeFromParent}
                      onDelete={removeCategory}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <NestCategoryDialog
        category={nestingCategory}
        targets={topLevel.filter((c) => c.id !== nestingCategory?.id)}
        onOpenChange={(open) => {
          if (!open) setNestingCategory(null);
        }}
        onConfirm={nestCategory}
      />
    </Card>
  );
}
