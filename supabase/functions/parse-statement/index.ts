// Parses a pasted/uploaded bank statement and inserts transactions for the
// calling user. Runs with the caller's own JWT (not service role) so RLS
// still enforces owner-only writes -- this function only saves the client a
// parsing round-trip and keeps raw statement text off any third-party
// service.
import { createClient } from "jsr:@supabase/supabase-js@2";

const DELIMITERS = [",", ";", "\t"];

function detectDelimiter(line: string) {
  return DELIMITERS.reduce((best, d) =>
    line.split(d).length > line.split(best).length ? d : best,
  );
}

// A naive `line.split(delimiter)` breaks on quoted fields that contain the
// delimiter themselves (e.g. `"1,000.00"` in a comma-delimited file), which
// real bank exports do for thousands-separated amounts. Parse char-by-char
// instead, tracking quote state, so those stay a single cell.
function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

function parseTable(raw: string, skipRows = 0) {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const dataLines = lines.slice(skipRows);
  if (dataLines.length === 0) return { headers: [] as string[], rows: [] as string[][] };
  const delimiter = detectDelimiter(dataLines[0]);
  const [headerLine, ...rest] = dataLines;
  return {
    headers: parseCsvLine(headerLine, delimiter),
    rows: rest.map((line) => parseCsvLine(line, delimiter)),
  };
}

// Handles both "1234.56" and European "1234,56", plus thousands-separated
// forms like "1,234.56" or "1.234,56" — whichever of , or . appears last is
// the decimal separator; the other (if also present) is a thousands
// separator and gets stripped.
function parseAmount(value: string | undefined) {
  if (!value) return 0;
  let cleaned = value.replace(/[^0-9.,-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    cleaned =
      lastDot > lastComma
        ? cleaned.replace(/,/g, "")
        : cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastComma !== -1) {
    cleaned = cleaned.replace(",", ".");
  }

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDate(value: string | undefined) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return value;
}

const KEYWORD_RULES: Record<string, string[]> = {
  Groceries: ["carrefour", "marjane", "aswak assalam", "bim"],
  Dining: ["restaurant", "cafe", "mcdonald", "kfc", "starbucks", "glovo", "tacos", "burger"],
  Transport: ["shell", "afriquia", "total energies", "uber", "careem"],
  Utilities: ["iam", "orange", "inwi", "lydec", "amendis", "redal"],
  Rent: ["virement loyer", "rent", "loyer"],
  Health: ["pharmacie", "clinique", "cabinet"],
};

function suggestCategory(description: string) {
  const normalized = description.toLowerCase();
  for (const [category, keywords] of Object.entries(KEYWORD_RULES)) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return category;
  }
  return null;
}

// Must match public.normalize_description() in
// supabase/migrations/0019_description_category_memory.sql exactly -- that
// SQL function is the source of truth transactions.description_key and
// description_category_rules.pattern are keyed on, and this is its Deno
// copy (edge functions can't import from src/lib -- see
// src/lib/categorize.ts's own copy of the same algorithm).
function normalizeDescription(description: string): string | null {
  const normalized = description
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim();
  return normalized || null;
}

type Mapping = {
  date: number;
  description: number;
  debit: number;
  credit: number | null;
  category?: number | null;
};

// Called from the browser via supabase.functions.invoke, so the request is
// cross-origin from the app's perspective and the browser sends a CORS
// preflight (OPTIONS) before the real POST. Without these headers the
// preflight fails and the browser blocks the actual request client-side --
// supabase-js then just reports "Failed to send a request to the Edge
// Function", with no server-side error to debug.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { ...corsHeaders, ...init?.headers },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const raw: string = body.raw;
    const mapping: Mapping = body.mapping;
    const skipRows: number = body.skip_rows ?? 0;
    const accountId: string = body.account_id;
    const householdId: string | null = body.household_id ?? null;

    const { data: account } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", accountId)
      .single();
    const currency = account?.currency ?? "MAD";

    const table = parseTable(raw, skipRows);
    const normalized = table.rows
      .map((row) => {
        const debit = parseAmount(row[mapping.debit]);
        const credit = mapping.credit != null ? parseAmount(row[mapping.credit]) : 0;
        const categoryName =
          mapping.category != null ? row[mapping.category]?.trim() || null : null;
        return {
          occurred_at: parseDate(row[mapping.date]),
          description: row[mapping.description] ?? "",
          amount: mapping.credit != null ? credit - debit : debit,
          category_name: categoryName,
        };
      })
      .filter((t) => t.occurred_at && t.amount !== 0);

    const [{ data: categories }, { data: rules }] = await Promise.all([
      supabase.from("categories").select("id, name").eq("user_id", user.id),
      supabase.from("description_category_rules").select("pattern, category_id").eq("user_id", user.id),
    ]);
    const categoryIdByName = new Map((categories ?? []).map((c) => [c.name, c.id]));
    const categoryIdByPattern = new Map((rules ?? []).map((r) => [r.pattern, r.category_id]));

    // Resolve a category name to an id, creating it (and caching it for the
    // rest of this import) the first time it's seen -- either from the
    // statement's own category column or from our keyword guess.
    async function resolveCategoryId(name: string | null): Promise<string | null> {
      if (!name) return null;
      const existing = categoryIdByName.get(name);
      if (existing) return existing;

      const { data: created, error: createError } = await supabase
        .from("categories")
        .insert({ name, user_id: user.id })
        .select("id")
        .single();
      if (createError || !created) return null;

      categoryIdByName.set(name, created.id);
      return created.id;
    }

    const rows = [];
    for (const t of normalized) {
      // A learned correction outranks the generic starter keyword list --
      // it's specific to this user and this exact merchant, where the
      // keyword list is just a first guess. Falls back to the statement's
      // own category column, then the keyword guess, same as before.
      const key = normalizeDescription(t.description);
      const learnedCategoryId = key ? categoryIdByPattern.get(key) : undefined;
      const categoryId =
        learnedCategoryId ?? (await resolveCategoryId(t.category_name || suggestCategory(t.description)));
      rows.push({
        account_id: accountId,
        user_id: user.id,
        household_id: householdId,
        category_id: categoryId ?? null,
        amount: t.amount,
        currency,
        description: t.description,
        occurred_at: t.occurred_at,
        source: "csv_import",
      });
    }

    if (rows.length === 0) {
      return json({ imported: 0, skipped: 0 });
    }

    // A row only counts as an already-imported duplicate if it matches one
    // *already stored* -- two rows in this same batch sharing a
    // date/amount/description are two real transactions from the
    // statement (two coffees, two rides, a recurring charge twice in a
    // day), not a re-import, so they both go in. Re-uploading the same
    // statement a second time still gets fully skipped: every key in it
    // will have already-stored matches to count against.
    const dateKey = (row: { occurred_at: string }) => row.occurred_at;
    const minDate = rows.reduce((min, r) => (dateKey(r) < min ? dateKey(r) : min), dateKey(rows[0]));
    const maxDate = rows.reduce((max, r) => (dateKey(r) > max ? dateKey(r) : max), dateKey(rows[0]));

    const { data: existing } = await supabase
      .from("transactions")
      .select("occurred_at, amount, description")
      .eq("account_id", accountId)
      .gte("occurred_at", minDate)
      .lte("occurred_at", maxDate);

    const dedupeKey = (row: { occurred_at: string; amount: number; description: string | null }) =>
      `${row.occurred_at}|${row.amount}|${row.description ?? ""}`;

    const existingCountByKey = new Map<string, number>();
    for (const e of existing ?? []) {
      const key = dedupeKey(e);
      existingCountByKey.set(key, (existingCountByKey.get(key) ?? 0) + 1);
    }

    const seenByKey = new Map<string, number>();
    const toInsert = [];
    let skipped = 0;
    for (const row of rows) {
      const key = dedupeKey(row);
      const already = existingCountByKey.get(key) ?? 0;
      const seen = seenByKey.get(key) ?? 0;
      seenByKey.set(key, seen + 1);
      if (seen < already) {
        skipped++;
        continue;
      }
      toInsert.push(row);
    }

    if (toInsert.length === 0) {
      return json({ imported: 0, skipped });
    }

    const { data: inserted, error } = await supabase.from("transactions").insert(toInsert).select("id");

    if (error) {
      return json({ error: error.message }, { status: 400 });
    }

    return json({
      imported: inserted?.length ?? 0,
      skipped: skipped + (toInsert.length - (inserted?.length ?? 0)),
    });
  } catch (err) {
    return json({ error: (err as Error).message }, { status: 500 });
  }
});
