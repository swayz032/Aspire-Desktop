# Receipt Ledger Auditor Memory

## Key Findings — routes.ts Bootstrap Endpoint (2026-03-06)

### Receipt Infrastructure
- `emitReceipt()` defined at `server/routes.ts:473` — inserts into `receipts` table via raw `db.execute(sql`...`)`
- `receipts` table schema defined in `backend/infrastructure/migrations/trust-spine-bundle.sql:1098`
- Columns written by emitReceipt: receipt_id, receipt_type, status, action (jsonb), result (jsonb), suite_id, tenant_id, correlation_id, actor_type, actor_id, created_at
- MISSING from receipts table schema: `tool_used`, `capability_token_id`, `approval_evidence`, `reason_code`, `office_id` (present in schema but NOT written by emitReceipt)
- Full Trust Spine receipt schema (execution_receipts) lives in trust-spine migrations — it has all Law #2 fields but is NOT the table used by the desktop server

### Bootstrap Endpoint Audit Summary
- File: `Aspire-desktop/server/routes.ts`, handler at line 515
- `receiptId` generated at line 692 — AFTER tenant_memberships INSERT at lines 668-683
- Receipt emitted at line 765 (success path only — covers suite creation + membership + profile collectively)
- CRITICAL GAP: tenant_memberships failure path (lines 674-683) returns HTTP 500 with NO receipt
- CRITICAL GAP: suite creation failure path (lines 660-662) returns HTTP 500 with NO receipt
- CRITICAL GAP: outer catch block (lines 856-868) creates `failReceiptId` variable but NEVER calls `emitReceipt()` — it only logs to logger. The comment says "receipt goes to system log only" which is NOT a receipt.
- MEDIUM: n8n webhook payload (lines 807-808) sends raw `dateOfBirth` and `gender` PII unredacted
- HIGH: Missing fields in emitted receipt — no `tool_used`, `capability_token_id`, `approval_evidence`, `reason_code`, `office_id`

### Receipts Table vs Law #2 Minimum Fields Gap
The production `receipts` table schema is a simplified Trust Spine subset. Missing Law #2 fields:
- `tool_used` → stored in `action` jsonb (partial)
- `capability_token_id` → not stored at all
- `approval_evidence` → not stored
- `reason_code` → not stored
- `office_id` column exists in schema but emitReceipt() does NOT write it

## Stable Patterns

### emitReceipt() call sites in routes.ts
- 19 call sites total (lines 765, 1068, 1081, 1104, 1156, 1173, 1287, 1303, 1326, 1342, 1364, 1380, 1414, 1430, 1460, 1476, 1536, 1552, plus bootstrap success)
- All follow same pattern: inline object with receiptId, receiptType, outcome, suiteId, tenantId, correlationId, actorType, actorId, riskTier

### Common Receipt Gaps Pattern
- Pre-receipt failure exits (before receiptId is generated or before emitReceipt is called) are a systemic risk
- The catch block pattern of "emit failure receipt" often only logs instead of actually calling emitReceipt()
- This is a recurring pattern — audit all catch blocks for this mistake
