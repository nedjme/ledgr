"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileDropzone } from "@/components/file-dropzone";
import { createClient } from "@/lib/supabase/client";
import { parseTable, applyMapping, type ColumnMapping } from "@/lib/csv";
import { suggestCategory } from "@/lib/categorize";
import { BANK_PRESETS, GENERIC_PRESET_ID } from "@/lib/bank-presets";

type Account = { id: string; name: string };
type Category = { id: string; name: string };

const DEFAULT_MAPPING: ColumnMapping = {
  date: 0,
  description: 1,
  debit: 2,
  credit: null,
  category: null,
};

const PRESET_ITEMS = {
  [GENERIC_PRESET_ID]: "Generic (map columns manually)",
  ...Object.fromEntries(BANK_PRESETS.map((p) => [p.id, p.label])),
};

export function ImportFlow({
  accounts,
  categories,
  householdId,
}: {
  accounts: Account[];
  categories: Category[];
  householdId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [presetId, setPresetId] = useState(GENERIC_PRESET_ID);
  const [manualMapping, setManualMapping] = useState<ColumnMapping>(DEFAULT_MAPPING);
  const [status, setStatus] = useState<
    "idle" | "importing" | "done" | "error"
  >("idle");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const preset = BANK_PRESETS.find((p) => p.id === presetId) ?? null;
  const skipRows = preset?.skipRows ?? 0;
  const mapping = preset?.mapping ?? manualMapping;

  const table = useMemo(() => parseTable(raw, skipRows), [raw, skipRows]);
  const preview = useMemo(() => {
    if (table.headers.length === 0) return [];
    return applyMapping(table, mapping).slice(0, 10);
  }, [table, mapping]);
  const allRows = useMemo(
    () => (table.headers.length === 0 ? [] : applyMapping(table, mapping)),
    [table, mapping],
  );

  function updateMapping(key: keyof ColumnMapping, value: string | null) {
    if (value == null) return;
    setManualMapping((prev) => ({
      ...prev,
      [key]: value === "none" ? null : Number(value),
    }));
  }

  function onFile(text: string, name: string) {
    setRaw(text);
    setFileName(name);
  }

  async function onImport() {
    setStatus("importing");
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("parse-statement", {
      body: { raw, mapping, skip_rows: skipRows, account_id: accountId, household_id: householdId },
    });

    if (fnError) {
      setStatus("error");
      setError(fnError.message);
      return;
    }

    setResult(data);
    setStatus("done");
    router.refresh();
  }

  const columnOptions = table.headers.map((header, index) => ({
    label: header || `Column ${index + 1}`,
    value: String(index),
  }));
  const columnItems = Object.fromEntries(
    columnOptions.map((opt) => [opt.value, opt.label]),
  );
  const optionalColumnItems = { none: "Not used", ...columnItems };
  const accountItems = Object.fromEntries(accounts.map((a) => [a.id, a.name]));
  const existingCategoryNames = new Set(categories.map((c) => c.name));

  function categoryFor(row: { description: string; category_name: string | null }) {
    return row.category_name || suggestCategory(row.description);
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Add an account first, then come back to import a statement.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Add your statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select
                value={accountId}
                onValueChange={(v) => v && setAccountId(v)}
                items={accountItems}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statement format</Label>
              <Select value={presetId} onValueChange={(v) => v && setPresetId(v)} items={PRESET_ITEMS}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GENERIC_PRESET_ID}>
                    Generic (map columns manually)
                  </SelectItem>
                  {BANK_PRESETS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <FileDropzone onFile={onFile} fileName={fileName} />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Or paste statement text directly
            </Label>
            <Textarea
              rows={6}
              placeholder={"date,description,amount\n2026-08-01,CARREFOUR RABAT,-345.50"}
              value={raw}
              onChange={(e) => {
                setRaw(e.target.value);
                setFileName(null);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {table.headers.length > 0 && (
        <>
          {preset ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{preset.label}</Badge>
              columns mapped automatically.
            </div>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>2. Map columns</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label>Date</Label>
                  <Select
                    value={String(mapping.date)}
                    onValueChange={(v) => updateMapping("date", v)}
                    items={columnItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columnOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Select
                    value={String(mapping.description)}
                    onValueChange={(v) => updateMapping("description", v)}
                    items={columnItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columnOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (or Debit)</Label>
                  <Select
                    value={String(mapping.debit)}
                    onValueChange={(v) => updateMapping("debit", v)}
                    items={columnItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {columnOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Credit (optional)</Label>
                  <Select
                    value={mapping.credit == null ? "none" : String(mapping.credit)}
                    onValueChange={(v) => updateMapping("credit", v)}
                    items={optionalColumnItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not used</SelectItem>
                      {columnOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Category (optional)</Label>
                  <Select
                    value={mapping.category == null ? "none" : String(mapping.category)}
                    onValueChange={(v) => updateMapping("category", v)}
                    items={optionalColumnItems}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not used</SelectItem>
                      {columnOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>3. Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Suggested category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => {
                    const category = categoryFor(row);
                    const isNew = category != null && !existingCategoryNames.has(category);
                    return (
                      <TableRow key={i}>
                        <TableCell>{row.occurred_at}</TableCell>
                        <TableCell>{row.description}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {category ? (
                            <span className="inline-flex items-center gap-1.5">
                              {category}
                              {isNew && (
                                <Badge variant="secondary" className="text-[10px]">
                                  new
                                </Badge>
                              )}
                            </span>
                          ) : (
                            "Uncategorized"
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {allRows.length > preview.length && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing first {preview.length} of {allRows.length} rows.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={onImport} disabled={status === "importing" || allRows.length === 0}>
              {status === "importing" ? "Importing..." : `Import ${allRows.length} rows`}
            </Button>
            {status === "done" && result && (
              <p className="text-sm text-muted-foreground">
                Imported {result.imported}, skipped {result.skipped} duplicate
                {result.skipped === 1 ? "" : "s"}.
              </p>
            )}
            {status === "error" && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
