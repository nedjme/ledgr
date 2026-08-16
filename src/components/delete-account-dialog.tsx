"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";

const CONFIRM_PHRASE = "DELETE";

export function DeleteAccountDialog() {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);

    const { data, error: fnError } = await supabase.functions.invoke("delete-account");

    if (fnError || data?.error) {
      setBusy(false);
      setError(data?.error ?? fnError?.message ?? "Something went wrong.");
      return;
    }

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setConfirmText("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" />}>
        Delete account
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This permanently deletes your profile, your accounts, and every
            transaction you&apos;ve logged. If you&apos;re in a household, you&apos;ll
            be removed from it. This can&apos;t be undone.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_delete">
              Type <span className="font-semibold text-foreground">{CONFIRM_PHRASE}</span> to
              confirm
            </Label>
            <Input
              id="confirm_delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={confirmText !== CONFIRM_PHRASE || busy}
              onClick={onDelete}
            >
              {busy ? "Deleting..." : "Permanently delete my account"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
