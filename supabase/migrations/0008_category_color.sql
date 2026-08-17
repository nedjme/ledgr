-- A manual override for the auto-assigned (hash-of-id) category color.
-- Constrained to an index into the validated 5-slot categorical palette
-- (src/lib/category-color.ts) rather than a free hex value, so a manual
-- pick can't produce a combination that fails the colorblind-safety
-- validation the palette was chosen for.
alter table categories add column color_slot smallint
  check (color_slot >= 0 and color_slot <= 4);
