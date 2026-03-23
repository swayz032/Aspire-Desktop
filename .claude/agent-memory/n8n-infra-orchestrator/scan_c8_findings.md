---
name: C8 Workflow Scan (WF 17-24)
description: Infrastructure scan findings for workflows 17-24 from 2026-03-23 Cycle 8 scan
type: project
---

## Scan Date: 2026-03-23

### Workflows Scanned
- WF-17: Intake Activation (UaALXeXhFbY5gPLp) - 4 findings
- WF-18: Quinn Invoice Reminder (FNJAFs2C1g276IqJ) - 1 finding
- WF-19: Adam Pulse Scan (w0yi3wVY2xKLeqZI) - 2 findings
- WF-20: Approval Change Handler - SKIPPED (already fixed)
- WF-21: Teressa Books Sync (KO0u11YLTlnxLvIN) - 1 finding
- WF-22: Adam Library Curate (q2S9yVu2L2jcAe0Y) - 1 finding (shared w/ Pulse)
- WF-23: Batch Email Digest (TPnfhjeT9vIDvkJP) - 2 findings
- WF-24: Brain Keep-Alive (Aj1R6BncLMss2cHM) - 1 finding

### Totals: 5 HIGH, 6 MEDIUM, 1 LOW = 12 findings

### Systemic Patterns

1. **Old-format "Receipt: FAILED (0)" nodes across 4 workflows**: Quinn, Adam Pulse, Teressa, Adam Library all have legacy receipt nodes from pg_net hardening pass with minimal schema (missing receipt_id, suite_id, office_id, actor, correlation_id). All are dead-end nodes. Same bug found in C7 scan for Receipt Handler.

2. **Batch Email Digest cross-tenant query**: Fetches inbox_items with service_role_key and no suite_id filter -- Law #6 violation.

3. **Unsecured manual webhook triggers**: Adam Pulse + Adam Library have webhook triggers that bypass HMAC validation, connecting directly to schedule-prep code nodes.

4. **Intake Activation gateway HTTP nodes misconfigured**: 3 sequential HTTP nodes have no method/body/headers -- will send empty GET requests instead of POST intents.

### Key Lesson
- The "Receipt: FAILED (0)" old-format pattern appears in ALL scheduled agent workflows that went through the pg_net hardening pass. A batch fix across all remaining workflows would be more efficient than individual fixes.
- Manual webhook triggers added for testing convenience create HMAC bypass paths -- these should either be removed or given their own validation chain.

**How to apply:** When fixing, batch-update all old-format receipt nodes to standard schema in one pass. For manual webhook triggers, either remove them or add HMAC validation specific to webhook path.
