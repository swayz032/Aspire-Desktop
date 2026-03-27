---
name: Cycle 9 — ElevenLabs V1 Hybrid Architecture Audit
description: Receipt audit findings for ElevenLabs integration files (gateway tools, webhook, telephony, setup script)
type: project
---

# Cycle 9 Audit — ElevenLabs V1 Hybrid Architecture (2026-03-27)

## Files Audited
- `backend/gateway/src/routes/elevenlabs-tools.ts` — 6 tool proxy endpoints
- `backend/gateway/src/routes/elevenlabs-webhooks.ts` — post-call transcript webhook
- `Aspire-desktop/server/telephonyEnterpriseRoutes.ts` — PROVISION_DID + telephony ops
- `backend/scripts/setup-elevenlabs-agents.ts` — config script (no receipts needed)

## Verdict: FAIL

## CRITICAL Findings

### CRITICAL-1 — `/signed-url` has ZERO receipt on any path (`elevenlabs-tools.ts:52`)
- Creates a billable ElevenLabs conversation session (external state change)
- No receipt on success, schema failure (400), agent not configured (500), API key missing (500), ElevenLabs failure (502), or catch block
- `handleToolError` calls `reportGatewayIncident` only — incidents are NOT receipts
- Orchestrator not involved in this call path — gateway must own the receipt

### CRITICAL-2 — `/transcripts` catch path discards data with no receipt (`elevenlabs-webhooks.ts:152`)
- When orchestrator unreachable, full transcript is silently discarded
- `reportGatewayIncident` is called but that is not a receipt
- Comment "orchestrator will reconcile later" is incorrect — orchestrator is down
- `conversation_id`, `suiteId`, `correlationId` all in scope but nothing is persisted

### CRITICAL-3 — `twilio_auth_token` partial log exposure (`telephonyEnterpriseRoutes.ts:84`)
- Raw `TWILIO_AUTH_TOKEN` sent in POST body to `api.elevenlabs.io`
- `logger.error` at line 90 logs `err.slice(0, 200)` — does not guarantee token absent from ElevenLabs error response body
- Required by ElevenLabs API design but must confirm no echo-back in error paths

## HIGH Findings

### HIGH-1 — `writeReceipt` schema missing 6 of 8 Law #2 required fields (systemic, ~20 call sites)
- `telephonyEnterpriseRoutes.ts:180` — only writes: `suite_id`, `action_type`, `correlation_id`, `payload`
- Missing named columns: `actor_type`, `actor_id`, `risk_tier`, `outcome`, `reason_code`, `capability_token_id`, `approval_evidence`, `office_id`
- This is a schema migration + function signature change required for all telephony receipts

### HIGH-2 — `PROVISION_DID` partial-failure masquerades as success (`telephonyEnterpriseRoutes.ts:1476`)
- When `importNumberToElevenLabs` returns null (any of 3 failure paths), `elevenLabsPhoneId = null`
- Receipt at line 1479 shows `elevenlabs_phone_id: null, elevenlabs_enabled: true` — indistinguishable from success
- Must use `outcome: partial_failure` + `reason_code: ELEVENLABS_IMPORT_FAILED` in this case

### HIGH-3 — Gateway validation denials unreceipted for YELLOW/RED tool endpoints
- `/draft` (YELLOW), `/approve` (YELLOW/RED), `/execute` (RED) all return 400 on schema failures with no receipt
- Denials at the first governance boundary must be receipted per Law #2
- Specifically affects lines 256-272 (draft), 314-330 (approve), 365-390 (execute)

### HIGH-4 — ElevenLabs agent assignment failure unreceipted (`telephonyEnterpriseRoutes.ts:107`)
- `assignResp.ok === false` → `logger.warn` only, then falls through to provisioned receipt
- Receipt at line 1479 shows non-null `elevenlabs_phone_id` but no record that agent was not assigned
- "Number provisioned" and "number provisioned but Sarah unassigned" produce identical receipts

## MEDIUM Findings

### MEDIUM-1 — Purchase endpoint catch block has no failure receipt (`telephonyEnterpriseRoutes.ts:549`)
- If `enqueueOutbox` throws, catch block logs and returns 500 with no receipt
- Outbox job failure path (line 1590) is covered; enqueue-phase failure is not

### MEDIUM-2 — Transcript webhook rejection paths have no receipt (4 paths, `elevenlabs-webhooks.ts`)
- Webhook secret not configured (line 36): 500, no receipt, no incident
- Missing signature header (line 45): 401, no receipt
- HMAC mismatch (line 68): 401, no receipt
- Body parse failure (line 83): 400, no receipt
- Signature failures are security-relevant and should produce audit records

### MEDIUM-3 — Telephony receipt correlation IDs not linked to HTTP request IDs
- `correlationId()` at line 175 generates `fd_${Date.now()}_${hex}` — isolated format
- Not derived from inbound `X-Correlation-Id` header
- All ~20 telephony receipts are traceable within the outbox job chain but NOT to the originating HTTP session

### MEDIUM-4 — E.164 phone numbers stored unredacted in receipt payloads (7+ call sites)
- Lines 544, 570, 683, 734, 856, 1283, 1297+ store raw phone numbers in payload jsonb
- Webhook receipts at 968-1138 also store `to_number`, `from_number`, `message_sid` unredacted
- No Presidio DLP applied — bypassed entirely for telephony receipts

### MEDIUM-5 — Transcript content forwarded without gateway-layer DLP
- `elevenlabs-webhooks.ts:116-120` forwards raw `body.transcript` and `body.analysis` to orchestrator
- Gateway cannot guarantee orchestrator applies Presidio before storage
- No fallback if orchestrator stores raw content

### MEDIUM-6 — No risk_tier in any telephony receipt
- `writeReceipt` accepts no risk_tier parameter
- `PROVISION_DID` is RED, outbound call is YELLOW, SMS send is YELLOW — all stored identically

## Architecture Observations

### Delegation Pattern (CORRECT)
- `/context`, `/search`, `/draft`, `/approve`, `/execute` all proxy to `/v1/intents` with full correlation ID in both header and body
- `proxyToOrchestrator` confirmed propagates `X-Correlation-Id`, `X-Suite-Id`, `X-Office-Id`, `X-Actor-Id`
- Orchestrator owns receipts for these delegated operations — architecturally correct per Law #1

### Telephony Outbox Job Failure Receipt (CORRECT)
- `telephonyEnterpriseRoutes.ts:1588-1594` — outbox worker catch block writes `frontdesk.job.failed` receipt
- This covers PROVISION_DID Twilio API failures, OUTBOUND_CALL Twilio failures, etc.
- Failure receipt path is best-effort (nested try/catch) — acceptable pattern

### Immutability (PASS)
- `frontdesk_action_receipts` written only via INSERT at all call sites
- No UPDATE or DELETE found on receipt table in any audited file

### Capability Token — Gateway Layer
- `/execute` validates token is non-empty string but delegates full validation to orchestrator
- NEEDS VERIFICATION: confirm orchestrator token_service validates scope/expiry/tenant binding for ElevenLabs execute calls
- `PROVISION_DID` has no capability token in its receipt chain at all

### Setup Script (`setup-elevenlabs-agents.ts`) — OUT OF SCOPE
- Creates/updates ElevenLabs agent configurations via PATCH/POST
- No receipts needed — pure configuration operation, not state change per governance definition
- CONFIRMED: no secrets stored, `xi-api-key` used only in request headers, not logged
