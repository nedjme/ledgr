"use client";

import {
  Combobox,
  ComboboxClear,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";

type CategoryOption = { value: string; label: string; parentName?: string };

// Groups children directly after their parent (matching category-manager's
// own topLevel/childrenByParent split) and tags each child with its
// parent's name for display -- a flat, unindented list mixing "Groceries"
// in with top-level categories gives no clue it's a subcategory of "Food."
// The parent tag rides in `parentName`, not the option's searchable
// `label`, so filtering/the selected input text still just match/show the
// plain category name. A caller that only passes top-level categories (no
// `parent_id` present, or none pointing at another entry in the list) gets
// the same flat list as before -- this is a no-op unless there's an actual
// parent/child pair in what's passed in.
function buildCategoryItems(categories: { id: string; name: string; parent_id?: string | null }[]): CategoryOption[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const childrenByParent = new Map<string, typeof categories>();
  for (const c of categories) {
    if (!c.parent_id || !byId.has(c.parent_id)) continue;
    const siblings = childrenByParent.get(c.parent_id) ?? [];
    siblings.push(c);
    childrenByParent.set(c.parent_id, siblings);
  }

  const items: CategoryOption[] = [];
  for (const c of categories) {
    if (c.parent_id && byId.has(c.parent_id)) continue; // placed under its parent below
    items.push({ value: c.id, label: c.name });
    for (const child of childrenByParent.get(c.id) ?? []) {
      items.push({ value: child.id, label: child.name, parentName: c.name });
    }
  }
  return items;
}

// Wraps the Base UI Combobox so every caller deals in plain category id
// strings -- Base UI's item values are the {value, label} objects
// themselves, which is an implementation detail nobody outside this file
// needs to know about. Supports both an uncontrolled/form mode (name +
// defaultCategoryId, read via FormData like the rest of these forms) and a
// controlled mode (categoryId + onCategoryIdChange) for callers that need
// to react to the selection directly, e.g. to enable a submit button.
export function CategoryCombobox({
  id,
  name,
  categories,
  defaultCategoryId,
  categoryId,
  onCategoryIdChange,
  placeholder = "Uncategorized",
  required,
}: {
  id?: string;
  name?: string;
  categories: { id: string; name: string; parent_id?: string | null }[];
  defaultCategoryId?: string | null;
  categoryId?: string | null;
  onCategoryIdChange?: (id: string | null) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const items: CategoryOption[] = buildCategoryItems(categories);

  const valueProps =
    onCategoryIdChange !== undefined
      ? {
          value: items.find((i) => i.value === categoryId) ?? null,
          onValueChange: (next: CategoryOption | null) => onCategoryIdChange(next?.value ?? null),
        }
      : {
          defaultValue: items.find((i) => i.value === defaultCategoryId) ?? null,
        };

  return (
    <Combobox
      items={items}
      isItemEqualToValue={(a: CategoryOption, b: CategoryOption) => a.value === b.value}
      name={name}
      required={required}
      {...valueProps}
    >
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder={placeholder} />
        <ComboboxClear aria-label="Clear category" />
        <ComboboxTrigger aria-label="Open categories" />
      </ComboboxInputGroup>
      <ComboboxContent>
        <ComboboxEmpty>No categories found.</ComboboxEmpty>
        <ComboboxList>
          {(item: CategoryOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.parentName && <span className="text-muted-foreground">{item.parentName} › </span>}
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
