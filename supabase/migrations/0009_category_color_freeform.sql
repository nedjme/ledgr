-- Superseded by a free-form color picker: color_slot only allowed an index
-- into the validated 5-hue categorical palette. The user opted into full
-- hex freedom instead, accepting that unvalidated combinations may be less
-- colorblind-friendly when several manually-colored categories share a
-- chart. Categories without a manual color still fall back to the
-- validated 5-hue hash-of-id assignment (src/lib/category-color.ts).
alter table categories drop column color_slot;
alter table categories add column color text check (color ~ '^#[0-9a-fA-F]{6}$');
