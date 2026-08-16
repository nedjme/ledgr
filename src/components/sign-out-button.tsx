"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function SignOutButton({
  className,
  iconOnly = false,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      title={iconOnly ? "Sign out" : undefined}
      className={cn(!iconOnly && "gap-2", className)}
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="size-4" />
      {!iconOnly && "Sign out"}
    </Button>
  );
}
