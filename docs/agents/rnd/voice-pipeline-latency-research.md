# R&D Report: Voice Pipeline Latency Optimization

## Date: 2026-03-21
## Classification: Research + Analysis
## Risk Tier: YELLOW (architecture changes to critical voice path)

---

## Executive Summary

The desktop voice pipeline takes 35-74 seconds to respond because of **Railway cold starts** (Python process spin-up) and **Ollama model loading** (safety gate), NOT because of inherent LangGraph architecture problems. The conversation path (intake -> safety -> classify -> agent_reason -> respond) should complete in 3-7 seconds when warm. Five complementary approaches can reduce perceived latency to under 3 seconds for 95%+ of interactions, all governance-compliant.

---

## 1. Current State Assessment

### Pipeline Architecture (verified from code)

```
User speaks
  -> STT (ElevenLabs Scribe or Deepgram Nova-3): ~500-800ms
  -> Desktop Express POST /api/orchestrator/intent (routes.ts:2937)
  -> Express proxy to ava-brain Railway internal
  -> LangGraph graph (13 nodes, dual-path):
     CONVERSATION PATH: intake -> safety_gate -> classify -> agent_reason -> respond
     ACTION PATH: intake -> safety_gate -> classify -> route -> param_extract -> policy -> approval -> token -> execute -> receipt -> qa -> respond
  -> Response text back through proxy
  -> TTS (ElevenLabs WebSocket multi-context): ~200-500ms
  -> Audio playback
```

### Where the 35-74 Seconds Come From

| Component | Warm Latency | Cold Latency | Evidence |
|-----------|-------------|--------------|----------|
| Railway cold start | 0ms | 15-45s | Python process + deps + graph compile |
| Ollama llama3:8b (safety_gate) | 500-2000ms | 10-30s | Model loading into VRAM |
| IntentClassifier (GPT-5-mini) | 800-2000ms | Same + connection setup | LLM API call |
| agent_reason (GPT-5-mini/5.2) | 1500-4000ms | Same | LLM API call with persona |
| respond_node | ~10ms | Same | Format only |
| Network hops (2x proxy) | ~100-200ms | Same | Express + Railway internal |
| TTS (ElevenLabs WS) | ~200-500ms | ~800ms (WS connect) | Already optimized |

**Warm total (conversation path): 3-7 seconds**
**Cold total: 35-74 seconds** (matches observed behavior exactly)

### Key Code Findings

1. **SSE streaming exists** but only streams activity events, not response text. Response is emitted as final event after full graph completion (server.py:638).

2. **Gateway proxy does NOT support SSE passthrough** - orchestrator-client.ts awaits full JSON response (line 113: `responseBody = await response.json()`). Desktop routes.ts has a SEPARATE SSE proxy endpoint (GET /api/orchestrator/intent?stream=true) that does pass through.

3. **useAgentVoice already has SSE path** (line 517-598) but it waits for `event.type === 'response'` before speaking. Activity events are not spoken.

4. **TTS accumulates ALL audio before playing** (line 617-620: accumulate in audioChunksRef, play on onContextDone). No sentence-level streaming.

5. **Graph dual-path works** - greetings route to conversation path (classify -> agent_reason -> respond), skipping the heavy action path. But still hits safety_gate + classify (2 LLM calls).

---

## 2. Industry Benchmarks (Cross-Validated)

| Threshold | User Perception | Source |
|-----------|----------------|--------|
| < 300ms | Indistinguishable from human | MMNTM Research, RevOrAI |
| 300-500ms | Natural, fast | Ultravox, TringTring.AI |
| 500-800ms | Acceptable for AI assistant | Trillet.AI benchmarks |
| 800-1500ms | Noticeable pause, still usable | Industry consensus |
| 1500-3000ms | "Something's wrong" feeling | Psychoacoustic research |
| > 3000ms | Users start talking over / abandon | CallSphere, MMNTM |

**Production leaders:**
- Vapi: 600-900ms (streaming LLM + sentence TTS)
- Bland.ai: 400-700ms (filler responses + streaming)
- Retell.ai: 500-800ms (word-level streaming TTS)
- LiveKit Agents: 500-1000ms (pipeline streaming)
- RevOrAI: 300ms claimed (optimized inference + edge TTS)

**Target for Aspire: < 3 seconds perceived (< 1 second for greetings)**

---

## 3. Ranked Recommendations

### Rank 1: Railway Keep-Alive + Ollama Warm Pool

**Expected improvement:** 35-74s -> 3-7s (eliminates cold starts)
**Implementation:** 30 minutes
**Risk:** NONE
**Governance:** COMPLIANT (no execution, no state change)

**How:**
- Uptime Kuma (already deployed, port 3000 Grafana) or n8n cron workflow pings `/healthz` every 2 minutes
- Add Ollama model pre-load to ava-brain startup: `ollama pull llama3:8b && ollama run llama3:8b ""` in Dockerfile/startup script
- Railway: Verify service is on a plan that doesn't sleep (Hobby+ does not sleep)

**Free-tier impact:** Uptime Kuma is self-hosted (free). n8n cron is free. Railway Hobby ($5/mo) does not sleep services.

**Decision Score:** Reliability 5, Simplicity 5, Free-tier 5, Risk 1, Coordination 3, Autopilot 5 = **24/30**

---

### Rank 2: Greeting Fast Path (Graph Optimization)

**Expected improvement:** 3-7s -> 200-500ms for greetings (~30-40% of interactions)
**Implementation:** 6-10 hours
**Risk:** LOW (false-positive regex -> falls through safely)
**Governance:** COMPLIANT (Law 1: still in graph; Law 2: emits receipt; Law 3: fail-closed to full pipeline)

**How:**
- New `fast_greeting` check in `intake_node` or new node between intake and safety_gate
- Regex/exact-match for known greetings: `^(hi|hello|hey|good morning|good afternoon|good evening|how are you|what's up)[\s!.?]*$`
- Require utterance < 8 words AND match to avoid false positives ("hello can you delete my account")
- If match: skip safety_gate + classify, go directly to respond with cached persona greeting
- Receipt: `greeting.fast_path` with utterance_hash (not raw text, Law 9)
- Cache: Dictionary of 5-10 greetings per agent persona, loaded at graph compile time

```python
# In graph.py, before safety_gate
GREETING_PATTERNS = re.compile(
    r'^(hi|hello|hey|good\s+morning|good\s+afternoon|good\s+evening|'
    r'how\s+are\s+you|what\'?s\s+up|howdy)[\s!.?]*$',
    re.IGNORECASE,
)

def _route_after_intake(state: OrchestratorState) -> str:
    utterance = state.get("utterance", "").strip()
    if utterance and len(utterance.split()) <= 8 and GREETING_PATTERNS.match(utterance):
        return "fast_greeting"
    return "safety_gate"
```

**Decision Score:** Reliability 4, Simplicity 4, Free-tier 5, Risk 2, Coordination 3, Autopilot 5 = **23/30**

---

### Rank 3: Streaming LLM + Sentence-Level TTS

**Expected improvement:** 3-7s -> 1.5-2.5s perceived for all non-cached queries
**Implementation:** 16-24 hours (high complexity, touches 4 layers)
**Risk:** MEDIUM (requires coordinated changes across brain, proxy, desktop)
**Governance:** COMPLIANT (streaming is presentation, not decision bypass)

**How (4-layer change):**

**Layer 1 - Brain (server.py + agent_reason.py):**
- Use OpenAI streaming API in agent_reason_node
- Buffer tokens until sentence boundary (`.`, `!`, `?`, `\n`)
- Emit SSE event: `{"type": "partial_response", "text": "sentence", "sentence_index": 0}`
- Final event unchanged: `{"type": "response", "data": full_response}`

**Layer 2 - Desktop Express SSE Proxy (routes.ts):**
- Already passes through SSE events (GET endpoint, lines 2671-2930)
- No changes needed for passthrough, but POST /api/orchestrator/intent needs SSE support
- Add: When request body has `stream: true`, proxy as SSE instead of awaiting JSON

**Layer 3 - useAgentVoice (hooks/useAgentVoice.ts):**
- Currently waits for `event.type === 'response'` before speaking
- Change: On `event.type === 'partial_response'`, send text to TTS immediately
- Buffer responses and concatenate for onResponse callback

**Layer 4 - TTS WebSocket (lib/tts-websocket.ts):**
- Already supports multi-context streaming
- Each sentence = speak() + flush() on same context
- Audio plays as it arrives (change from accumulate-all to play-as-ready)

**Decision Score:** Reliability 4, Simplicity 3, Free-tier 5, Risk 3, Coordination 4, Autopilot 4 = **23/30**

---

### Rank 4: Response Cache (Redis)

**Expected improvement:** Sub-200ms for cache hits on repeated queries
**Implementation:** 4-6 hours
**Risk:** LOW
**Governance:** COMPLIANT (cache keyed by suite_id per Law 6; receipts still generated)

**How:**
- Redis cache in brain: key = `voice_cache:{suite_id}:{agent}:{sha256(utterance_lower)}`
- TTL: 5 minutes for greetings, 60 seconds for other conversations
- Cache stores: `{response_text, persona_used, cached_at}`
- On cache hit: emit `intent.cached` receipt, return immediately
- On cache miss: full pipeline, store result
- Invalidation: on persona config change, flush agent's cache

**Decision Score:** Reliability 4, Simplicity 5, Free-tier 5, Risk 2, Coordination 3, Autopilot 5 = **24/30**

---

### Rank 5: Fast Acknowledgment for Slow Actions

**Expected improvement:** 0ms perceived (immediate voice) for YELLOW/RED actions
**Implementation:** 2-4 hours
**Risk:** LOW but adds conversation complexity
**Governance:** COMPLIANT (acknowledgment is not execution)

**How:**
- After classify_node returns ACTION path, immediately emit acknowledgment via SSE
- Agent-specific acknowledgments: "Let me look into that for you" (Ava), "Checking the numbers" (Finn)
- TTS speaks acknowledgment while graph continues (action path: route -> policy -> execute)
- When action completes, speak the real response

**Decision Score:** Reliability 3, Simplicity 4, Free-tier 5, Risk 3, Coordination 2, Autopilot 3 = **20/30**

---

## 4. Recommended Implementation Order

### Wave 1: Emergency Fix (30 min, deploy same day)
- [ ] Railway keep-alive ping (Uptime Kuma or n8n cron, every 2 min)
- [ ] Ollama model pre-load in ava-brain startup script
- **Result:** 35-74s -> 3-7s

### Wave 2: Greeting Fast Path (6-10 hours)
- [ ] Regex greeting matcher in graph.py
- [ ] Cached persona greetings (5-10 per agent)
- [ ] fast_path receipt generation
- [ ] Tests: greeting detection, false-positive prevention, receipt coverage
- **Result:** Greetings at 200-500ms

### Wave 3: Streaming Pipeline (16-24 hours)
- [ ] OpenAI streaming in agent_reason_node
- [ ] Sentence-level SSE events from brain
- [ ] Express SSE proxy for POST requests
- [ ] useAgentVoice partial_response handling
- [ ] TTS sentence-level playback
- [ ] Tests: streaming correctness, sentence boundary detection, TTS timing
- **Result:** All conversations at 1.5-2.5s perceived

### Wave 4: Polish (6-10 hours)
- [ ] Redis response cache
- [ ] Fast acknowledgment for action path
- [ ] Latency metrics dashboard (Prometheus histogram)
- [ ] Tests: cache invalidation, acknowledgment UX
- **Result:** 95%+ interactions under 3s

---

## 5. Free-Tier & Open-Source Stack

| Tool | Purpose | Free-Tier Limit | At-Limit Behavior |
|------|---------|----------------|-------------------|
| Uptime Kuma | Keep-alive pings | Self-hosted, unlimited | N/A |
| Redis 7 | Response cache | Already deployed (WSL) | N/A |
| OpenAI API | Streaming LLM | Pay-per-token (same cost) | No change |
| ElevenLabs WS | Sentence-level TTS | Same char quota | No change |
| Prometheus | Latency histograms | Self-hosted, unlimited | N/A |
| Railway Hobby | No sleep | $5/mo baseline | Overage charged |

---

## 6. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Greeting regex false positive | LOW | User gets wrong response | Require < 8 words + exact pattern match; fail-closed to full pipeline |
| Streaming sentence boundary breaks mid-word | MEDIUM | Garbled TTS | Conservative boundary detection (`.!?\n` only), min 10 chars per sentence |
| TTS WebSocket drops during streaming | LOW | Partial audio | HTTP streaming fallback already exists |
| Redis cache serves stale persona | LOW | Outdated greeting style | 5-min TTL + invalidation on persona change |
| Railway still cold-starts despite pings | LOW | 15-45s occasional | Monitor with Prometheus; alert on response_time > 5s |

---

## 7. Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| P50 voice response time | ~45s | < 2s | Prometheus histogram on /v1/intents |
| P95 voice response time | ~74s | < 5s | Prometheus histogram |
| Greeting response time | ~45s | < 500ms | Tagged metric for greeting fast path |
| Time to first audio | ~45s | < 1.5s | Client-side trace event |
| Cold start incidents/day | Unknown | 0 | Uptime Kuma alert on /healthz > 5s |
| User voice session abandonment | Unknown | < 5% | Client-side endSession without response |
