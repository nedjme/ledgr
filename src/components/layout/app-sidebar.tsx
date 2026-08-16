"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_LINKS, isActiveLink } from "./nav-links";
import { SignOutButton } from "@/components/sign-out-button";

export function AppSidebar({
  householdName,
  collapsed,
}: {
  householdName: string | null;
  collapsed: boolean;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar py-6 transition-[width] duration-200 md:flex",
        collapsed ? "w-20 px-3" : "w-64 px-4",
      )}
    >
      <div className={cn("flex items-center gap-2", collapsed ? "justify-center px-0" : "px-2")}>
        <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-heading text-lg font-bold">
            L
          </span>
          {!collapsed && (
            <span className="truncate font-heading text-lg font-semibold text-sidebar-foreground">
              Ledgr
            </span>
          )}
        </Link>
      </div>

      {!collapsed && householdName && (
        <p className="mt-4 truncate px-2 text-xs font-medium text-muted-foreground">
          {householdName}
        </p>
      )}

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {NAV_LINKS.map((link) => {
          const active = isActiveLink(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={collapsed ? link.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                collapsed && "justify-center px-0",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4.5 shrink-0" strokeWidth={2} />
              {!collapsed && link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border pt-4">
        <SignOutButton
          iconOnly={collapsed}
          className={cn("text-sidebar-foreground/70", !collapsed && "w-full justify-start")}
        />
      </div>
    </aside>
  );
}
