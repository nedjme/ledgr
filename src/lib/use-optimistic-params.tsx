"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type OptimisticParams = {
  params: Record<string, string>;
  navigate: (mutate: (params: URLSearchParams) => void) => void;
};

const OptimisticParamsContext = createContext<OptimisticParams | null>(null);

// A plain `router.push` re-runs the URL through the server, and until that
// round-trip lands, everything reading `useSearchParams()` -- including an
// *already-mounted* component -- still shows the old value: search params
// only update once the navigation actually commits, not the instant
// `router.push` is called. For a filter control (active tab, highlighted
// date, selected category) that reads as "my click did nothing for a
// moment," not "fast." `useOptimistic` renders the click's intended result
// immediately and reconciles with the real params once the commit lands.
//
// This lives in a single provider mounted once above the whole app shell
// (see AppShell), not inside the hook itself -- if every consumer ran its
// own `useOptimistic`, only the component that actually called `navigate`
// would see the instant update; any *other* component reading the same
// params (e.g. the topbar title reacting to a tab switch triggered inside
// the page content) would sit frozen until the real navigation committed.
// One shared optimistic value means every consumer updates in lockstep.
export function OptimisticParamsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
  const [optimisticParams, setOptimisticParams] = useOptimistic(baseParams);
  const [, startTransition] = useTransition();

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams);
      mutate(params);
      const next = Object.fromEntries(params.entries());
      startTransition(() => {
        setOptimisticParams(next);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [searchParams, pathname, router, setOptimisticParams],
  );

  const value = useMemo(() => ({ params: optimisticParams, navigate }), [optimisticParams, navigate]);

  return <OptimisticParamsContext.Provider value={value}>{children}</OptimisticParamsContext.Provider>;
}

export function useOptimisticParams() {
  const ctx = useContext(OptimisticParamsContext);
  if (!ctx) {
    throw new Error("useOptimisticParams must be used within an OptimisticParamsProvider");
  }
  return ctx;
}
