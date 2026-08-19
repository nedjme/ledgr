"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type NavigateOptions = {
  // Skips `router.push` entirely in favor of a raw History API call. Use
  // this when the param change doesn't need any new data from the server
  // (e.g. a tab that only toggles which already-loaded content is shown) --
  // it updates the address bar synchronously with no RSC round-trip to wait
  // on, instead of paying for a full navigation just to flip a client-side
  // switch.
  shallow?: boolean;
};

type OptimisticParams = {
  params: Record<string, string>;
  navigate: (mutate: (params: URLSearchParams) => void, opts?: NavigateOptions) => void;
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

  // A `shallow` navigate updates the address bar directly via the History
  // API instead of `router.push`, so it never touches Next's router state
  // -- meaning `useSearchParams()` (and therefore `baseParams` above) never
  // learns about it. We track that delta ourselves and layer it on top of
  // the router-driven params below. Reset whenever the route changes, since
  // a shallow value scoped to the old page shouldn't leak into the new one
  // -- this component stays mounted across client-side navigations (it
  // lives in AppShell, above `children`), so nothing else would clear it.
  const [shallowParams, setShallowParams] = useState<Record<string, string>>({});
  const prevPathname = useRef(pathname);
  if (prevPathname.current !== pathname) {
    prevPathname.current = pathname;
    if (Object.keys(shallowParams).length > 0) setShallowParams({});
  }

  const navigate = useCallback(
    (mutate: (params: URLSearchParams) => void, opts?: NavigateOptions) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(shallowParams)) params.set(key, value);
      mutate(params);
      const next = Object.fromEntries(params.entries());

      if (opts?.shallow) {
        setShallowParams(next);
        window.history.pushState(null, "", `${pathname}?${params.toString()}`);
        return;
      }

      setShallowParams({});
      startTransition(() => {
        setOptimisticParams(next);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [searchParams, pathname, router, setOptimisticParams, shallowParams],
  );

  const params = useMemo(
    () => ({ ...optimisticParams, ...shallowParams }),
    [optimisticParams, shallowParams],
  );

  const value = useMemo(() => ({ params, navigate }), [params, navigate]);

  return <OptimisticParamsContext.Provider value={value}>{children}</OptimisticParamsContext.Provider>;
}

export function useOptimisticParams() {
  const ctx = useContext(OptimisticParamsContext);
  if (!ctx) {
    throw new Error("useOptimisticParams must be used within an OptimisticParamsProvider");
  }
  return ctx;
}
