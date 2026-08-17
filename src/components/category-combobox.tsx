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

type CategoryOption = { value: string; label: string };

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
  categories: { id: string; name: string }[];
  defaultCategoryId?: string | null;
  categoryId?: string | null;
  onCategoryIdChange?: (id: string | null) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const items: CategoryOption[] = categories.map((c) => ({ value: c.id, label: c.name }));

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
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
