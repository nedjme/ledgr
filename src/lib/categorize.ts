// Starter keyword -> category rules. Per-description corrections are
// remembered going forward in description_category_rules (see
// supabase/migrations/0019) once a user starts correcting imports.
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

// Collapses a raw bank description down to a stable merchant signature --
// strips digits (store numbers, dates, card/transaction refs) and
// punctuation, keeping only letters, so "NETFLIX.COM CARTE 4821" one month
// and "...CARTE 5190" the next both normalize to "netflix com carte".
// This MUST match public.normalize_description() in
// supabase/migrations/0019_description_category_memory.sql exactly (the
// Postgres function is the source of truth transactions.description_key and
// description_category_rules.pattern are keyed on) and its copy in
// supabase/functions/parse-statement/index.ts (edge functions can't import
// from src/lib) -- same duplication tradeoff already accepted for
// DEFAULT_KEYWORD_RULES above.
export function normalizeDescription(description: string | null | undefined): string | null {
  const normalized = (description ?? "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
  return normalized || null;
}
