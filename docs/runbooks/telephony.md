---
subsystem: Telephony — Twilio Number Lifecycle + EL Phone-Number Registration
version: v1.0
pass: 16 (Pass 16 — §16.B / §16.C)
authored: 2026-04-29
owner: release-sre
---

# Telephony — Operations Runbook

## What This Runbook Covers

Pass 16 telephony stack: one Twilio number per office, imported into ElevenLabs (EL) and attached to the shared Sarah Receptionist agent. This runbook covers number lifecycle (purchase, release, re-attach), failure recovery, and rollback.

Relevant source files:
- `backend/orchestrator/src/aspire_orchestrator/services/twilio_provisioning.py`
- `backend/orchestrator/src/aspire_orchestrator/services/elevenlabs_phone.py`
- `backend/orchestrator/src/aspire_orchestrator/routes/telephony.py`
- Migration 102 — tables: `tenant_phone_numbers`, `front_desk_configs`, `front_desk_routing_contacts`, `sms_messages`

Related runbooks:
- [sarah-personalization.md](sarah-personalization.md) — what happens on each inbound call
- [sms.md](sms.md) — SMS in/out on the numbers managed here

---

## Architecture

```
Aspire (Twilio account owner)
  │
  ├─ POST /v1/telephony/purchase-number (Yellow tier, capability token)
  │     │
  │     ├─ 1. Twilio: POST /Accounts/{sid}/IncomingPhoneNumbers.json
  │     │        → returns twilio_sid + registers sms_url + status_callback
  │     │
  │     ├─ 2. DB: INSERT tenant_phone_numbers (status='reserved')
  │     │
  │     ├─ 3. EL: POST /v1/convai/phone-numbers
  │     │        → EL writes voice_url on the Twilio number (EL handles auth)
  │     │
  │     ├─ 4. EL: PATCH /v1/convai/phone-numbers/{el_id}  {agent_id: Sarah}
  │     │        → number attached to Sarah Receptionist (agent_6501kp71h69jfqysgd055hemqhrq)
  │     │
  │     └─ 5. DB: UPDATE status='active', elevenlabs_phone_number_id, attached_to_agent_id
  │
  └─ Inbound call arrives
        Twilio → EL media plane → Sarah Receptionist agent
            → EL fires POST /v1/sarah/personalization (Aspire webhook)
            → Aspire returns dynamic_variables for this tenant

Release flow:
  DELETE /v1/convai/phone-numbers/{el_id}   ← EL detach first
  DELETE /Accounts/{sid}/IncomingPhoneNumbers/{twilio_sid}.json  ← Twilio release
  UPDATE tenant_phone_numbers SET status='released', released_at=now()
```

Sarah Receptionist agent ID (stable): `agent_6501kp71h69jfqysgd055hemqhrq`

---

## Common Procedures

### Purchase a new number for a tenant (manual fallback)

Use when the API or UI is broken and a tenant needs a number provisioned immediately.

**Step 1 — Search available numbers:**

```bash
# Via Twilio Console: https://console.twilio.com/us1/develop/phone-numbers/search
# Or via curl:
curl -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/AvailablePhoneNumbers/US/Local.json?AreaCode=212&PageSize=5"
```

**Step 2 — Purchase from Twilio and register:**

```bash
railway run --service aspire-orchestrator python -c "
import asyncio
from aspire_orchestrator.services.twilio_provisioning import purchase_number
from aspire_orchestrator.schemas.memory_v1 import ScopedIdentity
from uuid import UUID

async def main():
    scope = ScopedIdentity(
        tenant_id=UUID('<TENANT_ID>'),
        suite_id=UUID('<SUITE_ID>'),
        office_id=UUID('<OFFICE_ID>'),
    )
    result = await purchase_number(
        '+12125550100',
        scope=scope,
        idempotency_key='manual-provision-<YYYYMMDD>-<OFFICE_ID_PREFIX>',
        trace_id='manual',
    )
    print(result)

asyncio.run(main())
"
```

**Verify success:**

```sql
SELECT id, phone_number, twilio_sid, elevenlabs_phone_number_id, status, purchased_at
FROM public.tenant_phone_numbers
WHERE office_id = '<OFFICE_ID>'
ORDER BY purchased_at DESC
LIMIT 1;
```

Expected: `status = 'active'`, both `twilio_sid` and `elevenlabs_phone_number_id` populated.

---

### Release a number (manual fallback)

Use when the UI release fails or a tenant is being offboarded.

```bash
railway run --service aspire-orchestrator python -c "
import asyncio
from aspire_orchestrator.services.twilio_provisioning import release_number

async def main():
    # phone_number_id is the Aspire DB UUID (not the Twilio SID)
    await release_number(
        '<PHONE_NUMBER_DB_UUID>',
        trace_id='manual-release',
    )
    print('released')

asyncio.run(main())
"
```

**Verify:**

```sql
SELECT id, phone_number, status, released_at
FROM public.tenant_phone_numbers
WHERE id = '<PHONE_NUMBER_DB_UUID>';
```

Expected: `status = 'released'`, `released_at` populated.

Check EL list no longer includes the number:

```bash
# Via EL MCP (if available):
# mcp__elevenlabs__list_phone_numbers
# Or via curl:
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  https://api.elevenlabs.io/v1/convai/phone-numbers
```

---

### Re-attach a number to a different agent

When manually re-routing a number (e.g., testing with a staging Sarah agent):

```bash
railway run --service aspire-orchestrator python -c "
import asyncio
from aspire_orchestrator.services.elevenlabs_phone import attach_to_agent

async def main():
    await attach_to_agent('<EL_PHONE_NUMBER_ID>', agent_id='<TARGET_AGENT_ID>')
    print('attached')

asyncio.run(main())
"
```

Update the DB to reflect the new agent assignment:

```sql
UPDATE public.tenant_phone_numbers
SET attached_to_agent_id = '<TARGET_AGENT_ID>'
WHERE elevenlabs_phone_number_id = '<EL_PHONE_NUMBER_ID>';
```

Always return to Sarah Receptionist (`agent_6501kp71h69jfqysgd055hemqhrq`) when finished.

---

### Verify EL phone-number registration is healthy

```bash
# List all EL phone numbers registered in this workspace:
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  https://api.elevenlabs.io/v1/convai/phone-numbers | python -m json.tool
```

Cross-reference with DB:

```sql
SELECT phone_number, twilio_sid, elevenlabs_phone_number_id, status
FROM public.tenant_phone_numbers
WHERE status = 'active'
ORDER BY purchased_at;
```

Every `active` DB row must have a matching EL record with the same `phone_number`. Any DB row with `status = 'active'` and no EL counterpart is an orphan — see "Purchase stuck at reserved" below.

---

## Failure Modes + Recovery

### Purchase stuck at 'reserved'

**Symptom:** `tenant_phone_numbers` row has `status = 'reserved'` and `elevenlabs_phone_number_id IS NULL`.

**Diagnostic:**

```sql
SELECT id, phone_number, twilio_sid, status, purchased_at
FROM public.tenant_phone_numbers
WHERE status = 'reserved'
  AND purchased_at < now() - interval '5 minutes';
```

**Cause:** Twilio purchase succeeded (Step 1), but EL import (Step 3) or EL attach (Step 4) failed. The purchase receipt `phone_number_purchase_failed` was cut.

**Recovery — if EL is now healthy:**

```bash
railway run --service aspire-orchestrator python -c "
import asyncio
from aspire_orchestrator.services.elevenlabs_phone import import_to_elevenlabs, attach_to_agent
from aspire_orchestrator.services.supabase_client import supabase_update
import os

TWILIO_ACCOUNT_SID = os.environ['TWILIO_ACCOUNT_SID']
TWILIO_AUTH_TOKEN = os.environ['TWILIO_AUTH_TOKEN']

async def main():
    # Replace these with values from the stuck tenant_phone_numbers row
    phone_number = '+12125550100'
    twilio_sid_for_el = TWILIO_ACCOUNT_SID  # EL takes workspace SID, not number SID
    db_row_id = '<DB_ROW_UUID>'

    el_id = await import_to_elevenlabs(
        phone_number=phone_number,
        label='Office main line',
        twilio_sid=twilio_sid_for_el,
        twilio_token=TWILIO_AUTH_TOKEN,
    )
    await attach_to_agent(el_id)
    await supabase_update(
        'tenant_phone_numbers',
        f'id=eq.{db_row_id}',
        {'status': 'active', 'elevenlabs_phone_number_id': el_id,
         'attached_to_agent_id': 'agent_6501kp71h69jfqysgd055hemqhrq'},
    )
    print('recovered:', el_id)

asyncio.run(main())
"
```

**Recovery — if number has been reserved >24 hours:**

The Twilio number is still billing. Run `release_number()` to reverse:

```bash
railway run --service aspire-orchestrator python -c "
import asyncio
from aspire_orchestrator.services.twilio_provisioning import release_number

async def main():
    await release_number('<DB_ROW_UUID>', trace_id='manual-stale-reserved-cleanup')

asyncio.run(main())
"
```

This cuts a `phone_number_purchase_failed` receipt. The tenant must re-request a number.

---

### EL detach succeeds but Twilio release fails

**Symptom:** EL no longer lists the number, but Twilio Console still shows it active (still billing). DB row has `status = 'active'` (release was interrupted).

**Diagnostic:**

```sql
-- Find rows where EL detach likely happened but Twilio release didn't
SELECT id, phone_number, twilio_sid, status, elevenlabs_phone_number_id
FROM public.tenant_phone_numbers
WHERE status = 'active'
  AND elevenlabs_phone_number_id IS NULL;  -- EL detach cleared it already
```

Also check Twilio Console for the SID directly.

**Recovery — re-attempt Twilio DELETE:**

```bash
curl -X DELETE -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN" \
  "https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/IncomingPhoneNumbers/<TWILIO_SID>.json"
```

If Twilio returns 404, the number is already gone on Twilio's side. Mark released manually and cut a receipt:

```bash
railway run --service aspire-orchestrator python -c "
import asyncio, uuid
from datetime import datetime, timezone
from aspire_orchestrator.services import receipt_store
from aspire_orchestrator.services.supabase_client import supabase_update

async def main():
    db_row_id = '<DB_ROW_UUID>'
    now = datetime.now(timezone.utc).isoformat()
    await supabase_update(
        'tenant_phone_numbers',
        f'id=eq.{db_row_id}',
        {'status': 'released', 'released_at': now},
    )
    receipt_store.store_receipts([{
        'id': str(uuid.uuid4()),
        'receipt_type': 'phone_number_release',
        'outcome': 'success',
        'action_type': 'phone_number_release',
        'tool_used': 'manual_ops',
        'risk_tier': 'yellow',
        'reason_code': 'TWILIO_404_ALREADY_RELEASED',
        'redacted_inputs': {'db_row_id': db_row_id},
        'trace_id': 'manual-ops',
        'created_at': now,
    }])
    print('marked released + receipt cut')

asyncio.run(main())
"
```

---

### Idempotency cache miss after pod restart (duplicate purchase risk)

**Context:** The idempotency store in `twilio_provisioning.py` is in-memory (`_idem_store` dict). A pod restart clears it. If a client retries the same `idempotency_key` within 5 minutes of a pod restart, the dedup window may be missed.

**Mitigation (Phase 1):** Before any retry, query the DB first:

```sql
SELECT id, status, purchased_at
FROM public.tenant_phone_numbers
WHERE suite_id = '<SUITE_ID>'
  AND office_id = '<OFFICE_ID>'
  AND purchased_at > now() - interval '10 minutes'
ORDER BY purchased_at DESC
LIMIT 1;
```

If a row exists with `status = 'active'`, the first purchase succeeded — do not retry.

**Note:** Pass 18+ Lane 3 ships persistent idempotency (Redis/Supabase backed). Until then, this is the manual guard.

---

### Twilio rate limit (HTTP 429)

**Symptom:** `TWILIO_PURCHASE_NUMBER_FAILED` receipt with HTTP 429 in `reason_code`.

**Cause:** Twilio REST API rate limiting. Typically hits at >10 concurrent provisioning requests.

**Recovery:** Wait 30 seconds and retry. Pass 18+ Lane 2 ships a circuit breaker for the Twilio client. Until then, manual retry is the only option.

```bash
# Wait 30s, then retry the purchase via API or manual REPL
sleep 30
```

---

## Rollback Procedure

To fully reverse the Pass 16 telephony stack:

**Step 1 — Detach all numbers from Sarah in EL:**

```bash
# List all EL phone numbers and delete each
curl -H "xi-api-key: $ELEVENLABS_API_KEY" \
  https://api.elevenlabs.io/v1/convai/phone-numbers | \
  python -c "
import sys, json
data = json.load(sys.stdin)
records = data if isinstance(data, list) else data.get('phone_numbers', [])
for r in records:
    el_id = r.get('phone_number_id') or r.get('id')
    print(el_id)
" | while read el_id; do
  echo "Deleting EL phone number: $el_id"
  curl -X DELETE -H "xi-api-key: $ELEVENLABS_API_KEY" \
    "https://api.elevenlabs.io/v1/convai/phone-numbers/$el_id"
done
```

**Step 2 — Release all Twilio numbers:**

Release each number via Twilio Console (https://console.twilio.com) or via the Twilio CLI. Cut a `phone_number_release` receipt for each (use the manual receipt REPL snippet above).

**Step 3 — Drop migration 102 tables:**

```sql
-- DESTRUCTIVE — run only in a full rollback scenario
DROP TABLE IF EXISTS
  public.sms_messages,
  public.front_desk_routing_contacts,
  public.front_desk_configs,
  public.tenant_phone_numbers
CASCADE;
```

**Step 4 — Remove route registrations:**

In `backend/orchestrator/src/aspire_orchestrator/server.py`, comment out:

```python
# from aspire_orchestrator.routes import telephony as telephony_router_mod
# from aspire_orchestrator.routes import sms as sms_router_mod
# from aspire_orchestrator.routes import sarah as sarah_router_mod
# app.include_router(telephony_router_mod.router, ...)
# app.include_router(sms_router_mod.router, ...)
# app.include_router(sarah_router_mod.router, ...)
```

Deploy via `railway up` from `backend/orchestrator/`.

---

## Monitoring + Alerts

After Pass 18+ Lane 2 lands, these Prometheus metrics will be active:

| Metric | Labels | Alert threshold |
|---|---|---|
| `aspire_telephony_purchase_total` | `outcome=success\|failed` | `outcome=failed` rate >5% over 5 min |
| `aspire_telephony_release_total` | `outcome=success\|failed` | `outcome=failed` rate >5% over 5 min |
| `aspire_telephony_el_import_duration_seconds` | — | p95 >3s |

Until those metrics land, monitor via receipt counts in Supabase:

```sql
SELECT receipt_type, outcome, count(*), max(created_at)
FROM public.receipts
WHERE receipt_type IN ('phone_number_purchase', 'phone_number_purchase_failed',
                       'phone_number_release')
  AND created_at > now() - interval '1 hour'
GROUP BY 1, 2
ORDER BY 3 DESC;
```
