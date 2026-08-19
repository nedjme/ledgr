"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { OptimisticParamsProvider } from "@/lib/use-optimistic-params";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import { MobileNav } from "./mobile-nav";

const COOKIE_NAME = "sidebar-collapsed";

export function AppShell({
  householdName,
  displayName,
  initialCollapsed,
  children,
}: {
  householdName: string | null;
  displayName: string;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${COOKIE_NAME}=${next ? "1" : "0"}; path=/; max-age=31536000`;
      return next;
    });
  }

  return (
    <OptimisticParamsProvider>
      <div className="min-h-dvh bg-background">
        <AppSidebar householdName={householdName} collapsed={collapsed} />
        <div
          className={cn(
            "flex min-h-dvh flex-col transition-[padding-left] duration-200",
            collapsed ? "md:pl-20" : "md:pl-64",
          )}
        >
          <AppTopbar displayName={displayName} onToggleSidebar={toggleCollapsed} />
          <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6">
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
        </div>
        <MobileNav />
      </div>
    </OptimisticParamsProvider>
  );
}
