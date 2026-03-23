---
name: C7-C2 Workflow Scan (WF 9-16)
description: Infrastructure scan findings for workflows 9-16 from 2026-03-23 Cycle 7 rotation
type: project
---

## Scan Date: 2026-03-23

### Common Patterns Found Across C2 Batch

1. **office_id fallback bug** (WF-9, 13, 16): Success receipts use `$env.DEFAULT_OFFICE_ID` instead of actual tenant office_id from prep node. All webhook-triggered agent workflows affected.

2. **Missing tenant context validation** (WF-13 Nora, WF-16 Sarah): Unlike Eli (WF-9) which validates suite_id/office_id presence, Nora and Sarah silently default to env vars. Law #6 violation.

3. **Boolean vs string `killed` flag** (WF-14): Analytics Rollup returns `killed: true` (boolean) while all others return `killed: 'true'` (string). IF node comparison is against string "true".

### HIGH Findings
- WF-10 (pg_net Receipt Handler): Orphaned `Receipt: FAILED` node, no Error Trigger, incomplete receipt schema
- WF-14 (Analytics Rollup): Boolean/string mismatch on killed flag
- WF-15 (TLS Cert Check): Code node uses `fetch()` for external calls, hardcoded domain fallbacks

### Key Lesson
- The pg_net Receipt Handler (WF-10) was built with a different pattern than the other 7 workflows — it uses separate HMAC and Kill Switch nodes instead of a combined Code node, and its receipt schema is the old minimal format missing required fields.

**How to apply:** When fixing, update WF-10 receipt nodes to match the full schema pattern used by all other workflows. For future scans, check receipt body completeness as a standard gate.
