-- Migration: property_snapshots
-- Service Hub Phase 3, Pass 3.1 — Visuals tab cache table
--
-- Purpose: Cache aggregated PropertyData (Adam → ATTOM + Apify Zillow
-- photos, plus Google Address Validation / Geocoding / Solar) per
-- (suite_id, address) for 24h. Subsequent /api/service-hub/property-data
-- calls within the TTL hit the cache and skip all upstream APIs
-- (saves Apify tokens + ATTOM calls; <100ms response).
--
-- Risk Tier: GREEN — read-only enrichment cache, no PII columns.
-- Idempotency: IF NOT EXISTS guards make this safe to re-apply.
-- TTL enforcement: query-time filter `fetched_at > now() - make_interval(hours => 24)`
-- in propertyAggregator.ts:readCache (no generated column — Postgres rejected
-- `interval '24 hours'` as non-immutable in a generated expression).
--
-- Tenant scoping convention matches existing Aspire tables — suite_id is
-- the canonical multi-tenant key (sourced from JWT claims request.jwt.claims).
-- Service role bypasses RLS (used by server-side aggregator that already
-- enforces suite_id from the authenticated request).
--
-- Applied to production: 2026-05-10 via mcp__supabase__apply_migration.

-- UP -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.property_snapshots (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    suite_id    UUID         NOT NULL,
    address     TEXT         NOT NULL,
    data_jsonb  JSONB        NOT NULL,
    fetched_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.property_snapshots IS
    'Service Hub Visuals tab cache. One row per (suite_id, address, fetched_at). '
    '24h TTL enforced at query time. Tenant-scoped via RLS.';

COMMENT ON COLUMN public.property_snapshots.data_jsonb IS
    'PropertyData payload from server/serviceHub/property/propertyAggregator.ts. '
    'Photo URLs from Apify Zillow + Street View proxy. No PII fields.';

CREATE INDEX IF NOT EXISTS idx_property_snapshots_suite_address
    ON public.property_snapshots (suite_id, address, fetched_at DESC);

CREATE INDEX IF NOT EXISTS idx_property_snapshots_fetched_at
    ON public.property_snapshots (fetched_at);

-- RLS ------------------------------------------------------------------------

ALTER TABLE public.property_snapshots ENABLE ROW LEVEL SECURITY;

-- Service role bypass (server-side aggregator uses the service role; the
-- aggregator already enforces suite_id from the authenticated request).
CREATE POLICY property_snapshots_service_role
    ON public.property_snapshots
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Authenticated users may only see their own suite's rows.
CREATE POLICY property_snapshots_authenticated_select
    ON public.property_snapshots
    FOR SELECT
    TO authenticated
    USING (
        suite_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'suite_id')::uuid
    );

CREATE POLICY property_snapshots_authenticated_insert
    ON public.property_snapshots
    FOR INSERT
    TO authenticated
    WITH CHECK (
        suite_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'suite_id')::uuid
    );

CREATE POLICY property_snapshots_authenticated_delete
    ON public.property_snapshots
    FOR DELETE
    TO authenticated
    USING (
        suite_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'suite_id')::uuid
    );

-- DOWN -----------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.property_snapshots;
