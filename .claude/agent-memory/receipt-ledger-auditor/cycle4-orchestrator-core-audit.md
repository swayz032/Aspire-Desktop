---
name: Cycle 4 Orchestrator Core Services Audit
description: Receipt coverage audit of graph.py, receipt_store.py, receipt_chain.py, capability_token.py, policy_engine.py, approval_store.py, skill_router.py, providers/stripe_webhook.py
type: project
---

## Cycle 4 Audit — backend/orchestrator/src/aspire_orchestrator/ (2026-03-22)

### Files Confirmed Audited
- graph.py — 14-node LangGraph orchestrator graph
- nodes/intake.py — Intake node
- nodes/greeting_fast_path.py — Greeting fast path
- nodes/safety_gate.py — Safety gate node
- nodes/policy_eval.py — Policy evaluation node
- nodes/approval_check.py — Approval check node
- nodes/token_mint.py — Token mint node (capability_token.py does NOT exist as standalone)
- nodes/execute.py — Execute node
- nodes/receipt_write.py — Receipt write node
- services/receipt_store.py — Receipt persistence
- services/receipt_chain.py — Chain hash computation
- services/policy_engine.py — Policy matrix evaluation
- services/skill_router.py — Skill routing
- providers/stripe_webhook.py — Stripe webhook handler
- services/token_service.py — Token validation (approval_store.py does NOT exist standalone)

### capability_token.py / approval_store.py do NOT exist as standalone files
- Token minting is in nodes/token_mint.py
- Token validation is in services/token_service.py
- Approval persistence is in approval_check.py (via supabase_upsert_sync to approval_requests table)
- No standalone approval_store.py — approval state is managed inline in approval_check_node()

### Receipt Infrastructure (Orchestrator Core)
- pipeline_receipts list accumulates receipts across all nodes; receipt_write_node chains and persists them
- store_receipts() in receipt_store.py: in-memory + async Supabase dual-write (append-only confirmed)
- receipt_chain.py: SHA-256 hash chain with genesis prev_hash = "0"*64 — CORRECT algorithm
- DLP redaction runs BEFORE chain hashing in receipt_write_node — correct ordering

### Critical Gaps Found

#### graph.py — classify_node (line 444-470)
- CRITICAL: Money movement denial path (lines 444-470) sets error_code/outcome/policy_allowed=False
  but does NOT emit a receipt and does NOT append to pipeline_receipts.
  The deny is returned as a state update with no receipt. This denial is a POLICY DECISION
  with a DENIED outcome — it MUST have a receipt (Law #2).

#### graph.py — route_node (line 497-575)
- HIGH: Routing denial path (lines 535-540) returns result with error_code="ROUTING_DENIED"
  but does NOT emit a receipt. The routing decision is a governance state change with no receipt.
- HIGH: Empty routing steps path (lines 561-566) sets error_code="EMPTY_ROUTING_STEPS"
  but does NOT emit a receipt.

#### graph.py — classify_node: No receipt for CLASSIFICATION itself
- MEDIUM: classify_node performs significant state-changing classification work
  but emits ZERO receipts into pipeline_receipts. Policy evaluation has a receipt,
  safety gate has a receipt, intake has a receipt — but classification has none.
  The classification is a governance decision that should be receipted.

#### nodes/token_mint.py — Success path (lines 185-208)
- HIGH: The SUCCESS path of token_mint_node does NOT emit a receipt.
  Only the failure path (lines 132-155) emits a receipt for TOKEN_SIGNING_KEY_MISSING.
  A successful token mint is a critical security event (Law #5 + Law #2) that must be receipted.

#### nodes/greeting_fast_path.py — Receipt schema divergence (line 134-147)
- MEDIUM: _fast_path_receipt uses a completely different schema:
  - Uses "action" instead of "action_type"
  - Uses "result" instead of "outcome"
  - Missing: actor_type, actor_id, tool_used, reason_code, receipt_type, correlation_id, suite_id, office_id, risk_tier
  - This receipt WILL fail _map_receipt_to_row() in receipt_store.py silently
    because the missing fields default to empty/null.
  - trace_id/correlation_id will not propagate through this receipt.

#### nodes/receipt_write.py — Exception path (lines 99-106)
- MEDIUM: When receipt chain computation fails (catch block at line 99),
  sets error_code="RECEIPT_WRITE_FAILED" but does NOT emit any receipt for the failure itself.
  This is a Law #2 violation: the failure of receipt writing must itself be receipted somewhere
  (even if only to the error log's receipt equivalent).

#### services/skill_router.py — Zero receipts emitted (entire file)
- HIGH: SkillRouter.route_multi() makes governance-significant routing decisions
  (deny entire plan for unknown actions, deny for internal-only packs, lifecycle reroutes)
  but emits ZERO receipts. All routing outcomes — allow, deny, lifecycle reroute — are
  returned to graph.py's route_node, which also does not emit receipts.
  This is a complete receipt gap for the routing decision layer.

#### services/policy_engine.py — Zero receipts emitted (entire file)
- LOW: PolicyMatrix.evaluate() is a pure computation — no side effects.
  The receipt is correctly emitted by policy_eval_node in nodes/policy_eval.py.
  No gap here. The service is intentionally stateless.

### Receipt Schema Analysis — 18 Required Fields

Pipeline receipts (from nodes other than greeting_fast_path) contain:
  PRESENT: id, correlation_id, suite_id, office_id, actor_type, actor_id,
           action_type, risk_tier, tool_used, created_at, outcome, reason_code,
           receipt_type, receipt_hash (empty before chain write)
  MISSING: capability_token_id — only in execute.py's tool_execution receipt
           capability_token_hash — only in execute.py outbox_receipt and main receipt
           executed_at — only in execute.py's tool_execution receipt (not in earlier node receipts)
           inputs_hash — NOT present in ANY pipeline node receipt
           redacted_inputs — only in intake.py receipt (partially)
           redacted_outputs — NOT present in ANY pipeline node receipt
           approval_evidence — not a field in pipeline receipts (stored separately in approval_requests table)
           trace_id — computed at map time from correlation_id fallback (not in receipt dicts themselves)

Systemic gap: inputs_hash and redacted_outputs are missing from all node receipts.

### Stripe Webhook Schema Incompatibility (CONFIRMED CRITICAL)
stripe_webhook.py _build_webhook_receipt() schema (lines 141-169):
  - "receipt_version", "receipt_id" (not "id"), "ts" (not "created_at"),
    "event_type" (not "action_type"), "actor" (not "actor_id"/"actor_type"),
    "policy" (object), "inputs_hash", "metadata", "redactions" (not "redacted_inputs")

receipt_store.py _map_receipt_to_row() reads (line 128-222):
  - receipt.get("id"), receipt.get("action_type"), receipt.get("created_at"),
    receipt.get("actor_id"), receipt.get("actor_type")

Impact: All Stripe webhook receipts persist to Supabase with:
  - receipt_id = newly generated uuid4() (receipt.get("id") returns None)
  - action (jsonb) will be EMPTY (action_type field not found)
  - status always = "PENDING" (outcome field not mapped)
  - created_at = None (ts field ignored)
  - trace_id derived from correlation_id only (correlation_id IS present in stripe receipt — partial save)
  - Actor columns = "SYSTEM" + system UUID (actor not parsed)

Stripe webhook receipts ARE stored (store_receipts() is called) but are FUNCTIONALLY ORPHANED
from the trace chain. query_receipts() filtering by action_type or risk_tier returns nothing
for Stripe events. The admin facade cannot query these receipts correctly.

### Append-Only Verification
- receipt_store.py uses INSERT only — confirmed append-only (Law #2 PASS)
- _persist_to_supabase() line 255: client.table("receipts").insert(rows) — no UPDATE or DELETE
- No UPDATE/DELETE found anywhere in receipt_store.py — PASS

### Hash Algorithm Verification
- receipt_chain.py line 57: hashlib.sha256(data.encode("utf-8")).hexdigest() — SHA-256 CONFIRMED
- token_mint.py line 196-198: hashlib.sha256(...).hexdigest() for token hash — CORRECT
- stripe_webhook.py line 151-156: hashlib.sha256(...).hexdigest() for inputs_hash — CORRECT

### PII/Secret Exposure in Receipt Data
- approval_check.py _redact_pii() (lines 104-144): Good inline redaction for execution_payload
  stored in approval_requests table. PII keys list is comprehensive.
- MEDIUM RISK: receipt_write_node DLP redact_fields depends on state.get("redact_fields")
  which is set from the policy matrix. If policy matrix omits redact_fields for an action,
  raw execution parameters pass through to receipt content.
- LOW RISK: execute.py line 752 stores customer_email in send_params (for invoice.send Authority Queue).
  This raw email goes into approval_requests.execution_payload. It is also written to
  approval_row["payload_redacted"] but there is NO email redaction applied to send_params itself
  before insert. The email_redaction only applies to draft_summary display string.

### Trace Chain Integrity
- correlation_id propagates correctly from intake → all nodes → receipts (PASS)
- trace_id: computed at persist time from correlation_id fallback (PARTIAL — not explicitly set in node receipts)
- span_id / parent_span_id: not set by any orchestrator node — computed from middleware context at persist time
- run_id: not set by any orchestrator node receipt dict (ABSENT)
- Parent-child receipt linkage: pipeline_receipts are chained sequentially by suite_id in receipt_write_node
  but there is no explicit parent_receipt_id field linking, e.g., the approval receipt to the execution receipt.
  The chain_id/sequence provides ordering but not semantic parent-child linking.
