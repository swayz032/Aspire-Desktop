---
subsystem: SMS In/Out — Delivery Investigation
version: v1.0
pass: 16 (Pass 16 — §16.E + Pass 14 — §14.C)
authored: 2026-04-29
owner: release-sre
---

# SMS In/Out — Operations Runbook

## What This Runbook Covers

Pass 16/14 SMS stack. Inbound SMS arrives via Twilio webhook and becomes a `sms_thread` memory object. Outbound SMS goes out via Twilio Messages API, with delivery status flowing back through a status callback.

Relevant source files:
- `backend/orchestrator/src/aspire_orchestrator/services/sms_io.py` — outbound send + status update
- `backend/orchestrator/src/aspire_orchestrator/services/ingestion/sms_ingestion.py` — inbound ingestion adapter
- `backend/orchestrator/src/aspire_orchestrator/routes/sms.py` — outbound route (Yellow tier)

Related runbooks:
- [telephony.md](telephony.md) — the numbers used for SMS
- [office-memory-engine.md](office-memory-engine.md) — the `memory_objects` table where inbound SMS lands

---

## Architecture

```
Inbound SMS flow:
  Twilio receives SMS on Aspire-owned number
    │
    └─ POST /v1/ingest/twilio/sms/inbound (form-encoded)
          Headers: X-Twilio-Signature, X-Aspire-Webhook-Url, X-Aspire-Form-Params
          │
          └─ SMSIngestionAdapter
                ├─ verify_signature()  → Twilio HMAC SHA-1
                ├─ resolve_scope()     → lookup tenant_phone_numbers by To-number
                └─ build_envelope()    → INSERT memory_objects (type='sms_thread')
                                         idempotency_key = 'twilio-sms-inbound:{MessageSid}'

Status callback (inbound delivery status):
  Twilio → POST /v1/ingest/twilio/sms/status
    └─ update_sms_status() → UPDATE sms_messages.status
                          → receipt cut on terminal states (delivered/failed/undelivered)

Outbound SMS flow:
  Client → POST /v1/sms/send (Yellow tier, capability token scope=telephony:sms_send)
    │
    └─ send_sms()
          ├─ resolve from_number: tenant_phone_numbers WHERE sms_enabled=true
          ├─ resolve to_number:   memory_objects.detail.from (original inbound contact)
          ├─ POST Twilio /Messages.json
          ├─ INSERT sms_messages (direction='outbound')
          ├─ INSERT memory_objects (type='sms_thread', append-only, Law #2)
          └─ receipt: sms_outbound (Law #2)

Key tables:
  public.memory_objects    → all SMS threads (inbound + outbound)
  public.sms_messages      → delivery tracking table (status, error_code, idempotency_key)
  public.tenant_phone_numbers → from_number resolution
```

---

## Common Procedures

### Replay a Twilio status callback

Use when a message shows `status='queued'` or `status='sent'` in `sms_messages` but delivery status never updated.

**Step 1 — Verify Twilio's view of the message:**

```bash
# Check Twilio message status directly
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages/<MESSAGE_SID>.json" | \
  python -m json.tool | grep '"status"'
```

**Step 2 — If Twilio shows a terminal status that Aspire doesn't have, trigger manually:**

```bash
railway run --service aspire-orchestrator python -c "
import asyncio
from aspire_orchestrator.services.sms_io import update_sms_status

async def main():
    await update_sms_status(
        twilio_message_sid='<MESSAGE_SID>',
        new_status='delivered',  # or 'failed', 'undelivered'
        error_code=None,
    )
    print('status updated')

asyncio.run(main())
"
```

This is idempotent on `message_sid` — safe to run multiple times.

**Step 3 — Verify:**

```sql
SELECT message_sid, status, error_code, updated_at
FROM public.sms_messages
WHERE message_sid = '<MESSAGE_SID>';
```

---

### Verify an outbound send was idempotent

If a client suspects duplicate sends (double-click, network retry):

```sql
-- Check sms_messages for the idempotency_key
SELECT id, message_sid, status, direction, sent_at, idempotency_key
FROM public.sms_messages
WHERE idempotency_key = '<IDEMPOTENCY_KEY>'
ORDER BY sent_at;
```

The `send_sms()` service does NOT deduplicate on `idempotency_key` in the DB — dedup is minute-bucketed on the client side via SHA256(thread_id|body|minute). If two rows exist with the same key, the dedup window was missed (different minute buckets) or the key was incorrectly generated.

If a duplicate send did reach Twilio, check `sms_messages` for two rows with the same `to_number` + `body` within the same minute:

```sql
SELECT id, message_sid, to_number, status, sent_at
FROM public.sms_messages
WHERE thread_memory_id = '<THREAD_MEMORY_ID>'
  AND direction = 'outbound'
  AND sent_at > now() - interval '5 minutes'
ORDER BY sent_at;
```

---

### Find a missing inbound SMS

When a contact reports sending an SMS that never appeared in the app:

**Step 1 — Verify Twilio received it:**

```bash
# Twilio Console: Messaging → Logs → Messages
# Or via API:
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json?To=<OFFICE_NUMBER>&DateSent>=2026-04-29" | \
  python -m json.tool | grep '"sid"'
```

**Step 2 — If Twilio shows received but Aspire has no memory_object:**

Check the inbound route logs for signature verification failures:

```bash
railway logs --service aspire-orchestrator | grep "sms_inbound\|X-Twilio-Signature\|UNKNOWN_NUMBER\|MISSING_TO_NUMBER"
```

Common causes:

| Symptom in logs | Root cause |
|---|---|
| `UNKNOWN_NUMBER` | `To` number not in `tenant_phone_numbers` or `status != active` |
| `TWILIO_SIGNATURE_INVALID` | `TWILIO_AUTH_TOKEN` mismatch or `X-Aspire-Webhook-Url` constructed wrong |
| `TENANT_PHONE_NUMBERS_UNAVAILABLE` | Migration 102 not yet run (503 returned — Twilio will retry) |
| No log entry at all | Twilio webhook URL not configured on the number |

**Step 3 — Verify webhook URL is set on the Twilio number:**

```bash
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers.json" | \
  python -m json.tool | grep -A3 "sms_url"
```

Expected: `sms_url` = `https://orchestrator.aspire.app/v1/ingest/twilio/sms/inbound`

If blank: this number was purchased outside of Aspire's provisioning flow and has no webhook configured. Use Twilio Console to add it manually, or re-provision through `purchase_number()`.

---

## Failure Modes

### Delivery failed (status='failed')

**Symptom:** `sms_messages.status = 'failed'`, `error_code` populated. Receipt `sms_status_update` with `outcome='failed'` was cut.

**Common Twilio error codes:**

| Code | Meaning | Action |
|---|---|---|
| 30003 | Unreachable handset | Carrier issue or phone off. Notify user. |
| 30004 | Message blocked | Recipient blocked the number or carrier filter. Try different from_number if available. |
| 30005 | Unknown destination handset | Number may be invalid or unassigned. Verify to_number with contact. |
| 30006 | Landline or unreachable carrier | to_number is a landline. Cannot deliver SMS. |
| 30007 | Carrier violation | A2P 10DLC compliance issue. Check brand/campaign registration status. |
| 30008 | Unknown error | Escalate to Twilio support with MessageSid. |

**Surface to user:** the route layer returns `message_sid` + `status` in the send response. The frontend should display a delivery failure toast when the status callback fires.

---

### Undelivered (status='undelivered')

**Symptom:** `sms_messages.status = 'undelivered'`. Different from `failed` — carrier accepted it but could not deliver.

**Cause:** Usually a carrier filter (spam filter, A2P non-compliance) or message content issue.

**Action:**
1. Check A2P 10DLC brand registration status in Twilio Console.
2. If the office has multiple numbers, retry from a different `from_number`.
3. If this is the only number, advise the tenant to check if the contact has any carrier-side blocks.

---

### Status callback missing

**Symptom:** `sms_messages.status` is stuck at `queued` or `sent` indefinitely.

**Cause:** Twilio retries the status callback 11 times over ~5 hours with exponential backoff. If all 11 fail, no further updates are sent.

**Diagnosis — check if Twilio received an error on the callback:**

In Twilio Console: Messaging → Logs → Messages → select the SID → Event History. Look for callback attempts and their HTTP response codes.

If Aspire returned 5xx on the callback: check orchestrator logs for that time window:
```bash
railway logs --service aspire-orchestrator --since 6h | grep "sms/status"
```

**Recovery:** Manually trigger the status update (see "Replay a Twilio status callback" procedure above). Then investigate why the callback failed — typically a pod restart during the callback window or a DB connection timeout.

---

### Outbound 4xx auth failure

**Symptom:** `sms_io.send_sms` raises `SmsIoError(TWILIO_SEND_FAILED)` with HTTP 401. Route returns 422.

**Cause:** `TWILIO_ACCOUNT_SID` or `TWILIO_AUTH_TOKEN` in Railway are invalid, rotated, or missing.

**Diagnosis:**
```bash
railway variables --service aspire-orchestrator | grep TWILIO
```

Test the credentials directly:
```bash
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}.json" | \
  python -m json.tool | grep '"status"'
```

Expected: `"status": "active"`. If 401: the token is wrong. Retrieve from AWS Secrets Manager (`aspire/twilio/credentials`) and update Railway.

---

## Yellow-Tier Capability Token Validation

Every outbound SMS send requires a valid capability token with `scope=telephony:sms_send`. The route layer (`routes/sms.py`) validates this before calling `send_sms()`.

**Symptoms of token issues:**

| HTTP response | Error code | Cause |
|---|---|---|
| 401 | `MISSING_CAPABILITY_TOKEN` | No token in request body |
| 401 | `INVALID_TOKEN` | Token expired, wrong scope, or wrong tenant |
| 401 | `MISSING_SCOPE_HEADERS` | `X-Tenant-Id` / `X-Suite-Id` / `X-Office-Id` headers missing |

Tokens are short-lived (<60s, Law #5). If a token expired between minting and use, the client must request a new token. This is the expected behavior — do not extend token TTL.

---

## Rate Limits

| Limit | Value | Notes |
|---|---|---|
| Twilio US A2P throughput | 1 SMS/sec per long code | Standard shared short code. Purchase additional numbers if higher throughput is needed. |
| Twilio MMS limit | 1 MMS/sec per number | Aspire V1 sends SMS only; MMS media URLs are stored on inbound but not sent outbound. |
| Twilio API rate limit | 100 req/sec per account | Applies to Messages.create calls. |

If throughput requirements exceed 1 SMS/sec, provision additional numbers for the office and implement round-robin `from_number` selection in `send_sms()` (Pass 18+ work).

---

## Receipt Coverage Reference

| Event | Receipt type | Tier |
|---|---|---|
| Outbound send | `sms_outbound` | yellow |
| Delivery terminal status | `sms_status_update` | green |
| Inbound ingestion | `memory_write` (via MemoryService) | green |

Inbound SMS receipts are cut by the base `MemoryService.write()` path, not by the SMS adapter directly. If a `memory_write` receipt is missing for an inbound SMS, see [office-memory-engine.md](office-memory-engine.md) for the MemoryService receipt coverage procedures.
