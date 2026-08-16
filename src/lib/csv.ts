export type ParsedTable = { headers: string[]; rows: string[][] };

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

export function parseTable(raw: string, skipRows = 0): ParsedTable {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const dataLines = lines.slice(skipRows);
  if (dataLines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(dataLines[0]);
  const [headerLine, ...rest] = dataLines;

  return {
    headers: parseCsvLine(headerLine, delimiter),
    rows: rest.map((line) => parseCsvLine(line, delimiter)),
  };
}

export type ColumnMapping = {
  date: number;
  description: number;
  debit: number;
  credit: number | null; // null when the sheet uses a single signed amount column
  category?: number | null; // set when the bank export includes its own category column
};

export type NormalizedTransaction = {
  occurred_at: string;
  description: string;
  amount: number;
  category_name: string | null;
};

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
  // Accept ISO (yyyy-mm-dd) and common dd/mm/yyyy or dd.mm.yyyy formats.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = value.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (match) {
    const [, d, m, y] = match;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return value;
}

export function applyMapping(
  table: ParsedTable,
  mapping: ColumnMapping,
): NormalizedTransaction[] {
  return table.rows
    .map((row) => {
      const debit = parseAmount(row[mapping.debit]);
      const credit = mapping.credit != null ? parseAmount(row[mapping.credit]) : 0;
      const amount = mapping.credit != null ? credit - debit : debit;

      const categoryName =
        mapping.category != null ? row[mapping.category]?.trim() || null : null;

      return {
        occurred_at: parseDate(row[mapping.date]),
        description: row[mapping.description] ?? "",
        amount,
        category_name: categoryName,
      };
    })
    .filter((t) => t.occurred_at && t.amount !== 0);
}
