import type { ColumnMapping } from "./csv";

export type BankPreset = {
  id: string;
  label: string;
  skipRows: number;
  mapping: ColumnMapping;
};

// Column layout is fixed per bank export, keyed off their real header row
// (see supabase/functions/parse-statement for the server-side mirror of
// this list — keep both in sync when adding a preset).
export const BANK_PRESETS: BankPreset[] = [
  {
    id: "cfg",
    label: "CFG Bank (Relevé espèces)",
    // Row 1: "Relevé espèces" title, row 2: blank-ish, row 3: account/period
    // line — the real header ("Date d'opération, Date de valeur, Détail,
    // Débit, Crédit, Solde") is row 4. There's also a leading blank column.
    skipRows: 3,
    mapping: { date: 1, description: 3, debit: 4, credit: 5 },
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
  },
];

export const GENERIC_PRESET_ID = "generic";
