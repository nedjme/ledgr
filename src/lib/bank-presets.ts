import type { ColumnMapping } from "./csv";

export type BankPreset = {
  id: string;
  label: string;
  skipRows: number;
  mapping: ColumnMapping;
  // Tested against the first ~5 lines of the raw pasted/uploaded text, not
  // the parsed table -- detection has to work before skipRows is known
  // (that's part of what a preset determines), so it can't rely on the
  // real header having already been located.
  detect: (raw: string) => boolean;
};

const HEAD = (raw: string) => raw.split(/\r?\n/).slice(0, 5).join("\n");

// Column layout is fixed per bank export, keyed off their real header row.
// The resolved mapping (not the preset id) is what's sent to
// supabase/functions/parse-statement, so there's nothing to keep in sync
// server-side.
export const BANK_PRESETS: BankPreset[] = [
  {
    id: "cfg",
    label: "CFG Bank (Relevé espèces)",
    // Row 1: "Relevé espèces" title, row 2: blank-ish, row 3: account/period
    // line — the real header ("Date d'opération, Date de valeur, Détail,
    // Débit, Crédit, Solde") is row 4. There's also a leading blank column.
    skipRows: 3,
    mapping: { date: 1, description: 3, debit: 4, credit: 5 },
    detect: (raw) => HEAD(raw).includes("Relevé espèces"),
  },
  {
    id: "boursobank",
    label: "BoursoBank",
    // Header row 1: dateOp;dateVal;label;suggestedLabel;category;
    // categoryParent;amount;comment;accountNum;accountLabel;
    // accountbalance;mark — semicolon-delimited, single signed amount
    // column (negative = expense). suggestedLabel reads cleaner than the
    // raw "CARTE dd/mm/yy MERCHANT CB*nnnn" label, so use that. `category`
    // (not the broader `categoryParent`) becomes the transaction's
    // category, auto-created if the household doesn't have it yet.
    skipRows: 0,
    mapping: { date: 0, description: 3, debit: 6, credit: null, category: 4 },
    detect: (raw) => /^dateOp;dateVal;label/.test(HEAD(raw).trimStart()),
  },
];

export const GENERIC_PRESET_ID = "generic";

// Falls back to the generic (manual-mapping) preset when nothing matches --
// an unrecognized file should never silently guess a mapping, only a
// positively-identified header layout does.
export function detectBankPreset(raw: string): string {
  return BANK_PRESETS.find((p) => p.detect(raw))?.id ?? GENERIC_PRESET_ID;
}
