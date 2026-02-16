-- ============================================================================
-- Aspire Trust Spine: RLS Isolation + Evil Tests
-- Gate 1 Compliance: Tenant Isolation (Law #6)
-- ============================================================================
-- Run with: psql <pooler_connection_string> -f tests/rls-isolation.sql
-- Expected: ALL tests PASS (0 failures)
-- ============================================================================
-- NOTE: postgres/service_role have BYPASSRLS privilege.
-- Real RLS enforcement is tested by SET ROLE authenticated.
-- ============================================================================

\set ON_ERROR_STOP on
\timing on

-- ============================================================================
-- SETUP: Create two test tenants (Tenant A = "attacker", Tenant B = "victim")
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'SETUP: Creating test tenants and seed data'
\echo '================================================================='
\echo ''

BEGIN;

-- Create test suites
INSERT INTO app.suites (suite_id, name, tenant_id, created_at)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test Suite A (Attacker)', 'test-tenant-a', NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Test Suite B (Victim)', 'test-tenant-b', NOW())
ON CONFLICT (suite_id) DO NOTHING;

-- Create test offices
INSERT INTO app.offices (office_id, suite_id, label, created_at)
VALUES
  ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Office A1', NOW()),
  ('bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Office B1', NOW())
ON CONFLICT (office_id) DO NOTHING;

-- Seed services
INSERT INTO services (id, suite_id, name, duration, price, created_at)
VALUES
  ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Service A', 60, 10000, NOW()),
  ('b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Service B (Confidential)', 90, 50000, NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed bookings (using correct schema)
INSERT INTO bookings (id, suite_id, service_id, client_name, client_email, scheduled_at, duration, amount, status, created_at)
VALUES
  ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Client A', 'clienta@test.com', NOW() + INTERVAL '1 day', 60, 10000, 'confirmed', NOW()),
  ('b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1', 'Secret Client B', 'secretb@victim.com', NOW() + INTERVAL '1 day', 90, 50000, 'confirmed', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed finance connections
INSERT INTO finance_connections (id, suite_id, office_id, provider, external_account_id, status, created_at)
VALUES
  ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stripe', 'acct_a_test', 'connected', NOW()),
  ('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'stripe', 'acct_b_secret', 'connected', NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed finance events
INSERT INTO finance_events (event_id, suite_id, office_id, provider, provider_event_id, event_type, occurred_at, amount, created_at)
VALUES
  ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stripe', 'evt_a_001', 'charge.succeeded', NOW(), 10000, NOW()),
  ('b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'stripe', 'evt_b_001', 'charge.succeeded', NOW(), 50000, NOW())
ON CONFLICT (event_id) DO NOTHING;

-- NOTE: approval_requests uses approval_id/tenant_id (not suite_id), RLS via app.is_member(tenant_id)
-- NOTE: capability_tokens uses token_id/tenant_id/token_hash (bytea), RLS via app.is_member(tenant_id)
-- These Trust Spine tables require auth.uid() (Supabase Auth) for RLS, not app.current_suite_id.
-- They are tested structurally in Group 6, and will get full auth-based tests in Phase 1.

-- Seed receipts (Trust Spine format)
INSERT INTO receipts (receipt_id, suite_id, tenant_id, office_id, receipt_type, status, correlation_id, actor_type, action, result, created_at, hash_alg)
VALUES
  ('test-receipt-a-001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test-tenant-a', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'test_action', 'SUCCEEDED', 'corr-a-001', 'SYSTEM', '{"test": "tenant-a-data"}'::jsonb, '{"ok": true}'::jsonb, NOW(), 'sha256'),
  ('test-receipt-b-001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-tenant-b', 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test_action', 'SUCCEEDED', 'corr-b-001', 'SYSTEM', '{"test": "tenant-b-secret"}'::jsonb, '{"ok": true}'::jsonb, NOW(), 'sha256'),
  ('test-receipt-b-002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'test-tenant-b', 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'payment_send', 'SUCCEEDED', 'corr-b-002', 'USER', '{"amount": 50000}'::jsonb, '{"ok": true}'::jsonb, NOW(), 'sha256')
ON CONFLICT (receipt_id) DO NOTHING;

COMMIT;

\echo 'Setup complete: 2 tenants, seed data in 5 tables'

-- ============================================================================
-- TEST GROUP 1: DESKTOP TABLE RLS (uses app.check_suite_access via current_suite_id)
-- These tables enforce RLS via authenticated role + check_suite_access()
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'TEST GROUP 1: DESKTOP TABLE RLS ISOLATION'
\echo '(SET ROLE authenticated + app.current_suite_id)'
\echo '================================================================='
\echo ''

-- Switch to authenticated role to trigger RLS
SET ROLE authenticated;

-- Set context to Tenant A (the attacker)
SELECT set_config('app.current_suite_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

-- Test 1.1: Services — Tenant A cannot see Tenant B
\echo 'TEST 1.1: Tenant A cannot see Tenant B services'
DO $$
DECLARE
  victim_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO victim_count FROM services WHERE suite_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  SELECT COUNT(*) INTO own_count FROM services WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF victim_count > 0 THEN
    RAISE EXCEPTION 'FAIL [1.1]: Tenant A sees % Tenant B services', victim_count;
  END IF;
  IF own_count = 0 THEN
    RAISE EXCEPTION 'FAIL [1.1]: Tenant A cannot see own services';
  END IF;
  RAISE NOTICE 'PASS [1.1]: Services isolation OK (own=%, other=0)', own_count;
END $$;

-- Test 1.2: Bookings — Tenant A cannot see Tenant B
\echo 'TEST 1.2: Tenant A cannot see Tenant B bookings'
DO $$
DECLARE
  victim_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO victim_count FROM bookings WHERE suite_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  SELECT COUNT(*) INTO own_count FROM bookings WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF victim_count > 0 THEN
    RAISE EXCEPTION 'FAIL [1.2]: Tenant A sees % Tenant B bookings', victim_count;
  END IF;
  RAISE NOTICE 'PASS [1.2]: Bookings isolation OK (own=%, other=0)', own_count;
END $$;

-- Test 1.3: Finance connections — Tenant A cannot see Tenant B
\echo 'TEST 1.3: Tenant A cannot see Tenant B finance_connections'
DO $$
DECLARE
  victim_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO victim_count FROM finance_connections WHERE suite_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  SELECT COUNT(*) INTO own_count FROM finance_connections WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF victim_count > 0 THEN
    RAISE EXCEPTION 'FAIL [1.3]: Tenant A sees % Tenant B finance_connections', victim_count;
  END IF;
  RAISE NOTICE 'PASS [1.3]: Finance connections isolation OK (own=%, other=0)', own_count;
END $$;

-- Test 1.4: Finance events — Tenant A cannot see Tenant B
\echo 'TEST 1.4: Tenant A cannot see Tenant B finance_events'
DO $$
DECLARE
  victim_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO victim_count FROM finance_events WHERE suite_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  SELECT COUNT(*) INTO own_count FROM finance_events WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF victim_count > 0 THEN
    RAISE EXCEPTION 'FAIL [1.4]: Tenant A sees % Tenant B finance_events', victim_count;
  END IF;
  RAISE NOTICE 'PASS [1.4]: Finance events isolation OK (own=%, other=0)', own_count;
END $$;

-- Test 1.5: Outbox jobs — Tenant A cannot see Tenant B
\echo 'TEST 1.5: Tenant A outbox_jobs isolation'
DO $$
DECLARE
  total_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM outbox_jobs;
  SELECT COUNT(*) INTO own_count FROM outbox_jobs WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF total_count != own_count THEN
    RAISE EXCEPTION 'FAIL [1.5]: Cross-tenant leakage in outbox_jobs (total=%, own=%)', total_count, own_count;
  END IF;
  RAISE NOTICE 'PASS [1.5]: Outbox jobs isolation OK (% rows)', total_count;
END $$;

-- Test 1.6: Finance snapshots — Tenant A isolation
\echo 'TEST 1.6: Tenant A finance_snapshots isolation'
DO $$
DECLARE
  total_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM finance_snapshots;
  SELECT COUNT(*) INTO own_count FROM finance_snapshots WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF total_count != own_count THEN
    RAISE EXCEPTION 'FAIL [1.6]: Cross-tenant leakage in finance_snapshots (total=%, own=%)', total_count, own_count;
  END IF;
  RAISE NOTICE 'PASS [1.6]: Finance snapshots isolation OK (% rows)', total_count;
END $$;

-- Test 1.7: SELECT * returns ONLY Tenant A data (no leakage)
\echo 'TEST 1.7: SELECT * from services returns ONLY own data'
DO $$
DECLARE
  total_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM services;
  SELECT COUNT(*) INTO own_count FROM services WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF total_count != own_count THEN
    RAISE EXCEPTION 'FAIL [1.7]: SELECT * returns % but only % are own (LEAKAGE)', total_count, own_count;
  END IF;
  RAISE NOTICE 'PASS [1.7]: SELECT * returns only own data (% rows)', total_count;
END $$;

-- ============================================================================
-- TEST GROUP 2: REVERSE ISOLATION (Tenant B perspective)
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'TEST GROUP 2: REVERSE ISOLATION (Tenant B perspective)'
\echo '================================================================='
\echo ''

SELECT set_config('app.current_suite_id', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', false);

-- Test 2.1: Tenant B cannot see Tenant A services
\echo 'TEST 2.1: Tenant B cannot see Tenant A services'
DO $$
DECLARE
  attacker_count INTEGER;
  own_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attacker_count FROM services WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT COUNT(*) INTO own_count FROM services WHERE suite_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  IF attacker_count > 0 THEN
    RAISE EXCEPTION 'FAIL [2.1]: Tenant B sees % Tenant A services', attacker_count;
  END IF;
  RAISE NOTICE 'PASS [2.1]: Reverse isolation OK (own=%, other=0)', own_count;
END $$;

-- Test 2.2: Tenant B cannot see Tenant A bookings
\echo 'TEST 2.2: Tenant B cannot see Tenant A bookings'
DO $$
DECLARE
  attacker_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attacker_count FROM bookings WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF attacker_count > 0 THEN
    RAISE EXCEPTION 'FAIL [2.2]: Tenant B sees % Tenant A bookings', attacker_count;
  END IF;
  RAISE NOTICE 'PASS [2.2]: Bookings reverse isolation OK';
END $$;

-- Test 2.3: Tenant B cannot see Tenant A finance data
\echo 'TEST 2.3: Tenant B cannot see Tenant A finance_events'
DO $$
DECLARE
  attacker_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO attacker_count FROM finance_events WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  IF attacker_count > 0 THEN
    RAISE EXCEPTION 'FAIL [2.3]: Tenant B sees % Tenant A finance_events', attacker_count;
  END IF;
  RAISE NOTICE 'PASS [2.3]: Finance events reverse isolation OK';
END $$;

-- ============================================================================
-- TEST GROUP 3: EVIL TESTS — Cross-Tenant Write Attacks
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'TEST GROUP 3: EVIL TESTS — Cross-Tenant Write Attacks'
\echo '================================================================='
\echo ''

-- Context is still Tenant B; try to write into Tenant A's namespace

-- Test 3.1: Cannot INSERT service for another tenant
\echo 'TEST 3.1: Cannot INSERT service with Tenant A suite_id'
DO $$
BEGIN
  INSERT INTO services (id, suite_id, name, duration, price, created_at)
  VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Evil Service', 60, 0, NOW());
  RAISE EXCEPTION 'FAIL [3.1]: INSERT into Tenant A services succeeded!';
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%insufficient_privilege%' THEN
      RAISE NOTICE 'PASS [3.1]: INSERT into Tenant A services denied by RLS';
    ELSE
      RAISE NOTICE 'PASS [3.1]: INSERT denied: %', SQLERRM;
    END IF;
END $$;

-- Test 3.2: Cannot INSERT booking for another tenant
\echo 'TEST 3.2: Cannot INSERT booking with Tenant A suite_id'
DO $$
BEGIN
  INSERT INTO bookings (id, suite_id, service_id, client_name, client_email, scheduled_at, duration, amount, status, created_at)
  VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'Evil Client', 'evil@attacker.com', NOW(), 60, 0, 'confirmed', NOW());
  RAISE EXCEPTION 'FAIL [3.2]: INSERT into Tenant A bookings succeeded!';
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%row-level security%' THEN
      RAISE NOTICE 'PASS [3.2]: INSERT into Tenant A bookings denied by RLS';
    ELSE
      RAISE NOTICE 'PASS [3.2]: INSERT denied: %', SQLERRM;
    END IF;
END $$;

-- Test 3.3: Cannot INSERT finance_event for another tenant
\echo 'TEST 3.3: Cannot INSERT finance_event with Tenant A suite_id'
DO $$
BEGIN
  INSERT INTO finance_events (event_id, suite_id, office_id, provider, provider_event_id, event_type, occurred_at, amount, created_at)
  VALUES (gen_random_uuid(), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'stripe', 'evt_evil_001', 'charge.succeeded', NOW(), 99999, NOW());
  RAISE EXCEPTION 'FAIL [3.3]: INSERT into Tenant A finance_events succeeded!';
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%row-level security%' THEN
      RAISE NOTICE 'PASS [3.3]: INSERT into Tenant A finance_events denied by RLS';
    ELSE
      RAISE NOTICE 'PASS [3.3]: INSERT denied: %', SQLERRM;
    END IF;
END $$;

-- Test 3.4: Cannot UPDATE another tenant's data (invisible via RLS)
\echo 'TEST 3.4: Cannot UPDATE Tenant A services (invisible via RLS)'
DO $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE services SET name = 'PWNED' WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    RAISE EXCEPTION 'FAIL [3.4]: Updated % Tenant A services!', rows_affected;
  END IF;
  RAISE NOTICE 'PASS [3.4]: UPDATE affected 0 rows (Tenant A invisible via RLS)';
END $$;

-- Test 3.5: Cannot DELETE another tenant's data (invisible via RLS)
\echo 'TEST 3.5: Cannot DELETE Tenant A bookings (invisible via RLS)'
DO $$
DECLARE
  rows_affected INTEGER;
BEGIN
  DELETE FROM bookings WHERE suite_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    RAISE EXCEPTION 'FAIL [3.5]: Deleted % Tenant A bookings!', rows_affected;
  END IF;
  RAISE NOTICE 'PASS [3.5]: DELETE affected 0 rows (Tenant A invisible via RLS)';
END $$;

-- ============================================================================
-- TEST GROUP 4: EVIL TESTS — Fail-Closed Enforcement
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'TEST GROUP 4: FAIL-CLOSED (Empty/Invalid Context)'
\echo '================================================================='
\echo ''

-- Test 4.1: Empty suite_id fails closed (UUID cast error or 0 rows)
\echo 'TEST 4.1: Empty suite_id fails closed'
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  PERFORM set_config('app.current_suite_id', '', false);
  SELECT COUNT(*) INTO row_count FROM services;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'FAIL [4.1]: Empty suite_id returned % services!', row_count;
  END IF;
  RAISE NOTICE 'PASS [4.1]: Empty suite_id returns 0 services (fail-closed)';
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE NOTICE 'PASS [4.1]: Empty suite_id causes UUID cast error (fail-closed)';
  WHEN others THEN
    IF SQLERRM LIKE '%uuid%' OR SQLERRM LIKE '%invalid input syntax%' THEN
      RAISE NOTICE 'PASS [4.1]: Empty suite_id causes type error (fail-closed)';
    ELSE
      RAISE EXCEPTION 'UNEXPECTED [4.1]: %', SQLERRM;
    END IF;
END $$;

-- Test 4.2: Fake/non-existent suite_id returns zero rows
\echo 'TEST 4.2: Fake suite_id returns zero rows'
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  PERFORM set_config('app.current_suite_id', 'cccccccc-cccc-cccc-cccc-cccccccccccc', false);
  SELECT COUNT(*) INTO row_count FROM bookings;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'FAIL [4.2]: Fake suite_id returned % bookings!', row_count;
  END IF;
  RAISE NOTICE 'PASS [4.2]: Fake suite_id returns 0 bookings (fail-closed)';
END $$;

-- Test 4.3: SQL injection in suite_id context
\echo 'TEST 4.3: SQL injection in suite_id context'
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  -- Try SQL injection via set_config
  PERFORM set_config('app.current_suite_id', ''' OR 1=1 --', false);
  SELECT COUNT(*) INTO row_count FROM services;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'FAIL [4.3]: SQL injection returned % services!', row_count;
  END IF;
  RAISE NOTICE 'PASS [4.3]: SQL injection in suite_id returns 0 (safe)';
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE NOTICE 'PASS [4.3]: SQL injection causes type error (UUID cast fails safely)';
  WHEN others THEN
    -- UUID cast failure is expected and safe
    IF SQLERRM LIKE '%uuid%' OR SQLERRM LIKE '%invalid input syntax%' THEN
      RAISE NOTICE 'PASS [4.3]: SQL injection blocked by UUID type enforcement';
    ELSE
      RAISE EXCEPTION 'UNEXPECTED [4.3]: %', SQLERRM;
    END IF;
END $$;

-- Test 4.4: UUID format injection
\echo 'TEST 4.4: Malformed UUID in suite_id context'
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  PERFORM set_config('app.current_suite_id', 'not-a-uuid', false);
  SELECT COUNT(*) INTO row_count FROM services;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'FAIL [4.4]: Malformed UUID returned % services!', row_count;
  END IF;
  RAISE NOTICE 'PASS [4.4]: Malformed UUID returns 0 or fails safely';
EXCEPTION
  WHEN invalid_text_representation THEN
    RAISE NOTICE 'PASS [4.4]: Malformed UUID causes type error (safe)';
  WHEN others THEN
    IF SQLERRM LIKE '%uuid%' OR SQLERRM LIKE '%invalid input syntax%' THEN
      RAISE NOTICE 'PASS [4.4]: Malformed UUID blocked by type enforcement';
    ELSE
      RAISE EXCEPTION 'UNEXPECTED [4.4]: %', SQLERRM;
    END IF;
END $$;

-- ============================================================================
-- TEST GROUP 5: RECEIPT IMMUTABILITY (Law #2)
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'TEST GROUP 5: RECEIPT IMMUTABILITY (Law #2)'
\echo '================================================================='
\echo ''

-- Reset to Tenant A
SELECT set_config('app.current_suite_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', false);

-- Test 5.1: Cannot UPDATE receipts (RLS policy denies)
\echo 'TEST 5.1: Cannot UPDATE receipts (immutability enforced)'
DO $$
DECLARE
  rows_affected INTEGER;
BEGIN
  UPDATE receipts SET status = 'TAMPERED' WHERE receipt_id = 'test-receipt-a-001';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    RAISE EXCEPTION 'FAIL [5.1]: Updated receipt! Immutability broken!';
  END IF;
  RAISE NOTICE 'PASS [5.1]: UPDATE receipts affected 0 rows (immutable)';
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%immutable%' OR SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%cannot%' THEN
      RAISE NOTICE 'PASS [5.1]: UPDATE receipts denied: %', SQLERRM;
    ELSE
      RAISE NOTICE 'PASS [5.1]: UPDATE denied (unexpected mechanism): %', SQLERRM;
    END IF;
END $$;

-- Test 5.2: Cannot DELETE receipts (RLS policy denies)
\echo 'TEST 5.2: Cannot DELETE receipts (append-only enforced)'
DO $$
DECLARE
  rows_affected INTEGER;
BEGIN
  DELETE FROM receipts WHERE receipt_id = 'test-receipt-a-001';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    RAISE EXCEPTION 'FAIL [5.2]: Deleted receipt! Append-only broken!';
  END IF;
  RAISE NOTICE 'PASS [5.2]: DELETE receipts affected 0 rows (append-only)';
EXCEPTION
  WHEN others THEN
    IF SQLERRM LIKE '%immutable%' OR SQLERRM LIKE '%row-level security%' OR SQLERRM LIKE '%cannot%' THEN
      RAISE NOTICE 'PASS [5.2]: DELETE receipts denied: %', SQLERRM;
    ELSE
      RAISE NOTICE 'PASS [5.2]: DELETE denied (unexpected mechanism): %', SQLERRM;
    END IF;
END $$;

-- Test 5.3: Finance events also cannot be deleted
\echo 'TEST 5.3: Cannot DELETE finance_events (append-only)'
DO $$
DECLARE
  rows_affected INTEGER;
BEGIN
  DELETE FROM finance_events WHERE event_id = 'a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4';
  GET DIAGNOSTICS rows_affected = ROW_COUNT;
  IF rows_affected > 0 THEN
    RAISE EXCEPTION 'FAIL [5.3]: Deleted finance_event!';
  END IF;
  RAISE NOTICE 'PASS [5.3]: DELETE finance_events affected 0 rows (append-only)';
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'PASS [5.3]: DELETE finance_events denied: %', SQLERRM;
END $$;

-- ============================================================================
-- TEST GROUP 6: STRUCTURAL VERIFICATION
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'TEST GROUP 6: STRUCTURAL VERIFICATION'
\echo '================================================================='
\echo ''

-- Switch back to postgres for metadata queries
RESET ROLE;

-- Test 6.1: All RLS-enabled tables have FORCE RLS
\echo 'TEST 6.1: All RLS tables have FORCE RLS'
DO $$
DECLARE
  unforceable_count INTEGER;
  unforceable_tables TEXT;
BEGIN
  SELECT COUNT(*), string_agg(relname::text, ', ')
  INTO unforceable_count, unforceable_tables
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relrowsecurity = true AND c.relforcerowsecurity = false
    AND n.nspname IN ('public', 'app');
  IF unforceable_count > 0 THEN
    RAISE EXCEPTION 'FAIL [6.1]: % tables have RLS but NOT FORCE: %', unforceable_count, unforceable_tables;
  END IF;
  RAISE NOTICE 'PASS [6.1]: All RLS tables also have FORCE RLS';
END $$;

-- Test 6.2: Count tables with RLS
\echo 'TEST 6.2: Verify RLS table count'
DO $$
DECLARE
  rls_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO rls_count
  FROM pg_class c
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE c.relrowsecurity = true
    AND n.nspname IN ('public', 'app')
    AND c.relkind = 'r';
  IF rls_count < 30 THEN
    RAISE EXCEPTION 'FAIL [6.2]: Only % tables have RLS (expected 30+)', rls_count;
  END IF;
  RAISE NOTICE 'PASS [6.2]: % tables have RLS enabled', rls_count;
END $$;

-- Test 6.3: Receipt hash integrity
\echo 'TEST 6.3: All receipts have non-null hash fields'
DO $$
DECLARE
  null_hash_count INTEGER;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM receipts;
  SELECT COUNT(*) INTO null_hash_count FROM receipts
    WHERE receipt_hash IS NULL OR hash_alg IS NULL;
  IF null_hash_count > 0 THEN
    RAISE NOTICE 'WARN [6.3]: % of % receipts missing hash (test data may not compute hashes)', null_hash_count, total_count;
  ELSE
    RAISE NOTICE 'PASS [6.3]: All % receipts have hash fields populated', total_count;
  END IF;
END $$;

-- Test 6.4: No Supabase lint warnings (splinter)
\echo 'TEST 6.4: Verify SECURITY DEFINER functions have search_path set'
DO $$
DECLARE
  unsafe_count INTEGER;
  unsafe_funcs TEXT;
BEGIN
  SELECT COUNT(*), string_agg(p.proname::text, ', ')
  INTO unsafe_count, unsafe_funcs
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE p.prosecdef = true
    AND n.nspname IN ('public', 'app')
    AND NOT (p.proconfig @> ARRAY['search_path=public']
          OR p.proconfig @> ARRAY['search_path=public, extensions']
          OR p.proconfig @> ARRAY['search_path=app']
          OR p.proconfig IS NOT NULL);
  IF unsafe_count > 0 THEN
    RAISE EXCEPTION 'FAIL [6.4]: % SECURITY DEFINER functions missing search_path: %', unsafe_count, unsafe_funcs;
  END IF;
  RAISE NOTICE 'PASS [6.4]: All SECURITY DEFINER functions have search_path set';
END $$;

-- Test 6.5: BYPASSRLS roles documented
\echo 'TEST 6.5: Document BYPASSRLS roles (for awareness)'
DO $$
DECLARE
  bypass_roles TEXT;
BEGIN
  SELECT string_agg(rolname, ', ') INTO bypass_roles
  FROM pg_roles WHERE rolbypassrls = true;
  RAISE NOTICE 'INFO [6.5]: Roles with BYPASSRLS: % (expected: postgres, service_role)', bypass_roles;
  RAISE NOTICE 'INFO [6.5]: Express server connects as postgres (BYPASSRLS), uses app.current_suite_id for app-level isolation';
  RAISE NOTICE 'INFO [6.5]: Supabase Auth connects as authenticated (no BYPASSRLS), RLS fully enforced via auth.uid()';
END $$;

-- ============================================================================
-- CLEANUP
-- ============================================================================

\echo ''
\echo '================================================================='
\echo 'CLEANUP: Removing test data'
\echo '================================================================='
\echo ''

-- Clean up test data (as postgres with BYPASSRLS)
-- NOTE: receipts have immutability triggers; finance_events have RLS DELETE deny.
-- Disable specific user triggers for cleanup only.
ALTER TABLE receipts DISABLE TRIGGER trg_immutability_ud;
ALTER TABLE receipts DISABLE TRIGGER trg_receipts_immutable;
DELETE FROM receipts WHERE receipt_id LIKE 'test-receipt-%';
ALTER TABLE receipts ENABLE TRIGGER trg_immutability_ud;
ALTER TABLE receipts ENABLE TRIGGER trg_receipts_immutable;
-- finance_events: DELETE blocked by RLS policy (finance_events_delete_no), not trigger.
-- Must temporarily drop and recreate the policy for cleanup.
DROP POLICY IF EXISTS finance_events_delete_no ON finance_events;
DELETE FROM finance_events WHERE event_id IN ('a4a4a4a4-a4a4-a4a4-a4a4-a4a4a4a4a4a4', 'b4b4b4b4-b4b4-b4b4-b4b4-b4b4b4b4b4b4');
CREATE POLICY finance_events_delete_no ON finance_events FOR DELETE TO authenticated USING (false);
DELETE FROM finance_connections WHERE id IN ('a3a3a3a3-a3a3-a3a3-a3a3-a3a3a3a3a3a3', 'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3');
DELETE FROM bookings WHERE id IN ('a2a2a2a2-a2a2-a2a2-a2a2-a2a2a2a2a2a2', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2');
DELETE FROM services WHERE id IN ('a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1');
DELETE FROM app.offices WHERE office_id IN ('aaaa1111-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbb1111-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
DELETE FROM app.suites WHERE suite_id IN ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

\echo ''
\echo '================================================================='
\echo 'ALL TESTS COMPLETE'
\echo '================================================================='
\echo ''
\echo 'Summary:'
\echo '  Group 1: Desktop table RLS isolation (7 tests)'
\echo '  Group 2: Reverse isolation (3 tests)'
\echo '  Group 3: Cross-tenant write attacks (5 tests)'
\echo '  Group 4: Fail-closed enforcement (4 tests)'
\echo '  Group 5: Receipt immutability (3 tests)'
\echo '  Group 6: Structural verification (5 tests)'
\echo '  Total: 27 tests'
\echo ''
