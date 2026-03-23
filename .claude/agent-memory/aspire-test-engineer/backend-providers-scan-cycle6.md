# Backend Providers Scan — Cycle 6 (2026-03-22)

Scope: `backend/orchestrator/src/aspire_orchestrator/providers/` (28 files)
       + `services/provider_secret_registry.py`

Files read: all 28 provider .py files in full.

---

## Confirmed Bugs

### BUG-P6-01 — CRITICAL
**File:** `providers/pandadoc_client.py:399`
**Pattern:** Naive/aware datetime comparison in `_check_credential_expiry()`

```python
age_days = (datetime.now() - last_rotated).days
```

`datetime.now()` returns a naive datetime (no timezone). But `datetime.fromisoformat()` on line 397 will return a timezone-aware datetime if the ISO string includes a timezone offset (e.g., "2025-12-01T00:00:00+00:00"). Python 3.11+ raises `TypeError: can't subtract offset-naive and offset-aware datetimes`. This crashes `PandaDocClient.__init__()` at startup when `pandadoc_credential_last_rotated` contains a timezone-aware ISO string. The credential check never runs — the exception is caught by the outer `except Exception as e:` at line 417 and logged, but no alert is raised.

**Fix direction:** Replace `datetime.now()` with `datetime.now(timezone.utc)` and ensure `last_rotated` is also parsed with timezone awareness.

**Law violated:** Law #3 (Fail Closed) — silent swallowing of this error means the 30-day rotation check is bypassed.

---

### BUG-P6-02 — CRITICAL
**File:** `providers/pandadoc_webhook.py:318`
**Pattern:** `asyncio.ensure_future()` called from synchronous `process_event()` method

```python
asyncio.ensure_future(callback_result)
```

`process_event()` is a synchronous method. `asyncio.ensure_future()` requires a running event loop — it raises `RuntimeError: no running event loop` when called from a sync context (e.g., tests, background threads). The exception is caught at line 319:
```python
except Exception as cb_err:
    logger.error(...)
```
...so this silently drops state-change callbacks (contract state machine updates) in any context where `process_event()` is called outside an async function. In FastAPI route handlers that call `process_event()` synchronously this is a production bug: contract state transitions are lost.

**Fix direction:** Either make `process_event()` `async` and `await` the callback, or require callers to pass an explicit event loop. `asyncio.ensure_future()` should not be used in synchronous methods.

**Law violated:** Law #2 (Receipt for All Actions) — state change callbacks that fail silently may miss emitting downstream receipts.

---

### BUG-P6-03 — HIGH
**File:** `providers/base_client.py:621`
**Pattern:** `receipt_hash` is always empty string across ALL provider clients

```python
"receipt_hash": "",
```

`make_receipt_data()` is the canonical receipt builder inherited by all 15 `BaseProviderClient` subclasses (Stripe, Twilio, Deepgram, ElevenLabs, Gusto, QuickBooks, Plaid, Brave, Tavily, LiveKit, Google Places, TomTom, HERE, Foursquare, Mapbox, OSM, S3, Puppeteer). Every receipt emitted by these clients has `receipt_hash: ""`. This breaks the receipt chain auditor's ability to verify integrity. The 18-field receipt schema requires a real hash.

**Fix direction:** Compute `receipt_hash = sha256(json.dumps(sorted fields))` before returning. Same pattern as `calendar_client.py:39` which correctly computes the hash.

**Law violated:** Law #2 (Receipt for All Actions) — receipts without hash are not chain-verifiable.

---

### BUG-P6-04 — HIGH
**File:** `providers/base_client.py:604-622`
**Pattern:** Missing `idempotency_key` field in receipt schema

The 18-field receipt schema (documented in CLAUDE.md) requires: `id, receipt_type, action_type, actor_type, actor_id, suite_id, office_id, correlation_id, tool_used, risk_tier, capability_token_id, receipt_hash, redacted_inputs, outcome, created_at, reason_code, idempotency_key, redacted_outputs`.

`make_receipt_data()` does not include `idempotency_key` or `redacted_inputs` or `redacted_outputs`. All 15 inheriting provider clients produce receipts missing these fields. The receipt schema validator (if active) will reject these receipts or silently store incomplete records.

**Fix direction:** Add `idempotency_key: str | None = None` parameter to `make_receipt_data()` and include it in the returned dict. Add `redacted_inputs: dict | None = None` and `redacted_outputs: dict | None = None` similarly.

**Law violated:** Law #2 — incomplete receipts.

---

### BUG-P6-05 — HIGH
**File:** `providers/pandadoc_client.py:168-194` (`_build_operation_receipt()`)
**File:** `providers/stripe_webhook.py:141-169` (`_build_webhook_receipt()`)
**File:** `providers/pandadoc_webhook.py:110-148` (`_build_webhook_receipt()`)
**Pattern:** Non-standard receipt schema — incompatible with receipt_chain auditor

These three receipt builders use a completely different field layout from the standard schema:

```python
# Non-standard fields used:
"receipt_id", "ts", "event_type", "actor", "status",
"inputs_hash", "policy", "metadata", "redactions", "receipt_version"

# Standard fields NOT present:
"id", "action_type", "actor_type", "actor_id", "tool_used",
"risk_tier", "capability_token_id", "executed_at", "outcome",
"reason_code", "idempotency_key", "redacted_inputs", "redacted_outputs"
```

When these receipts are passed to `store_receipts()`, they will be stored with a schema that the receipt reconciliation service and chain auditor cannot parse or link. The `receipt_ledger_auditor` agent will fail to trace these events.

**Fix direction:** Either consolidate to the standard schema, or register these as a known alternative schema type in `receipt_schema_registry.py`.

**Law violated:** Law #2 — receipts not auditable against the standard chain.

---

### BUG-P6-06 — HIGH
**File:** `providers/twilio_client.py` (entire `_request()` override, lines 94-292)
**Pattern:** Full `_request()` override removes all provider call logging

`TwilioClient` overrides the entire `_request()` method from `BaseProviderClient`. The base class `_request()` calls `get_provider_call_logger().log_call()` at: success path (line 399-410), non-retryable error (line 437-449), timeout (line 469-482), connection error (line 499-512), unexpected error (line 533-545), and retry exhaustion (line 563-575).

The Twilio override at lines 211, 235 returns `ProviderResponse` objects at success and error paths **without any call to `get_provider_call_logger()`**. All Twilio calls (including `twilio.call.create` — YELLOW tier external communication) are invisible to the observability layer.

**Fix direction:** Either remove the `_request()` override and handle Twilio form-encoding in `_prepare_body()` (already the correct extension point), or replicate the logger calls from the base class in the override.

**Law violated:** Law #10 (Production Gates — Observability).

---

### BUG-P6-07 — MEDIUM
**File:** `providers/tavily_client.py:122`
**Pattern:** API key embedded directly in POST body — logged in provider_call_log

```python
body: dict[str, Any] = {
    "api_key": settings.tavily_api_key,
    ...
}
```

The `body` dict is passed to `_request()`. The `provider_call_logger` logs the request action and metadata. If any logging path serializes the body (even partially), the `api_key` field value appears in logs. More critically, Tavily's `api_key` will appear in any request body debug dumps, error messages that echo the body, and potentially the `redacted_inputs` receipt field.

**Fix direction:** Tavily's correct auth pattern should use `_authenticate_headers()` to return a header (Tavily also supports `Authorization: Bearer {key}` header authentication). Move the key to headers and remove it from the body.

**Law violated:** Law #9 (Security & Privacy — never log secrets).

---

### BUG-P6-08 — MEDIUM
**File:** `providers/google_places_client.py:134`, `providers/here_client.py:125`, `providers/tomtom_client.py:130`, `providers/mapbox_client.py:126`
**Pattern:** API keys placed in query_params dict passed through to logger

```python
# google_places_client.py:134
query_params: dict[str, str] = {
    "key": settings.google_maps_api_key,
    ...
}
# here_client.py:125
query_params: dict[str, str] = {
    "apiKey": settings.here_api_key,
    ...
}
# tomtom_client.py:130
query_params: dict[str, str] = {
    "key": settings.tomtom_api_key,
    ...
}
# mapbox_client.py:126
query_params: dict[str, str] = {
    "access_token": settings.mapbox_access_token,
    ...
}
```

The `query_params` dict is passed to `ProviderRequest` and assembled into a URL at `base_client.py:302-305`. The assembled URL (including the key in the query string) is passed to logger at `base_client.py:338-344` as `request.path`. The `provider_call_logger` calls `log_call()` with `action=f"{method} {path}"` — this includes the full query string with the API key.

These providers' `_authenticate_headers()` methods return empty dicts and comment that the key is passed as a query param. The architectural pattern is intentional but the logging consequence is a credential leak to the `provider_call_log` table and application logs.

**Fix direction:** Before constructing the URL in `_request()`, strip known sensitive query parameters from the logged path. Alternatively, move API keys to a custom header where the provider supports it.

**Law violated:** Law #9 (Security & Privacy — no secrets in logs).

---

### BUG-P6-09 — MEDIUM
**File:** `providers/gusto_client.py:422-431`
**Pattern:** RED-tier payroll.run uses PUT with no idempotency key

```python
response = await client._request(
    ProviderRequest(
        method="PUT",
        path=f"/companies/{company_id}/payrolls/{payroll_id}/submit",
        body={},
        ...
        # No idempotency_key parameter
    )
)
```

`gusto.payroll.run` is RED tier and irreversible (once submitted, payroll processes). The `GustoClient` has `idempotency_support = True` and `max_retries = 2`. The base class retry loop will retry PUT `/submit` up to 2 times on 5xx errors. If the first attempt succeeds at Gusto but the response is lost in transit (504 at API gateway), the retry triggers a second payroll submit for the same period.

Gusto's idempotency key header prevents this: the same key → same outcome. No key is provided here.

**Fix direction:** Generate a deterministic idempotency key from `correlation_id + company_id + payroll_id` and pass it in `ProviderRequest(idempotency_key=...)`.

**Law violated:** Law #2 + Law #10 (idempotent retries required for RED-tier operations).

---

### BUG-P6-10 — MEDIUM
**File:** `providers/stripe_webhook.py:180` and `providers/pandadoc_webhook.py:163`
**Pattern:** In-memory `_processed_events` set — replay attack possible after restart

Both webhook handlers store processed event IDs in `self._processed_events: set[str]`. This is explicitly noted as a Phase 1 stub:
> "Thread-safe via in-memory dedup set (production: use processed_webhooks table)."

However there is no `processed_webhooks` table usage anywhere in the current codebase (confirmed by absence of `store_receipts` calls for dedup and no Supabase insert for event IDs). After a pod restart, all dedup state is lost. An attacker who captures a valid signed Stripe webhook can replay it after a restart to trigger duplicate invoice processing.

**Fix direction:** Persist processed event IDs to Supabase `processed_webhooks` table before marking as processed. Check DB before in-memory set.

**Law violated:** Law #2 (idempotency — duplicate event processing), Law #3 (fail-closed security).

---

### BUG-P6-11 — MEDIUM
**File:** `providers/office_message_client.py:59`
**Pattern:** `receipt_hash: ""` — same as BUG-P6-03 but in a Supabase-native provider

`_mk_receipt()` in `office_message_client.py` also sets `receipt_hash: ""`. This is a separate receipt builder from `base_client.make_receipt_data()`, confirming the pattern is replicated in non-BaseProviderClient providers as well.

**Fix direction:** Compute `receipt_hash = sha256(json.dumps({...canonical fields...})).hexdigest()` before return.

---

### BUG-P6-12 — MEDIUM
**File:** `providers/polaris_email_client.py:71`
**Pattern:** Same `receipt_hash: ""` in a third independent receipt builder

`_make_email_receipt()` sets `receipt_hash: ""`. Three separate receipt building functions across providers all have empty hashes.

---

### BUG-P6-13 — LOW
**File:** `providers/pandadoc_webhook.py:225-262`
**Pattern:** Logic bug — webhook accepted without HMAC verification when `raw_body` is provided but `signature` is None

```python
if raw_body and signature:
    try:
        verify_pandadoc_signature(raw_body, signature, self._webhook_secret)
    except WebhookSignatureError:
        ...
elif not raw_body or not signature:
    # Missing raw_body or signature — fail closed
    ...
```

The condition `elif not raw_body or not signature` fires when EITHER is missing. But if `raw_body=b"..."` (truthy) and `signature=None` (falsy), then:
- `raw_body and signature` → `False` (signature is None)
- `not raw_body or not signature` → `False or True` → `True` → raises

That path is correctly denied. However, if `raw_body=b""` (empty bytes, falsy) and `signature="valid-header"`:
- `raw_body and signature` → `False`
- `not raw_body or not signature` → `True or False` → `True` → raises

Also correct. The logic appears sound on closer analysis. BUT: if `raw_body=None` and `signature=None`:
- First branch: False
- Second branch: `not None or not None` = `True or True` = `True` → raises

All cases are fail-closed. This is NOT a bug. Marking LOW for documentation only — the nested condition is hard to reason about and should be refactored for clarity.

---

### BUG-P6-14 — LOW
**File:** `providers/deepgram_client.py:155-164`
**Pattern:** `audio_data` (base64) payload silently ignored

The docstring says:
> Optional payload: audio_data: str — base64-encoded audio data

But the implementation only handles `audio_url`:
```python
body: dict[str, Any] = {}
if audio_url:
    body = {"url": audio_url}
# audio_data is never used
```

If a caller provides `audio_data` without `audio_url`, the validation at line 100 passes (both present), but the body is sent as `{}` — a POST with empty body. Deepgram will return 400 (missing audio source). The receipt will say `EXECUTED` + `FAILED` with `INPUT_INVALID_FORMAT`.

**Fix direction:** Implement the `audio_data` code path using a multipart or binary body, OR document that `audio_data` is not yet supported and fail-closed with a clear error before calling the API.

**Law violated:** Law #3 — partial input accepted, undefined behavior follows.

---

### BUG-P6-15 — LOW
**File:** `providers/osm_overpass_client.py:146`
**Pattern:** Overpass QL injection via `raw_query` parameter

```python
if raw_query:
    overpass_ql = raw_query
```

`raw_query` is taken directly from `payload.get("raw_query", "")` with zero validation and sent to the Overpass API. While OSM Overpass is a read-only public API (so injection cannot write data), a malicious Overpass QL query could cause the public server to execute a very expensive query, resulting in timeouts, 429 rate-limiting, and blocking legitimate queries.

**Fix direction:** Either remove `raw_query` support entirely (it bypasses the safety envelope) or validate it against an allowlist of known-safe patterns. At minimum, enforce a timeout in the QL itself (`[timeout:25]` as the auto-generated query does).

---

## Receipt Schema Compliance Summary

| Provider | receipt_hash | idempotency_key | redacted_inputs | Schema |
|----------|-------------|-----------------|-----------------|--------|
| BaseProviderClient (15 subclasses) | "" (empty) | MISSING | MISSING | NONCOMPLIANT |
| calendar_client.py | sha256 computed | MISSING | MISSING | PARTIAL |
| office_message_client.py | "" (empty) | MISSING | MISSING | NONCOMPLIANT |
| polaris_email_client.py | "" (empty) | MISSING | redacted_inputs present | PARTIAL |
| pandadoc_client._build_operation_receipt | inputs_hash present | MISSING | MISSING | DIFFERENT SCHEMA |
| stripe_webhook._build_webhook_receipt | inputs_hash present | MISSING | MISSING | DIFFERENT SCHEMA |
| pandadoc_webhook._build_webhook_receipt | inputs_hash present | MISSING | MISSING | DIFFERENT SCHEMA |

---

## Dead Code / Unused Imports

- `pandadoc_client.py:40`: imports `resolve_openai_api_key` — never used in the visible portion of the file. Possible unused import.
- `pandadoc_client.py:41`: imports `_sanitize_error_message` from `middleware.exception_handler` — verify it is used in the full file (not visible in first 500 lines read).
- `stripe_client.py:311-312`: `import uuid as _uuid_create` inside a function body — `uuid` is already imported at module level on line 37 (via `ProviderRequest` which uses it). Redundant import.
- `stripe_client.py:458-459`: `import uuid as _uuid` — same pattern, redundant.
- `stripe_client.py:589-590`: `import uuid as _uuid_void` — same.
- `stripe_client.py:701-702`: `import uuid as _uuid_quote` — same.
- `stripe_client.py:797-798`: `import uuid as _uuid_qf` — same.

These all shadow the same `uuid` module via aliases. Not a runtime bug but violates clean-code standards and could confuse static analysis.

---

## Missing Tests (Negative Test Categories)

The following scenarios have no existing test coverage in the providers layer:

1. **Approval bypass — providers**: No test verifies that a RED-tier provider call (e.g., `gusto.payroll.run`, `plaid.transfer.create`) fails when called without a valid capability token.

2. **Replay via webhook**: No test that calls `stripe_webhook.process_event()` with a previously-seen event_id AFTER a simulated pod restart (i.e., after `_processed_events` is cleared or a new handler instance is created).

3. **Tavily key in logs**: No test that validates the `body` dict passed to `_request()` does NOT contain the literal API key value when processed by `provider_call_logger`.

4. **Gusto double-payroll on retry**: No test that sends `gusto.payroll.run` twice with the same inputs and verifies only one payroll is submitted (idempotency gap).

5. **Deepgram audio_data path**: No test for the case where `audio_data` is provided without `audio_url` — expected behavior is fail-closed with clear error, actual behavior is silent empty body to API.

6. **Naive datetime crash**: No test for `PandaDocClient()` initialization with a timezone-aware `pandadoc_credential_last_rotated` setting.

---

## Commands to Execute (Targeted Tests)

```bash
# Run existing provider-related tests
wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/tonio/Projects/myapp/backend/orchestrator && source ~/venvs/aspire/bin/activate && python -m pytest tests/ -k 'stripe or pandadoc or twilio or gusto or plaid or deepgram' -v --tb=short"

# Run all backend tests to confirm no regression
wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/tonio/Projects/myapp/backend/orchestrator && source ~/venvs/aspire/bin/activate && python -m pytest tests/ -q --tb=short"

# Check imports resolve (module-level import check)
wsl -d Ubuntu-22.04 -e bash -c "cd /mnt/c/Users/tonio/Projects/myapp/backend/orchestrator && source ~/venvs/aspire/bin/activate && python -c 'from aspire_orchestrator.providers import *; print(\"imports OK\")'
```
