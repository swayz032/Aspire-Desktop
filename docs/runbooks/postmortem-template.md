---
subsystem: All
version: v1.0
authored: 2026-04-29
owner: release-sre
---

# Aspire Postmortem Template

Copy everything below the horizontal rule into a new file named `postmortem-YYYY-MM-DD-<short-title>.md` in `docs/postmortems/`. Fill in every section. Incomplete postmortems are not accepted.

---

# Postmortem: \<incident title\>

**Date:** YYYY-MM-DD
**Author:** \<name\>
**Status:** Draft / Reviewed / Accepted
**Severity:** SEV1 / SEV2 / SEV3
**Duration:** HH:MM UTC start — HH:MM UTC resolved (N hours M minutes)

---

## Summary

3–5 sentences. What happened, who was affected, how long, what is now fixed. Write this last — after you have filled in the rest.

---

## Impact

- **Tenants affected:** \<count + names if ≤10\>
- **User-facing symptom:** \<what users/callers experienced\>
- **Data integrity:** any data loss? incorrect receipts written? cross-tenant rows read or written?
- **Aspire Laws affected:**
  - Law #N — \<how it was violated or strained\>
  - _(list only violated laws; omit laws that held)_

---

## Timeline (UTC)

All times UTC. Be precise to the minute.

| Time | Event |
|---|---|
| YYYY-MM-DD HH:MM | First signal: \<alert fired / user report / oncall noticed\> |
| HH:MM | Investigation started. On-call engineer engaged. |
| HH:MM | Hypothesis: \<first guess at root cause\> |
| HH:MM | Hypothesis confirmed / rejected. |
| HH:MM | Root cause identified. |
| HH:MM | Mitigation deployed: \<what was done\> |
| HH:MM | Service fully restored. Monitoring confirmed healthy. |
| HH:MM | Postmortem started. |

---

## Root Cause

What broke. Be technical and specific. Reference:
- File paths and line numbers if a code bug
- Migration number if a schema change caused it
- Commit SHA if a recent deploy introduced it
- External service (Twilio, EL, Supabase) if the root cause is upstream

---

## Contributing Factors

List anything that made this incident worse than it had to be:

- Monitoring gap that delayed detection (e.g., alert threshold too loose)
- Test gap that let this reach production (e.g., edge case not covered by evil tests)
- Operational gap (e.g., runbook did not cover this failure mode)
- Design debt (e.g., in-memory idempotency store not persistent across pod restarts)

---

## Resolution

What was done to fix it. Include:
- Any config change (env variable, feature flag)
- Any rollback step taken (which rollback procedure from which runbook)
- Any manual data correction applied (SQL statements run, receipts manually cut)
- Deploy command used to ship the fix

---

## Action Items

Every action item must have an owner, severity, and due date. SEV1 AIs are treated as P0 — they block the next release.

| ID | Action | Owner | Severity | Due |
|---|---|---|---|---|
| AI-1 | \<specific action — not "investigate", but "add index on tenant_phone_numbers.phone_number"\> | \<name\> | SEV1 | YYYY-MM-DD |
| AI-2 | \<action\> | \<name\> | SEV2 | YYYY-MM-DD |

Severities:
- **SEV1** — prevents recurrence of the same failure; blocks next release
- **SEV2** — reduces blast radius or improves detection; due within 2 weeks
- **SEV3** — nice-to-have improvement; scheduled in next planning cycle

---

## Lessons Learned

Three categories — fill all three:

**What worked well in our response:**
- e.g., the runbook had the exact SQL query needed to diagnose the stuck row

**What did not work well:**
- e.g., alert fired 8 minutes after the first failure because threshold was per-5-min window

**What surprised us:**
- e.g., Twilio 429 does not retry automatically — we expected it would

---

## Receipts Cut During the Incident

Every action taken during incident response must produce a receipt (Law #2). List all receipts cut during diagnosis and mitigation.

| Receipt ID | Type | When | What it records |
|---|---|---|---|
| \<uuid\> | `incident_start` | HH:MM | Investigation opened |
| \<uuid\> | `\<receipt_type\>` | HH:MM | \<what was done\> |
| \<uuid\> | `incident_resolved` | HH:MM | Service restored, monitoring confirmed |

If any actions were taken without a receipt (e.g., a manual DB UPDATE with no receipt cut), list them as AI items above.

---

## Related

- PR that landed the fix: \<link\>
- Linked plan file if this maps to a planned hardening item: \<path\>
- Linked runbook that was updated as a result: \<path\>

---

---

# Example: Completed Postmortem

The following is a fictitious example showing correct structure and depth.

---

# Postmortem: Sarah Receptionist — All Inbound Calls Receiving Generic Greeting (2026-05-03)

**Date:** 2026-05-03
**Author:** T. Swayz
**Status:** Accepted
**Severity:** SEV2
**Duration:** 02:14 UTC — 03:47 UTC (1 hour 33 minutes)

---

## Summary

Between 02:14 and 03:47 UTC on 2026-05-03, all inbound calls handled by Sarah Receptionist received a generic greeting ("Good morning, thank you for calling your business") instead of the tenant-specific greeting. The personalization webhook was returning HTTP 200 with default dynamic variables because the `ELEVENLABS_WEBHOOK_SECRET` environment variable was silently unset after a Railway environment promotion from staging to production at 01:58 UTC. No data loss occurred. All calls were answered; tenants experienced degraded but functional call handling. 47 calls were affected across 12 tenants over 93 minutes.

---

## Impact

- **Tenants affected:** 12 (all tenants with active phone numbers)
- **User-facing symptom:** Sarah greeted every caller as "your business" with no personalization. After-hours mode defaulted to `take_message` for all calls regardless of actual business hours.
- **Data integrity:** No data loss. All receipts written correctly. No cross-tenant leakage.
- **Aspire Laws affected:**
  - Law #3 — Fail closed violated: the prior version of the webhook bypassed HMAC verification when `ELEVENLABS_WEBHOOK_SECRET` was unset, allowing unauthenticated POSTs to return 200. Pass 18 fix (deployed in this incident) closes this.

---

## Timeline (UTC)

| Time | Event |
|---|---|
| 2026-05-03 01:58 | Railway env promotion: staging env copied to production. `ELEVENLABS_WEBHOOK_SECRET` was not set in staging, so it was overwritten to empty in production. |
| 02:14 | First affected call. EL fires webhook → Aspire returns 200 with defaults. No alert fired (no metric for default-variable rate). |
| 02:41 | Tenant "Coastal Dental" submits support ticket: "Sarah isn't saying our name". |
| 02:53 | On-call engineer (T. Swayz) engaged. |
| 03:02 | Hypothesis: env variable issue. Checked Railway — confirmed `ELEVENLABS_WEBHOOK_SECRET` is empty string. |
| 03:08 | Root cause confirmed: empty secret causes `sarah.py:verify_elevenlabs()` to skip verification and return defaults. |
| 03:12 | Fix deployed: (a) `ELEVENLABS_WEBHOOK_SECRET` restored from AWS Secrets Manager, (b) code patched to fail-closed when secret unset (Pass 18 fix). |
| 03:31 | Deploy completed. Test call confirmed tenant-specific greeting returned. |
| 03:47 | All tenants verified. Service fully restored. |
| 04:10 | Postmortem started. |

---

## Root Cause

Railway's "promote staging to production" operation copies all environment variables from staging to production, overwriting any production-only variables that do not exist in staging. `ELEVENLABS_WEBHOOK_SECRET` is intentionally not set in staging (staging uses a different EL workspace). The promotion silently cleared the production secret.

Additionally, the prior implementation of `sarah.py` had a logic flaw:

```python
# OLD (vulnerable):
if el_secret and not verify_elevenlabs(body, sig_header, el_secret):
    raise HTTPException(401, ...)
# If el_secret is empty, the entire `if` block is skipped — verification bypassed.
```

Pass 18 fix (committed in this incident):

```python
# NEW (fail-closed):
if not el_secret:
    # fail closed — 503 MISCONFIGURED
    raise HTTPException(503, ...)
if not verify_elevenlabs(body, sig_header, el_secret):
    raise HTTPException(401, ...)
```

---

## Contributing Factors

- Railway env promotion is not blocked by a checklist — no gate requiring production-only variables to be verified after promotion.
- No alert existed for "personalization webhook returning default variables" — the only signal was a support ticket 27 minutes after impact started.
- Staging does not mirror production EL workspace, creating a permanent divergence in env variable sets.

---

## Resolution

1. Restored `ELEVENLABS_WEBHOOK_SECRET` from AWS Secrets Manager group `aspire/elevenlabs/credentials`.
2. Deployed Pass 18 fix to `sarah.py` — fail-closed when secret unset.
3. Verified with test curl against `POST /v1/sarah/personalization` using correct HMAC.

---

## Action Items

| ID | Action | Owner | Severity | Due |
|---|---|---|---|---|
| AI-1 | Add `personalization_unknown_secret_rate` Prometheus counter + alert (threshold: >0 over 1 min) | T. Swayz | SEV1 | 2026-05-10 |
| AI-2 | Document production-only env variables in Railway runbook; add to deployment checklist | T. Swayz | SEV1 | 2026-05-10 |
| AI-3 | Add Railway env promotion guard script: compare prod vs staging env keys, fail if prod-only keys are absent post-promotion | T. Swayz | SEV2 | 2026-05-17 |
| AI-4 | Add integration test: verify personalization webhook returns 503 when `ELEVENLABS_WEBHOOK_SECRET` is unset | T. Swayz | SEV2 | 2026-05-17 |

---

## Lessons Learned

**What worked well:**
- AWS Secrets Manager had the correct secret value; recovery was fast once root cause was identified.
- The code path was easy to reason about — minimal call stack from receipt to response.

**What did not work well:**
- 27-minute detection gap. Support ticket was faster than monitoring.
- Railway env promotion has no rollback — we had to manually restore from Secrets Manager.

**What surprised us:**
- The silent bypass behavior had existed since Pass 16 ship — it was not caught in any evil test because the evil test suite did not include "unset secret" as a test case.

---

## Receipts Cut During the Incident

| Receipt ID | Type | When | What it records |
|---|---|---|---|
| `rec_9a3f…` | `incident_start` | 02:53 | Investigation opened by on-call |
| `rec_4b71…` | `personalization_denied` | 03:12 | First call after fix — MISSING_WEBHOOK_SECRET path tested |
| `rec_c82e…` | `personalization_resolve` | 03:31 | First successful personalization post-fix |
| `rec_0d15…` | `incident_resolved` | 03:47 | Service restored, all tenants verified |

---

## Related

- Fix PR: `swayz032/aspire-backend#347` — Pass 18 fail-closed webhook secret patch
- Runbook updated: [sarah-personalization.md](sarah-personalization.md) — "Missing webhook secret" failure mode added
- Hardening item: `docs/plans/pass18-threat-fixes.md` THREAT-014 (already planned, accelerated)
