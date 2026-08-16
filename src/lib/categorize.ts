// Starter keyword -> category rules. Per-description corrections should be
// remembered going forward (see build brief); that mapping lives in
// description_category_rules once a user starts correcting imports.
export const DEFAULT_KEYWORD_RULES: Record<string, string[]> = {
  Groceries: ["carrefour", "marjane", "aswak assalam", "bim"],
  Dining: ["restaurant", "cafe", "mcdonald", "kfc", "starbucks", "glovo", "tacos", "burger"],
  Transport: ["shell", "afriquia", "total energies", "uber", "careem"],
  Utilities: ["iam", "orange", "inwi", "lydec", "amendis", "redal"],
  Rent: ["virement loyer", "rent", "loyer"],
  Health: ["pharmacie", "clinique", "cabinet"],
};

export function suggestCategory(description: string): string | null {
  const normalized = description.toLowerCase();
  for (const [category, keywords] of Object.entries(DEFAULT_KEYWORD_RULES)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) {
      return category;
    }
  }
  return null;
}
