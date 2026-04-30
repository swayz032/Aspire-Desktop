---
subsystem: Sarah Receptionist — Personalization Webhook
version: v1.0
pass: 16 (Pass 16 — §16.D)
authored: 2026-04-29
owner: release-sre
---

# Sarah Personalization Webhook — Operations Runbook

## What This Runbook Covers

Pass 16 ships `POST /v1/sarah/personalization`. ElevenLabs fires this webhook at the start of every inbound call. Aspire resolves the tenant by `called_number`, assembles 16 dynamic variables, and returns them to EL so Sarah knows who she is answering for.

Latency budget: p95 <800ms. Missing this budget causes EL to time out the webhook and Sarah greets the caller with generic defaults.

Relevant source file: `backend/orchestrator/src/aspire_orchestrator/routes/sarah.py`

Related runbooks:
- [telephony.md](telephony.md) — number purchase and lifecycle (Pass 16 §16.B)
- [sms.md](sms.md) — SMS delivery on the same numbers

---

## Architecture

```
Inbound call
  │
  ├─ Twilio receives call on Aspire-owned number
  │
  ├─ EL media plane picks up (voice_url written by EL on import)
  │
  ├─ EL fires POST /v1/sarah/personalization   ← this webhook
  │     Headers:  ElevenLabs-Signature: <HMAC>
  │     Body:     {caller_id, agent_id, called_number, call_sid}
  │
  └─ Aspire response (must be <800ms):
        {
          type: "conversation_initiation_client_data",
          dynamic_variables: {
            business_name, first_name, last_name, industry,
            time_of_day, is_open_now, after_hours_mode, busy_mode,
            public_number_mode, catch_mode, greeting_name_override,
            pronunciation_override, routing_contacts_summary,
            routing_owner_phone, routing_sales_phone,
            routing_support_phone, routing_billing_phone,
            routing_scheduling_phone   ← 16 vars, all required
          },
          conversation_config_override: {
            agent: {first_message: "<greeting>", language: "en"}
          }
        }

DB queries (all must complete within ~600ms combined):
  tenant_phone_numbers   → resolve suite_id / office_id / tenant_id from called_number
  front_desk_configs     → after_hours_mode, busy_mode, public_number_mode, catch_mode
  front_desk_routing_contacts → routing_owner_phone, routing_sales_phone, etc.
  tenant_profiles        → business_name, industry
  office_profiles        → first_name, last_name, timezone
  business_hours         → is_open_now computation
```

EL contract requirement: `dynamic_variables` must include ALL custom variables defined on the agent. Missing keys break the agent for that call. The `_DEFAULT_DYN_VARS` dict in `routes/sarah.py` ensures all 16 keys are always present.

---

## Common Procedures

### Test the webhook locally

Start the orchestrator locally (`uvicorn aspire_orchestrator.server:app --port 8000`), then:

```bash
# Generate a test HMAC signature
# The secret must match ELEVENLABS_WEBHOOK_SECRET in your .env
WEBHOOK_SECRET="your-local-secret"
PAYLOAD='{"caller_id":"+12125550100","agent_id":"agent_6501kp71h69jfqysgd055hemqhrq","called_number":"+12125550198","call_sid":"CAtest1234"}'

TIMESTAMP=$(date +%s)
SIG=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${WEBHOOK_SECRET}" | awk '{print $2}')

curl -X POST http://localhost:8000/v1/sarah/personalization \
  -H "Content-Type: application/json" \
  -H "ElevenLabs-Signature: t=${TIMESTAMP},v1=${SIG}" \
  -d "${PAYLOAD}"
```

Expected response shape:

```json
{
  "type": "conversation_initiation_client_data",
  "dynamic_variables": {
    "business_name": "...",
    "is_open_now": true,
    "time_of_day": "morning",
    ...
  },
  "conversation_config_override": {
    "agent": {"first_message": "Good morning, thank you for calling ...", "language": "en"}
  }
}
```

If the `called_number` is not in `tenant_phone_numbers`, the endpoint returns 404 and cuts a `personalization_unknown_number` receipt.

---

### Inspect the EL webhook URL configuration

```bash
# Via EL API — verify the agent has the personalization webhook configured:
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  "https://api.elevenlabs.io/v1/convai/agents/agent_6501kp71h69jfqysgd055hemqhrq" | \
  python -m json.tool | grep -A5 "conversation_initiation"
```

The `platform_settings.workspace_overrides.conversation_initiation_client_data_webhook.url` field must point to `https://orchestrator.aspire.app/v1/sarah/personalization`.

If it is blank or wrong, update via EL dashboard: Conversational AI → Agents → Sarah-Receptionist → Platform Settings → Conversation Initiation Client Data Webhook.

---

### HMAC secret rotation

The `ELEVENLABS_WEBHOOK_SECRET` environment variable must match what EL has configured. Rotation steps:

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```

2. Update in EL dashboard: Sarah-Receptionist agent → Platform Settings → Webhook Secret.

3. Update in Railway:
   ```bash
   railway variables set ELEVENLABS_WEBHOOK_SECRET=<new-secret> --service aspire-orchestrator
   ```

4. Deploy:
   ```bash
   railway up --service aspire-orchestrator
   ```

5. Verify with a test event from the EL dashboard (Sarah-Receptionist → Platform Settings → Test Webhook). Expected: 200 response + `personalization_resolve` receipt in DB.

Rotation schedule: every 90 days. Track the rotation date in the EL dashboard webhook configuration notes field.

---

## Failure Modes

### Bad signature (401)

**Symptom:** Logs show `sarah_personalization invalid_signature`. Receipt `personalization_denied` with `reason_code=INVALID_SIGNATURE` is cut.

**Cause:** The HMAC secret in Railway does not match what EL is sending. Most common trigger: a previous secret rotation that only updated one side.

**Diagnosis:**
```bash
# Check current Railway env value (redacted in output, but confirms it is set)
railway variables --service aspire-orchestrator | grep ELEVENLABS_WEBHOOK_SECRET

# Check EL side via dashboard: Sarah-Receptionist → Platform Settings → Webhook Secret
```

**Recovery:** Re-run the HMAC secret rotation procedure above, ensuring both sides are updated atomically.

If frequency >0 on a healthy deployment (not during rotation), investigate whether EL changed its signing algorithm. Check EL changelog.

---

### Missing webhook secret (503 MISCONFIGURED)

**Symptom:** Endpoint returns 503 with `{"error": "MISCONFIGURED", "message": "EL webhook secret not set"}`. Receipt `personalization_denied` with `reason_code=MISSING_WEBHOOK_SECRET` is cut.

**Cause:** `ELEVENLABS_WEBHOOK_SECRET` is unset in Railway. This is a hard fail-closed by design (Pass 18 fix): an unset secret previously allowed unauthenticated POSTs through in environments where the variable was not configured.

**Recovery:**
```bash
railway variables set ELEVENLABS_WEBHOOK_SECRET=<secret> --service aspire-orchestrator
railway up --service aspire-orchestrator
```

The secret value must match what is configured in the EL dashboard.

---

### Unknown called_number (404)

**Symptom:** Logs show `sarah_personalization unknown_number`. Receipt `personalization_unknown_number` with `reason_code=UNKNOWN_NUMBER` is cut. Sarah picks up and uses generic defaults.

**Cause:** Either (a) the number was released but EL still has it registered, or (b) the `tenant_phone_numbers` row is missing or has `status != 'active'`.

**Diagnosis:**
```sql
-- Check number status in DB
SELECT id, phone_number, status, elevenlabs_phone_number_id, purchased_at, released_at
FROM public.tenant_phone_numbers
WHERE phone_number = '<CALLED_NUMBER>';
```

If status is `released`: the number was intentionally released. EL should be detached (if not, see [telephony.md](telephony.md) orphan procedure).

If no row exists: the number was never purchased through Aspire, or migration 102 has not run. Check migration status:
```sql
SELECT version FROM public.schema_migrations WHERE version = '102';
```

If status is `reserved`: the purchase flow stalled. See telephony.md "Purchase stuck at reserved".

---

### Latency >800ms

**Symptom:** EL logs show webhook timeout; Sarah greets with default variables. Application logs show slow DB queries.

**Cause:** One or more of the 6 DB queries in the personalization path is slow. Most likely: missing index on `tenant_phone_numbers.phone_number`, `front_desk_configs.office_id`, or `business_hours.office_id`.

**Diagnosis:**
```sql
-- Check slow query log (pg_stat_statements)
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
WHERE query ILIKE '%tenant_phone_numbers%'
   OR query ILIKE '%front_desk_configs%'
   OR query ILIKE '%business_hours%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**Short-term mitigation:** Pass 18+ Lane 2 ships a Redis cache fallback for `front_desk_configs` (returns STALE flag but keeps Sarah running). Until then, check Supabase connection pool utilization and connection count.

**Long-term fix:** Add covering indexes if missing:
```sql
CREATE INDEX IF NOT EXISTS idx_tenant_phone_numbers_phone ON public.tenant_phone_numbers(phone_number) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_front_desk_configs_office ON public.front_desk_configs(office_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_business_hours_office ON public.business_hours(office_id);
```

---

### PostgREST injection attempt (INVALID_CALLED_NUMBER in logs)

**Symptom:** Logs show `sarah_personalization invalid_called_number_format`. Receipt `personalization_denied` with `reason_code=INVALID_CALLED_NUMBER` is cut.

**Cause:** Pass 18 fix THREAT-014 added E.164 regex validation before building any PostgREST filter string. A forged HMAC with a valid signature but a malformed `called_number` (e.g., containing `&suite_id=neq.<uuid>` to broaden the tenant match) now hits this path.

If this receipt appears with a valid EL signature, it means either:
1. EL sent a malformed number (unlikely — check EL changelog), or
2. Someone has obtained the HMAC secret and is attempting injection.

**Response:** If case 2, rotate the HMAC secret immediately (procedure above) and open a security incident.

---

## Fallback Behavior

If `front_desk_configs` has no row for the office, Sarah falls back to:

```python
_DEFAULT_DYN_VARS = {
    "business_name": "your business",
    "industry": "professional_services",
    "after_hours_mode": "take_message",
    "busy_mode": "take_message",
    ...
}
```

Callers will hear: "Good [time], thank you for calling your business. This is Sarah..."

This is acceptable for a first call before the Front Desk Setup wizard is completed. Guide the office through Front Desk Setup to populate `front_desk_configs` and `tenant_profiles`.

---

## Rotation Schedule

| Secret / Config | Rotation Interval | Owner |
|---|---|---|
| `ELEVENLABS_WEBHOOK_SECRET` | 90 days | on-call engineer |
| EL Sarah-Receptionist agent tools | On Pass deploy | release-sre |
| `TWILIO_AUTH_TOKEN` | On demand (incident) | on-call engineer |
