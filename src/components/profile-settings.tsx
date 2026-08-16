"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

export function ProfileSettings({
  initialDisplayName,
}: {
  initialDisplayName: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialDisplayName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("id", user.id);

    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }

    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex items-end gap-2" onSubmit={onSubmit}>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="display_name">Name</Label>
            <Input
              id="display_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sara"
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
