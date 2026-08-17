"use client";

import { useOptimistic, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// A plain `router.push` re-runs the URL through the server, and until that
// round-trip lands, everything reading `useSearchParams()` -- including an
// *already-mounted* component -- still shows the old value: search params
// only update once the navigation actually commits, not the instant
// `router.push` is called. For a filter control (active tab, highlighted
// date, selected category) that reads as "my click did nothing for a
// moment," not "fast." `useOptimistic` renders the click's intended result
// immediately and reconciles with the real params once the commit lands.
export function useOptimisticParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const baseParams = Object.fromEntries(searchParams.entries());
  const [optimisticParams, setOptimisticParams] = useOptimistic(baseParams);
  const [, startTransition] = useTransition();

  function navigate(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    mutate(params);
    const next = Object.fromEntries(params.entries());
    startTransition(() => {
      setOptimisticParams(next);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return { params: optimisticParams, navigate };
}
