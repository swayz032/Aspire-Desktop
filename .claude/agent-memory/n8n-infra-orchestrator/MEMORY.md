# n8n Infrastructure Orchestrator Memory

## Scan History
- [C7-C2 Findings (WF 9-16)](scan_c7_c2_findings.md) — 2026-03-23, 17 findings (4 HIGH, 8 MEDIUM, 2 LOW)
- [C8 Findings (WF 17-24)](scan_c8_findings.md) — 2026-03-23, 12 findings (5 HIGH, 6 MEDIUM, 1 LOW)

## Common Bug Patterns
- **office_id in receipts**: Webhook workflows often use env var fallback instead of actual tenant office_id from prep node
- **Boolean vs string killed flag**: Some workflows return boolean `true/false`, IF nodes compare against string `"true"` — works in loose mode but breaks in strict
- **Receipt schema completeness**: pg_net handlers use old minimal schema missing receipt_id, suite_id, office_id, correlation_id, actor fields
- **Tenant context validation**: Not all webhook workflows validate suite_id/office_id presence before proceeding
- **Manual webhook triggers bypass HMAC**: Adam Pulse + Adam Library have unsecured webhook triggers alongside schedule triggers
- **Cross-tenant query (Batch Email Digest)**: Fetches inbox_items with service_role_key, no suite_id filter — Law #6 violation
- **Intake Activation HTTP nodes misconfigured**: 3 gateway HTTP nodes have no method/body/headers — send empty GET instead of POST

## n8n Quirks (Verified)
- IF v2 Output 0 = TRUE branch, Output 1 = FALSE branch
- `typeValidation: "strict"` requires string-to-string comparison — boolean will NOT coerce
- `typeValidation: "loose"` (default) will coerce boolean to string for comparison
- Code node `fetch()` bypasses n8n HTTP Request node controls (no timeout/retry tracking)
- Merge node required when two parallel HTTP nodes feed into one Code node — otherwise Code runs per-item as each arrives
