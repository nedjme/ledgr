export type CategoryNode = {
  id: string;
  parent_id: string | null;
};

// Categories nest at most one level deep (enforced in the DB), so a
// subcategory's spend always rolls up to its immediate parent -- this is
// what every chart/total outside a category's own drill-down groups by.
export function topCategoryId<T extends CategoryNode>(
  category: T | null | undefined,
  categoryById: Map<string, T>,
): string | null {
  if (!category) return null;
  if (!category.parent_id) return category.id;
  return categoryById.get(category.parent_id)?.id ?? category.id;
}
