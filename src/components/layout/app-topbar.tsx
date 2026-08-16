"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PanelLeft, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const TITLES: { test: (path: string) => boolean; title: string }[] = [
  { test: (p) => p === "/dashboard", title: "Dashboard" },
  { test: (p) => p.startsWith("/dashboard/household"), title: "Household" },
  { test: (p) => p.startsWith("/accounts/import"), title: "Import statement" },
  { test: (p) => p.startsWith("/accounts"), title: "Accounts" },
  { test: (p) => p.startsWith("/transactions"), title: "Transactions" },
  { test: (p) => p.startsWith("/settings"), title: "Settings" },
];

export function AppTopbar({
  displayName,
  onToggleSidebar,
}: {
  displayName: string;
  onToggleSidebar: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const title = TITLES.find((t) => t.test(pathname))?.title ?? "Ledgr";

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border/80 bg-card/90 px-4 py-4 shadow-sm backdrop-blur md:px-8">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          title="Toggle sidebar"
          onClick={onToggleSidebar}
          className="hidden text-muted-foreground md:inline-flex"
        >
          <PanelLeft className="size-4.5" />
        </Button>
        <h1 className="font-heading text-xl font-semibold text-foreground">
          {title}
        </h1>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initialsOf(displayName)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {displayName}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href="/settings/household" />}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
              router.refresh();
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
