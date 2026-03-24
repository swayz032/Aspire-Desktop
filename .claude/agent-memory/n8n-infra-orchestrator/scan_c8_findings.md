---
name: C8 Workflow Scan (WF 17-24)
description: Infrastructure scan findings for workflows 17-24 from 2026-03-23 Cycle 8 scan — FIXED
type: project
---

## Scan Date: 2026-03-23
## Fix Date: 2026-03-23

### Workflows Scanned
- WF-17: Intake Activation (UaALXeXhFbY5gPLp) - 4 findings -- 3 FIXED (HTTP nodes), 1 remaining (trace_id position)
- WF-18: Quinn Invoice Reminder (FNJAFs2C1g276IqJ) - 1 finding -- FIXED
- WF-19: Adam Pulse Scan (w0yi3wVY2xKLeqZI) - 2 findings -- 1 FIXED (receipt), 1 remaining (unsecured webhook)
- WF-20: Approval Change Handler (jZpr0fRE7FlaNiGB) - 3 FIXED (kill switch payload passthrough + 2 receipt nodes)
- WF-21: Teressa Books Sync (KO0u11YLTlnxLvIN) - 1 finding -- FIXED
- WF-22: Adam Library Curate (q2S9yVu2L2jcAe0Y) - 1 finding -- FIXED, 1 remaining (unsecured webhook)
- WF-23: Batch Email Digest (TPnfhjeT9vIDvkJP) - 2 findings -- 1 FIXED (cross-tenant), 1 remaining
- WF-24: Brain Keep-Alive (Aj1R6BncLMss2cHM) - 1 finding (not in scope)

### Fixes Applied (2026-03-23)

1. **Approval Change Handler Kill Switch payload passthrough** (HIGH)
   - Node: `Kill Switch` (ks-check)
   - Was: returned only `{ killed: 'false' }`, dropping all webhook body data
   - Fix: spreads `$input.first().json` into output so `$json.body.status`, `$json.body.approval_id` etc. are available downstream

2. **Approval Change Handler receipt schema** (MEDIUM x2)
   - Nodes: `Receipt: COMPLETED` (receipt-ok), `Receipt: FAILED` (receipt-fail)
   - Was: old format (receipt_type/action_type/tenant_id/details/trace_id)
   - Fix: standard schema (receipt_id, suite_id, office_id, actor_type, actor_id, action, correlation_id, created_at)

3. **Batch Email Digest cross-tenant read** (HIGH -- Law #6)
   - Node: `Fetch Unread Inbox Items` (fetch-unread)
   - Was: `inbox_items?select=*&status=eq.unread` (no suite_id filter)
   - Fix: added `&suite_id=eq.{{ $env.DEFAULT_SUITE_ID }}` to URL

4. **Quinn Invoice Reminder old receipt** (MEDIUM)
   - Node: `Receipt: FAILED (0)` (err-receipt-0)
   - Fix: normalized to standard schema with receipt_id, suite_id, office_id, actor, correlation_id

5. **Adam Pulse old receipt** (MEDIUM)
   - Node: `Receipt: FAILED (0)` (err-receipt-0)
   - Fix: same normalization

6. **Teressa Books Sync old receipt** (MEDIUM)
   - Node: `Receipt: FAILED (0)` (err-receipt-0)
   - Fix: same normalization

7. **Adam Library old receipt** (MEDIUM)
   - Node: `Receipt: FAILED (0)` (err-receipt-0)
   - Fix: same normalization

8. **Intake Activation HTTP nodes misconfigured** (HIGH x3)
   - Nodes: `Create Setup Tasks - Gateway`, `Trigger First Daily Brief`, `Trigger First Pulse Scan`
   - Was: only `url` set, no method/body/headers (sends empty GET)
   - Fix: added method=POST, Content-Type, tenant headers (x-suite-id, x-office-id, x-correlation-id, x-actor-id, x-actor-type), JSON body with task_type/payload, timeout=15000ms

### Remaining (Not Fixed This Pass)
- Unsecured manual webhook triggers on Adam Pulse + Adam Library (bypass HMAC)
- Brain Keep-Alive minimal workflow (no receipt, no tenant context -- acceptable for health check)

### Key Lesson
- n8n MCP `updateNode` requires `updates` with dot-notation paths, NOT a full `node` object
- Correct: `{type: "updateNode", nodeName: "X", updates: {"parameters.url": "..."}}`
- Wrong: `{type: "updateNode", name: "X", node: {parameters: {url: "..."}}}`

**How to apply:** Use `nodeName` + `updates` with dot-notation for all partial workflow updates.
