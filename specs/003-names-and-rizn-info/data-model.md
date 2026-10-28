# Data Model: First Names and RIZN Youth Info

## `passes.first_name` (new, nullable)

```sql
ALTER TABLE passes ADD COLUMN first_name text;
ALTER TABLE passes ADD CONSTRAINT passes_first_name_len
  CHECK (first_name IS NULL OR char_length(first_name) BETWEEN 1 AND 20);
```

- Only crew set it, through entry create and edit, and only for passes linked to that entry.
- Shape: one given name. Letters, with internal `-`, `'`, or `’` allowed. The full rule is
  enforced in the app (FR-202). The database checks the length.
- It is cleared when the entry is removed (FR-205). It is deleted with the pass by the purge and
  the rehearsal wipe.
- Display rule: `coalesce(first_name, nickname)` per linked pass, joined with " & ".
- Audit records only pass ids (`firstNamesSet` and `firstNamesCleared`), never the name.

No other schema changes. The RIZN page is static content.
