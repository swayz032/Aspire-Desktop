# Ava Video (Anam) Runbook

**Owner:** Aspire Desktop · **Last updated:** 2026-05-05 · **Severity if down:** P1 (primary AvA experience)

This runbook covers the Anam-powered Ava video session: session mint, iframe bootstrap, WebRTC handshake, and the failure modes that surface as a stuck "Connecting…" spinner.

---

## 1. Architecture (V1)

```
User click → handleConnectToAva (AvaDeskPanel.tsx:919)
  → POST /api/anam/session (server/routes.ts:5043) — mints ephemeral Anam session token
  → setAnamSessionToken → renders iframe with srcDoc (buildAvaVideoFrameDoc, L117)
    → import('https://esm.sh/@anam-ai/js-sdk@4.12.0')
    → sdk.createClient(sessionToken, { sessionOptions, voiceDetection })
    → addListener(SESSION_READY | CONNECTION_ESTABLISHED) → postMessage({type:'connected'})
    → addListener(CONNECTION_CLOSED) → postMessage({type:'closed', code, codeLabel})
    → await client.streamToVideoElement('anam-video') (Promise.race with 25s inner timeout)
  → parent receives 'connected' → setVideoState('connected')
```

**Anam SDK is pinned to 4.12.0** and **self-hosted on Railway** at `/vendor/anam/4.12.0/index.js` (built by `scripts/build-anam-sdk.mjs` during `npm run build`). 4.13.0 introduced a regression that silently hangs `streamToVideoElement`. Bump intentionally with QA only.

### Bumping the SDK version
1. `pnpm add -D @anam-ai/js-sdk@<new-version>` (root: `Aspire-desktop/`)
2. `npm run build:anam-sdk` — produces `public/vendor/anam/<new-version>/index.js`
3. Update the import path in `AvaDeskPanel.tsx:buildAvaVideoFrameDoc` to match the new version
4. Smoke test in dev (DevTools Console: watch `[AvaIframe]` logs)
5. Commit `package.json`, `pnpm-lock.yaml`, `public/vendor/anam/<new-version>/index.js`, `AvaDeskPanel.tsx`
6. Old version directories can be deleted after one full deploy cycle (no clients holding stale tabs)

---

## 2. Anam network requirements

### Endpoints to allow on ports 80/443 (TCP+UDP)
| Endpoint | Purpose |
|---|---|
| `https://api.anam.ai` | REST API (token mint, persona config) |
| `https://lab.anam.ai` | Anam Lab portal |
| `https://connect-eu.anam.ai` / `wss://connect-eu.anam.ai` | EU media server (WebRTC signaling + streaming) |
| `https://connect-us.anam.ai` / `wss://connect-us.anam.ai` | US media server |

### TURN media relay
Anam uses Metered TURN servers for relay when P2P fails. Full IP whitelist:
`https://www.metered.ca/static-content/stun-turn/turnserver-ip-whitelist/all.txt`

Required for any enterprise customer behind a strict egress firewall. Residential users typically don't need this.

### SSL inspection
Deep-packet-inspection proxies (Zscaler, Fortinet, Palo Alto, etc.) MUST bypass `*.anam.ai`. Decrypting WebSocket signaling will cause the connection to fail or disconnect mid-session.

### CSP (configured in `server/index.ts:394`)
- `script-src` is **same-origin only** for the Anam SDK — the SDK is self-hosted at `/vendor/anam/<version>/index.js`. esm.sh was removed from CSP on 2026-05-05.
- `connect-src` includes `https://*.anam.ai` and `wss://*.anam.ai` (covers `api`, `connect-eu`, `connect-us`).
- No `frame-src` for Anam needed — we use the SDK in a same-origin `srcDoc` iframe, not Anam's hosted Player iframe.

---

## 3. Symptom triage: "Connecting" never resolves

### Step 1 — open DevTools BEFORE clicking Connect
- **Network tab** — filter `anam`. Watch:
  - `POST /api/anam/session` status code (200 / 401 / 503 / pending forever)
  - `wss://connect-*.anam.ai` connection (101 Switching Protocols = good; never opens = network or auth)
- **Console tab** — filter `[AvaIframe]`. Each stage logs.

### Step 2 — read the new failure surface
Since the 2026-05-05 hardening patch, the UI now shows the actual reason:

| UI message | Meaning | Action |
|---|---|---|
| `Connect failed: Session 401: AUTH_REQUIRED` | User session expired | Sign in again |
| `Connect failed: Session 503: AVATAR_NOT_CONFIGURED` | `ANAM_API_KEY` missing on Railway | `railway variables` then set the key |
| `Connect failed: Session 503: ANAM_AVA_CONFIG_INVALID` | Prompt template or persona ID drifted | Check `server/routes.ts` `validateAnamAvaPromptAndConfig` errors in Railway logs |
| `Connect failed: session mint timed out (15s)` | Server hung — typically Supabase pooler stall | Check Supabase status; restart Railway service if persists |
| `Connect failed [sdk_import]: SDK_IMPORT_TIMEOUT` | `/vendor/anam/<version>/index.js` not reachable from the browser | Confirm Railway deploy ran `npm run build:anam-sdk`; check `curl https://www.aspireos.app/vendor/anam/4.12.0/index.js -I` returns 200 |
| `Connect failed [stream]: STREAM_TIMEOUT…` | WebRTC handshake stalled | TURN whitelist, SSL inspection, mic permission, or Anam media-server outage |
| `Connect failed [bootstrap]: …` | SDK threw during init | Read the appended message — usually token format or persona config |
| `Session ended (UNAUTHORIZED)` | Token rejected post-handshake | Token expired between mint and use; check clock skew |
| `Session ended (FORBIDDEN)` | Anam policy denied | Check API key, persona, llm permissions |

### Step 3 — match Console logs to flow stage
Last log printed identifies stuck stage:
- `start: importing Anam SDK 4.12.0…` then silence → CSP or esm.sh outage
- `SDK loaded` then silence → token validation by SDK failed (rare)
- `client created with sessionOptions` then silence → listeners registered, awaiting WebRTC
- `all listeners registered, calling streamToVideoElement…` then silence → **WebRTC handshake** is the bottleneck. Check:
  - Mic permission (browser site settings)
  - `wss://connect-*.anam.ai` reachability
  - TURN IP whitelist (corporate networks)
  - SSL inspection bypass

### Step 4 — server-side curl repro
```bash
curl -X POST https://www.aspireos.app/api/anam/session \
  -H "Authorization: Bearer <user-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"persona":"ava","profile":{}}' -i
```
Expect `200` with `{ sessionToken: "..." }`. Anything else points to server/config, not WebRTC.

---

## 4. Configuration reference

### Server (`server/routes.ts:5043`, `/api/anam/session`)
- `voiceDetectionOptions` (lines 5144-5157): `endOfSpeechSensitivity: 0.7`, `silenceBeforeSkipTurnSeconds: 30` (Anam max), `silenceBeforeAutoEndTurnSeconds: 1.5`, `speechEnhancementLevel: 0.5`.
- `voiceGenerationOptions`: speed 1.05, stability 0.5, similarity 0.75.
- `maxSessionLengthSeconds: 1800` (30 min hard cap).

### Client (`AvaDeskPanel.tsx`, `buildAvaVideoFrameDoc`)
- SDK version: `@anam-ai/js-sdk@4.12.0` (pinned).
- `createClient` options: `sessionOptions: { videoQuality: 'high' }`, `voiceDetection: { endOfSpeechSensitivity: 0.7 }`.
- Inner stream timeout: 25s (fires before parent's 40s outer timeout, with descriptive error).
- Fetch timeout for `/api/anam/session`: 15s via `AbortSignal.timeout`.

### Required env vars (Railway)
- `ANAM_API_KEY` — production Anam API key
- `ANAM_AVA_LLM_ID` — custom LLM ID for Aspire orchestrator routing (falls back to hosted)
- `ANAM_CUSTOM_LLM_ID` — alternate custom LLM ID (optional)
- `ANAM_PROMPT_STRICT_VALIDATION` — `true` to fail-closed on prompt drift

---

## 5. Known issues

- **SDK 4.13.0 hangs `streamToVideoElement`.** Stay on 4.12.0 until Anam ships a fix.
- **~~esm.sh is a moving target~~ — RESOLVED 2026-05-05.** SDK is now self-hosted at `/vendor/anam/<version>/index.js`. esm.sh removed from CSP. Bundle is 86 KB minified, version-pinned in the path for atomic cache invalidation.
- **Anam `silenceBeforeSkipTurnSeconds` max is 30s.** Anything higher returns HTTP 400.

---

## 6. Recovery procedures

### Immediate user-facing fix
1. Hard reload (`Cmd/Ctrl+Shift+R`) — clears stale token, re-mints.
2. Sign out / sign in — refreshes Supabase access_token.
3. Try a different browser (rules out extension/site-permission issues).

### Operator fix
1. Check Railway env: `railway run env | grep ANAM`
2. Check Anam status: `https://api.anam.ai/health` (if endpoint exists; otherwise hit a small persona endpoint).
3. Tail logs: `railway logs --service aspire-desktop | grep -i anam`
4. If WebRTC-side: confirm user network can reach `wss://connect-eu.anam.ai` (`wscat -c wss://connect-eu.anam.ai`).
5. **Verify self-hosted SDK bundle:** `curl https://www.aspireos.app/vendor/anam/_health` — should return `{ ok: true, bundles: [{ version, sizeKB, sha256, ... }] }`. A 503 means the build step was skipped on the last deploy; rerun `npm run build:anam-sdk` and redeploy. Wire this endpoint into UptimeRobot / Better Stack as a JSON health probe checking `ok === true`.

### Rollback
- The 2026-05-05 hardening patch is purely additive (timeouts, error messages). Revert by `git revert` of the AvaDeskPanel commit if a regression appears.

---

## 7. Related files

- `Aspire-desktop/components/desktop/AvaDeskPanel.tsx` — client iframe + handler
- `Aspire-desktop/server/routes.ts:5043` — session mint route
- `Aspire-desktop/server/index.ts:394` — CSP + COEP
- `Aspire-desktop/docs/runbooks/telephony.md` — sister runbook (Twilio voice)
