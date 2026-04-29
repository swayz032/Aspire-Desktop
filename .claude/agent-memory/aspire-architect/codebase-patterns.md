---
name: Codebase Patterns
description: RLS conventions, trigger patterns, HNSW tuning, migration file style for Aspire backend
type: project
---

## RLS Pattern (canonical)
All new tables use this triple:
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. `ALTER TABLE ... FORCE ROW LEVEL SECURITY;`
3. Tenant SELECT: `USING (app.is_member(tenant_id::text))` — note tenant_id is UUID in new tables but app.is_member takes TEXT; cast required
4. Service role bypass: `FOR ALL TO service_role USING (true) WITH CHECK (true)`
5. INSERT check: subquery against `tenant_memberships` + `public.current_suite_id()`
6. No DELETE policy = deny (FORCE RLS default)

## app.is_member signature
`app.is_member(p_tenant_id TEXT) RETURNS boolean` — checks tenant_memberships where user_id = auth.uid()
Defined in: `backend/supabase/migrations/20260210000001_trust_spine_bundle.sql`

## Helper functions (mig 052)
- `public.current_suite_id()` — reads `app.current_suite_id` setting, returns UUID or NULL
- `public.current_office_id()` — reads `app.current_office_id` setting

## HNSW parameters (mig 078 — production tuned)
- `m = 24, ef_construction = 128` (upgraded from 16/64 in mig 078)
- At query time: `SET LOCAL hnsw.ef_search = 100` for best recall
- Vector dimension: 3072 (text-embedding-3-large)

## tsvector pattern (mig 076)
`GENERATED ALWAYS AS (to_tsvector('english', coalesce(col1,'') || ' ' || coalesce(col2,''))) STORED`
Index: `USING GIN (tsv_column)`

## Migration file style (mig 093 is most recent)
- Comment header: `-- Migration NNN: Title`
- Numbered sections with `===` banners
- `IF NOT EXISTS` guards on all CREATE INDEX
- `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`
- `CREATE OR REPLACE FUNCTION` for all functions
- Grants at end: `GRANT SELECT, INSERT, UPDATE TO authenticated; GRANT ALL TO service_role;`

## Tenant ID types (CRITICAL)
- Old tables (trust_spine_bundle): tenant_id is TEXT
- New tables (mig 052+): tenant_id is UUID
- app.is_member() takes TEXT — always cast: `app.is_member(tenant_id::text)`

**Why:** trust_spine_bundle predates the UUID migration. New tables use UUID for type safety.
**How to apply:** Always check the PK type of the referenced table before writing FKs.
