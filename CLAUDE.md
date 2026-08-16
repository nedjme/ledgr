@AGENTS.md

# Design system

Ledgr's visual language: a soft neutral canvas, white floating cards
(soft shadow, generous rounded corners), and a single confident teal→blue
brand gradient reserved for hero/summary moments. Flat and quiet everywhere
else. Read this before adding any UI — reuse what's here before building new.

## Tokens (source of truth: `src/app/globals.css`)

Every color, radius, and shadow is a CSS variable in `:root` / `.dark`,
re-exposed through `@theme inline` as Tailwind utilities. **Never hardcode a
hex value or an arbitrary `[var(--x)]` in a component** — use the utility
class (`bg-primary`, `text-muted-foreground`, `bg-card`, `border-border`,
`shadow-card`, `rounded-2xl`, `text-chart-3`, …) so light/dark mode and any
future re-theme stay centralized in one file. If a token you need doesn't
exist yet, add it to `globals.css` (both `:root` and `.dark`) rather than
inlining a color.

- `--primary` / `--brand-accent` — teal→blue, the one brand accent. Used
  for active nav state, primary buttons, focus rings, and the gradient hero
  card (`bg-linear-to-br from-primary to-brand-accent`). Don't use it as a
  data-series color — see Charts below.
- `--background` vs `--card` — background is the soft lavender canvas;
  `--card` is white (near-black in dark mode) so cards visibly float above
  it. Page content sits on `bg-background`; every discrete section is a
  `<Card>`.
- `--radius` is `1rem`; `rounded-lg`/`xl`/`2xl` etc. all derive from it via
  `@theme inline`. Cards use `rounded-2xl`; buttons/inputs use `rounded-lg`.
  Keep new components on this scale instead of picking arbitrary radii.
- `--card-shadow` → `shadow-card` utility. Cards use this instead of a hard
  border; a faint `ring-border/60` is kept underneath for definition when
  the shadow alone isn't enough (e.g. print, forced-colors).

## Component layers

1. **`src/components/ui/*`** — shadcn/Base UI primitives (Button, Card,
   Dialog, Select, …). These are the base building blocks. Restyle *here*
   (via the token-backed classes above) rather than overriding styles at
   every call site or forking a one-off variant.
2. **`src/components/layout/*`** — the app shell: `AppSidebar` (desktop nav,
   hidden below `md`), `MobileNav` (fixed bottom tab bar, `md:hidden`),
   `AppTopbar` (page title derived from the route + account menu).
   `nav-links.ts` is the single source of truth for nav destinations — add a
   page to navigation by editing that file only, both sidebar and bottom bar
   read from it.
3. **`src/components/*`** (root) — reusable feature components: `StatCard`,
   `HeroSummaryCard`, `TransactionList`, `Sparkline`, `BreakdownChart`,
   the various dialogs. Check here before writing a new one-off pattern —
   e.g. any new list-of-money-rows should extend `TransactionList`, not
   spawn another table.

## Responsive rules — mobile is a first-class target

- Default to a single column (`grid-cols-1`); widen at `sm:`/`lg:`. Never
  assume desktop width first.
- The sidebar (`AppSidebar`) only renders `md:flex` and up. Below that,
  navigation is the fixed `MobileNav` bottom bar — main content has
  `pb-24` on mobile (`(app)/layout.tsx`) so it never sits under the bar.
- Dialogs, selects, and forms already come from `src/components/ui` and are
  touch-friendly by default (Base UI) — don't add hover-only interactions
  for anything a mobile user needs to trigger.
- Test any new page/component at a narrow viewport before considering it
  done, not just desktop.

## Charts

Follow the `dataviz` skill for anything chart-shaped. The categorical
palette (`--chart-1`…`--chart-5` in `globals.css`) is already validated for
colorblind-safety against both the light and dark card surfaces — don't
change those five hex values without re-running
`scripts/validate_palette.js` from the skill. Categorical chart colors and
the brand primary/violet are two separate systems: brand color marks "this
is Ledgr's UI chrome", chart colors mark "this is a data series" — never
reuse one for the other, and cap categorical series at 5 (fold extras into
"Other").

## Icons

`lucide-react` only. Stick to the sizes already in use: `size-4` (inline,
default), `size-4.5` (nav/list icons), `size-5` (bottom-nav). `strokeWidth`
2 by default, 2.5 for an active/selected state (see `MobileNav`).

## Sheet vs Dialog

`src/components/ui/sheet.tsx` is the same Base UI `Dialog` primitive as
`dialog.tsx`, restyled: a bottom sheet on mobile that becomes a right-side
panel from `sm:` up (anchor edge changes at the breakpoint — a right panel
has nowhere to slide from on a narrow screen, so it isn't just a resize).
Use **Sheet** for record-editing forms where the underlying list is useful
context (add/edit transaction — see `edit-transaction-dialog.tsx`). Use the
centered **Dialog** for short, focused actions unrelated to a background
list (confirmations, account settings). Both share the same API shape
(`Header`/`Title`/`Footer`/`Trigger`/`Close`); the form inside a Sheet
should be `flex flex-1 flex-col` so `SheetFooter`'s `mt-auto` pins it to
the bottom instead of it trailing after a short field list.

## Base UI `render` prop (not `asChild`)

This shadcn setup is on Base UI, not Radix — there is no `asChild` prop.
To render a trigger/button as a different element (e.g. a `Button` as a
`Link`), use `render`:

```tsx
<Button render={<Link href="/accounts" />}>Go to accounts</Button>
```

If the target isn't a real `<button>` (an `<a>`/`Link`), also pass
`nativeButton={false}` or Base UI will warn about lost button semantics.
`Select` needs an explicit `items={{ value: label }}` map for `<SelectValue>`
to show the right label before the popup has ever been opened — see any
existing `Select` usage for the pattern.
