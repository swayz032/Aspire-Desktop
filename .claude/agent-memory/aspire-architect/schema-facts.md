---
name: Schema Facts
description: Critical PK types, table locations, and extension state for Aspire Supabase schema
type: project
---

## approval_requests table
- Defined in: `backend/supabase/migrations/20260210000001_trust_spine_bundle.sql` (line 148)
- PK: `approval_id TEXT PRIMARY KEY` (NOT UUID)
- tenant_id: TEXT (references tenants.tenant_id which is TEXT)
- RLS added in: `backend/infrastructure/supabase/migrations/074_approval_requests_rls.sql`
- Migration 054 is a no-op verify (table created by orchestrator)
- FK rule: any table referencing approval_requests must use TEXT column

## receipts table
- Defined in: `backend/supabase/migrations/20260210000001_trust_spine_bundle.sql` (line 1098)
- PK: `receipt_id TEXT PRIMARY KEY DEFAULT encode(gen_random_bytes(16), 'hex')`
- suite_id: UUID, tenant_id: TEXT, office_id: UUID
- Partitioned version in mig 077 (receipts_partitioned) — NOT yet swapped
- FK rule: any table referencing receipts must use TEXT column for receipt_id

## pgvector extension
- Enabled since mig 066 (general_knowledge_base). Idempotent `CREATE EXTENSION IF NOT EXISTS pgvector` is safe.

## pg_trgm extension
- Enabled in mig 076. Used for GIN trigram indexes.

## pg_cron
- Available in Supabase (enabled per supabase-full-potential-audit.md)
- Used in mig 088+ for scheduled jobs

## Migration sequence
- Last applied: 093_join_code_display_name.sql
- Next available: 094, 095, 096
- Infrastructure path: `backend/infrastructure/supabase/migrations/`
- Trust spine path: `backend/supabase/migrations/` (separate — orchestrator-owned)
