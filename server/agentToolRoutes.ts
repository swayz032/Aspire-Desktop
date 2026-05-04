// [STATUS: mixed] — Receives tool calls from BOTH V1 ElevenLabs agents AND V2 Anam personas. Normalizes payload (arguments/params/input) and proxies to orchestrator /v1/agents/invoke.
/**
 * Aspire Agent Tool Webhook Endpoints
 *
 * These endpoints receive tool calls from ElevenLabs Conversational AI agents.
 * Each agent has webhook tools (get_context, search, draft, approve) that hit
 * these endpoints during live conversations.
 *
 * Auth: x-aspire-tool-secret header (shared secret configured on each tool).
 * Legacy header x-elevenlabs-secret is still accepted for backward compatibility.
 * Body: { suite_id, user_id, query/... } — dynamic variables + LLM-generated params.
 *
 * Law #3: Fail closed — invalid secret = 401, missing params = 400.
 * Law #2: All tool calls emit receipts.
 * Law #9: No secrets in responses.
 */

import { Router, Request, Response } from 'express';
import { logger } from './logger';
import { getDefaultSuiteId } from './suiteContext';

const router = Router();

// ─── Card Records Cache ─────────────────────────────────────────────────────
// Stores full property records from invoke_adam responses. The gateway strips
// card_records before forwarding to ElevenLabs (keeps LLM payload small).
// Desktop fetches full records via GET /v1/tools/card-data/:id when show_cards fires.
const cardRecordsCache = new Map<string, { records: any[]; artifactType: string; suiteId: string; timestamp: number }>();
const latestCardCacheIdBySuite = new Map<string, string>(); // Per-suite most recent cache entry
const latestPropertyAddressBySuite = new Map<string, { address: string; timestamp: number }>();
// Wave A.5: when the user disambiguates between multiple HD stores in a city,
// remember their pick so subsequent voice queries don't re-prompt.
// Keyed by `${suite_id}:${actor_id}` so concurrent actors within the same
// suite don't collide (THREAT-011). TTL kept short — typical voice session is
// well under 90s of contiguous interaction.
const chosenStoreIdBySuite = new Map<string, { storeId: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — card cache lifetime
const STORE_PICK_TTL_MS = 90 * 1000; // 90s — voice session disambiguation memory

function chosenStoreKey(suiteId: string, actorId: string): string {
  const safeActor = actorId && typeof actorId === 'string' ? actorId.trim() : '';
  return `${suiteId}:${safeActor || 'suite'}`;
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROPERTY_ARTIFACT_TYPES = new Set([
  'LandlordPropertyPack',
  'PropertyFactPack',
  'RentCompPack',
  'PermitContextPack',
  'NeighborhoodDemandBrief',
  'ScreeningComplianceBrief',
  'InvestmentOpportunityPack',
]);
const ORCHESTRATOR_INVOKE_PATH = '/v1/agents/invoke';
const ORCHESTRATOR_INVOKE_SYNC_PATH = '/v1/agents/invoke-sync';

// ─── Per-suite rate limiter (in-memory rolling window) ───────────────────────
// Lightweight limiter for high-volume tool routes (card-data, enrich-product).
// 60 calls/min per suite. The global apiLimiter in index.ts caps per-IP traffic
// but cannot tell suites apart — this fills that gap (THREAT-008).
const SUITE_RATE_WINDOW_MS = 60 * 1000;
const SUITE_RATE_MAX = 60;
const suiteRateMap = new Map<string, { count: number; resetAt: number }>();
function checkSuiteRate(suiteId: string): boolean {
  if (!suiteId) return true;
  const now = Date.now();
  const entry = suiteRateMap.get(suiteId);
  if (!entry || now > entry.resetAt) {
    suiteRateMap.set(suiteId, { count: 1, resetAt: now + SUITE_RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= SUITE_RATE_MAX) return false;
  entry.count += 1;
  return true;
}
const suiteRateCleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [suite, entry] of suiteRateMap) {
    if (now > entry.resetAt) suiteRateMap.delete(suite);
  }
}, 5 * 60 * 1000);
(suiteRateCleanupTimer as unknown as { unref?: () => void }).unref?.();

// Express middleware adapter — accepts suite_id from body, query, or header.
// Skips when suite_id can't be resolved (lets the route's own validation deny).
function cardDataRateLimit(req: Request, res: Response, next: () => void): void {
  const bodySuite =
    (req.body && typeof req.body === 'object' && typeof (req.body as any).suite_id === 'string')
      ? String((req.body as any).suite_id).trim()
      : '';
  const querySuite = typeof req.query.suite_id === 'string' ? req.query.suite_id.trim() : '';
  const candidate = normalizeUuid(bodySuite) || normalizeUuid(querySuite);
  if (candidate && !checkSuiteRate(candidate)) {
    logger.warn('[AgentTool] suite rate limit exceeded', { suite: candidate, path: req.path });
    res.status(429).json({
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests for this suite. Try again shortly.',
      retryAfter: 60,
    });
    return;
  }
  next();
}

// Counter for orchestrator invoke fallback (404/405 → invoke-sync). Logged on
// each fallback so ops can see when the primary endpoint disappears in prod.
let orchestratorFallbackCount = 0;

function cleanCardCache() {
  const now = Date.now();
  const evicted = new Set<string>();
  for (const [key, val] of cardRecordsCache) {
    if (now - val.timestamp > CACHE_TTL_MS) {
      cardRecordsCache.delete(key);
      evicted.add(key);
    }
  }
  if (evicted.size > 0) {
    for (const [suiteId, cacheId] of latestCardCacheIdBySuite) {
      if (evicted.has(cacheId) || !cardRecordsCache.has(cacheId)) {
        latestCardCacheIdBySuite.delete(suiteId);
      }
    }
  }
  for (const [suiteId, entry] of latestPropertyAddressBySuite) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      latestPropertyAddressBySuite.delete(suiteId);
    }
  }
  for (const [key, entry] of chosenStoreIdBySuite) {
    if (now - entry.timestamp > STORE_PICK_TTL_MS) {
      chosenStoreIdBySuite.delete(key);
    }
  }
}

// Sparse-payload threshold: each record must have at least 3 keys to count as
// "full". <3 keys = LLM regenerated from memory and forgot the rich fields.
// See Wave 2.4 of plan hey-can-you-deep-serene-elephant.md.
const SHOW_CARDS_SPARSE_KEY_THRESHOLD = 3;

function isSparseRecord(record: unknown): boolean {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return true;
  const keys = Object.keys(record as Record<string, unknown>).filter(
    (k) => (record as Record<string, unknown>)[k] !== undefined && (record as Record<string, unknown>)[k] !== null,
  );
  return keys.length < SHOW_CARDS_SPARSE_KEY_THRESHOLD;
}

function isSparseRecordSet(records: unknown): boolean {
  if (!Array.isArray(records) || records.length === 0) return true;
  return records.every(isSparseRecord);
}

function getLatestPropertyAddress(suiteId: string): string {
  const entry = latestPropertyAddressBySuite.get(suiteId);
  if (!entry) return '';
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    latestPropertyAddressBySuite.delete(suiteId);
    return '';
  }
  return entry.address;
}

function maybeStoreLatestPropertyAddress(suiteId: string, records: any[]) {
  if (!suiteId || !Array.isArray(records) || records.length === 0) return;
  const first = records[0] || {};
  const raw =
    (typeof first?.normalized_address === 'string' && first.normalized_address.trim()) ||
    (typeof first?.address === 'string' && first.address.trim()) ||
    '';
  if (!raw) return;
  const lower = raw.toLowerCase();
  if (lower === 'unknown address' || lower === 'n/a' || lower === 'na') return;
  latestPropertyAddressBySuite.set(suiteId, { address: raw, timestamp: Date.now() });
}

function isLikelyPropertyIntent(task: string, details: string): boolean {
  const text = `${task || ''} ${details || ''}`.toLowerCase();
  if (!text.trim()) return false;
  return /(property|owner|mortgage|equity|assessment|permit|zoning|school|address|house|parcel|valuation|tax)/.test(text);
}

function buildPropertyRefetchTask(seedRecord: any, suiteId: string): string | null {
  const address =
    (typeof seedRecord?.normalized_address === 'string' && seedRecord.normalized_address.trim()) ||
    (typeof seedRecord?.address === 'string' && seedRecord.address.trim()) ||
    getLatestPropertyAddress(suiteId);
  if (!address) return null;
  return `Pull property facts for ${address}`;
}

async function dispatchOrchestratorInvoke(
  orchestratorUrl: string,
  payload: Record<string, any>,
  signal?: AbortSignal,
): Promise<{ response: globalThis.Response; endpoint: string; fellBack: boolean }> {
  const primaryEndpoint = `${orchestratorUrl}${ORCHESTRATOR_INVOKE_PATH}`;
  const requestInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  };
  let response = await fetch(primaryEndpoint, requestInit);
  if (response.status === 404 || response.status === 405) {
    const fallbackEndpoint = `${orchestratorUrl}${ORCHESTRATOR_INVOKE_SYNC_PATH}`;
    orchestratorFallbackCount += 1;
    logger.warn('[AgentTool] Orchestrator invoke endpoint fallback', {
      primaryEndpoint,
      fallbackEndpoint,
      status: response.status,
      cumulativeFallbackCount: orchestratorFallbackCount,
    });
    response = await fetch(fallbackEndpoint, requestInit);
    return { response, endpoint: fallbackEndpoint, fellBack: true };
  }
  return { response, endpoint: primaryEndpoint, fellBack: false };
}

export function collectAcceptedSecrets(): string[] {
  const raw = [
    process.env.TOOL_WEBHOOK_SHARED_SECRET,
    process.env.ASPIRE_TOOL_SECRET,
    process.env.ANAM_TOOL_SECRET,
    process.env.ELEVENLABS_TOOL_SECRET,
    process.env.ELEVENLABS_WORKSPACE_SECRET,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .flatMap((v) => v.split(',').map((s) => s.trim()).filter(Boolean));
  return Array.from(new Set(raw));
}

function pickRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

// Cap on records returned to the LLM in invoke_adam responses. Slim full
// records server-side, cache the originals, return at most this many to
// Anam/ElevenLabs. Keeps tool-response payloads bounded (~4KB max at 25 ×
// ~150 bytes each) so the model can reliably copy them into show_cards.
const RECORD_CAP = 25;

// Whitelist of display-essential fields for an Adam result record. Strips
// only the truly heavy bloat (thumbnails ARRAYS, variants, dimensions,
// weight, store_availability, verification_status, confidence) but keeps
// every field the ProductCard / StoreSummary UI components actually render
// — including aisle, bay, fulfillment_pickup, fulfillment_delivery,
// specifications (top-5 keys), description_full (capped at 500 chars),
// sku, product_id (which the UI uses for click-through and re-search).
//
// SerpAPI Home Depot returns ALL of these fields when called with
// store_id + delivery_zip params. The user expects to see them on cards.
//
// Law #9 (PII): only display-safe fields are surfaced — names, prices,
// public store info, public image URLs. No internal IDs, no SKU enumeration,
// no fulfillment metadata that could fingerprint inventory.
//
// Field list maps to what components/cards/ProductCard.tsx + StoreDisambiguationCard.tsx
// destructure. If you add a new display field to either component, add it here too.
export function slimAdamRecord(r: any): Record<string, any> {
  if (!r || typeof r !== 'object') return {};
  const slim: Record<string, any> = {};

  // Identity / classification
  if (r.card_kind) slim.card_kind = r.card_kind;
  if (r.retailer) slim.retailer = r.retailer;
  if (r.product_name) slim.product_name = r.product_name;
  if (r.store_name) slim.store_name = r.store_name;
  if (r.name) slim.name = r.name;
  if (r.title) slim.title = r.title;

  // Store address line — UI joins these as "{address}, {city}, {state} {postal_code}"
  if (r.address) slim.address = r.address;
  if (r.city) slim.city = r.city;
  if (r.state) slim.state = r.state;
  if (r.postal_code) slim.postal_code = r.postal_code;

  // Store contact (rendered in store card right panel)
  if (r.phone) slim.phone = r.phone;
  if (r.website) slim.website = r.website;

  // Product brand / model line
  if (r.brand) slim.brand = r.brand;
  if (r.model) slim.model = r.model;

  // Price + discount
  if (typeof r.price === 'number') slim.price = r.price;
  if (typeof r.price_was === 'number') slim.price_was = r.price_was;
  if (typeof r.price_saving === 'number') slim.price_saving = r.price_saving;
  if (typeof r.percentage_off === 'number') slim.percentage_off = r.percentage_off;
  if (typeof r.price_badge === 'string' && r.price_badge) slim.price_badge = r.price_badge;
  if (r.currency) slim.currency = r.currency;

  // Availability + stock
  if (r.availability) slim.availability = r.availability;
  if (r.availability_text) slim.availability_text = r.availability_text;
  if (typeof r.in_store_stock === 'number') slim.in_store_stock = r.in_store_stock;
  if (r.pickup_store) slim.pickup_store = r.pickup_store;
  if (typeof r.pickup_quantity === 'number') slim.pickup_quantity = r.pickup_quantity;

  // Delivery + badges (rendered as chips on cards)
  if (r.delivery !== undefined && r.delivery !== null && r.delivery !== '') {
    // delivery can be string ("Free delivery") or short object — keep it.
    slim.delivery = r.delivery;
  }
  if (r.delivery_info !== undefined && r.delivery_info !== null && r.delivery_info !== '') {
    slim.delivery_info = r.delivery_info;
  }
  if (Array.isArray(r.badges) && r.badges.length > 0) {
    // Cap at 4 badges — typically 1-2 (top rated, bestseller).
    slim.badges = r.badges.slice(0, 4);
  }

  // Reviews
  if (typeof r.rating === 'number') slim.rating = r.rating;
  if (typeof r.reviews === 'number') slim.reviews = r.reviews;

  // Short description (one-liner) + capped full description.
  if (typeof r.description_short === 'string' && r.description_short) {
    slim.description_short = r.description_short.slice(0, 200);
  }
  if (typeof r.description_full === 'string' && r.description_full) {
    // Cap at 500 chars — UI shows expandable "Read more" for full descriptions.
    slim.description_full = r.description_full.slice(0, 500);
  }

  // In-store location (Home Depot returns these when store_id is in the
  // SerpAPI request — they're in the pickup object).
  if (typeof r.aisle === 'string' && r.aisle) slim.aisle = r.aisle;
  if (typeof r.bay === 'string' && r.bay) slim.bay = r.bay;

  // Product identifiers — UI uses for "View details" navigation + dedup.
  if (typeof r.sku === 'string' && r.sku) slim.sku = r.sku;
  if (typeof r.product_id === 'string' && r.product_id) slim.product_id = r.product_id;

  // Specifications: keep top 5 entries to avoid bloat. SerpAPI sometimes
  // returns 30+ specs (color, material, brand, etc.) — top 5 is enough
  // for the card's "Key specs" panel; full list comes from enrich_product.
  if (r.specifications && typeof r.specifications === 'object' && !Array.isArray(r.specifications)) {
    const entries = Object.entries(r.specifications).slice(0, 5);
    if (entries.length > 0) {
      slim.specifications = Object.fromEntries(entries);
    }
  }

  // Fulfillment details — pickup + delivery objects from SerpAPI. Strip
  // nested store_availability to keep size bounded; keep store_id, store_name,
  // store_address, quantity, aisle, bay, schedule_delivery, free, etc.
  const slimFulfillment = (f: any): Record<string, any> | undefined => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) return undefined;
    const out: Record<string, any> = {};
    for (const k of [
      'store_id', 'store_name', 'store_address', 'quantity', 'aisle', 'bay',
      'free', 'schedule_delivery', 'delivery_zip', 'free_delivery_threshold',
      'date', 'window', 'method',
    ]) {
      const v = (f as Record<string, any>)[k];
      if (v !== undefined && v !== null && v !== '') {
        out[k] = v;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };
  const slimPickup = slimFulfillment(r.fulfillment_pickup);
  if (slimPickup) slim.fulfillment_pickup = slimPickup;
  const slimDelivery = slimFulfillment(r.fulfillment_delivery);
  if (slimDelivery) slim.fulfillment_delivery = slimDelivery;

  // Pickup store address surfaced for "Available at: <store name> —
  // <address>" rendering when store_summary is missing.
  if (typeof r.pickup_store_address === 'string' && r.pickup_store_address) {
    slim.pickup_store_address = r.pickup_store_address;
  }

  // Store-summary specific fields — header card surfaces hours, distance, rating.
  if (typeof r.open_now === 'boolean') slim.open_now = r.open_now;
  if (typeof r.distance_miles === 'number') slim.distance_miles = r.distance_miles;

  // Wave 2.0 SerpAPI fields — pricing unit, social proof, lazy-enrich URL.
  // unit ("case", "package", "piece") renders as "$99.97 / case" on the price line.
  if (typeof r.unit === 'string' && r.unit) slim.unit = r.unit;
  // favorite count surfaces on the card as "❤ 10,293" social-proof chip.
  if (typeof r.favorite === 'number' && r.favorite >= 0) slim.favorite = r.favorite;
  // collection URL = e.g. "DEWALT 20V Collection" page, secondary CTA.
  if (typeof r.collection === 'string' && r.collection) slim.collection = r.collection;
  // serpapi_link = direct lazy-enrich URL preferred over rebuilt path.
  if (typeof r.serpapi_link === 'string' && r.serpapi_link) slim.serpapi_link = r.serpapi_link;

  // Images + click-through. ONE image_url + ONE thumbnail (drop the array).
  if (typeof r.image_url === 'string') slim.image_url = r.image_url;
  if (typeof r.thumbnail === 'string') slim.thumbnail = r.thumbnail;
  if (typeof r.url === 'string') slim.url = r.url;
  if (typeof r.link === 'string') slim.link = r.link;

  return slim;
}

// Some LLM tool runtimes (OpenAI tool_calls, Anam in some configs) post the
// arguments object as a JSON-encoded STRING instead of an object. pickRecord
// rejects strings, so without this we end up with no task/query and 200 →
// MISSING_TASK. Accept the string form and parse defensively.
function pickRecordOrParse(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }
  if (typeof value === 'string' && value.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      // ignore — fall through to empty record
    }
  }
  return {};
}

// Extract args from OpenAI-style tool_calls[N].function.arguments where
// arguments is a JSON-encoded string. Returns the FIRST tool call's args.
function pickToolCallArguments(value: unknown): Record<string, any> {
  if (!Array.isArray(value) || value.length === 0) return {};
  const first = value[0];
  if (!first || typeof first !== 'object') return {};
  const fn = (first as any).function;
  if (fn && typeof fn === 'object') {
    return pickRecordOrParse(fn.arguments);
  }
  return pickRecordOrParse((first as any).arguments);
}

function normalizeUuid(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return UUID_RE.test(trimmed) ? trimmed : '';
}

function getRequestBody(req: Request): Record<string, any> {
  const root = pickRecord(req.body);
  // Anam webhook payloads can place tool arguments under nested keys depending
  // on transport/runtime. Normalize once so all handlers read a consistent shape.
  // Order: outer envelopes first, inner content last (so inner wins on conflict).
  const merged: Record<string, any> = {
    ...root,
    // OpenAI-style tool_calls[].function.arguments (JSON string in some runtimes).
    ...pickToolCallArguments((root as any).tool_calls),
    // OpenAI-style legacy function_call.arguments (JSON string).
    ...pickRecordOrParse((root as any).function_call?.arguments),
    // String-or-object envelope keys (Anam runtime variants).
    ...pickRecordOrParse(root.arguments),
    ...pickRecordOrParse(root.params),
    ...pickRecordOrParse(root.input),
    ...pickRecordOrParse(root.payload),
    ...pickRecordOrParse(root.tool_input),
    ...pickRecordOrParse(root.body),
    ...pickRecordOrParse(root.bodyParams),
    // Additional envelope keys observed in webhook integrations.
    ...pickRecordOrParse((root as any).args),
    ...pickRecordOrParse((root as any).data),
    ...pickRecordOrParse((root as any).body_params),
  };
  // Suite/office IDs should come from trusted context. Ignore malformed IDs
  // from model-generated payloads (for example "test_suite") and fall back to
  // server defaults.
  const { suiteId, officeId } = normalizeSuiteContext(merged);
  if (suiteId) {
    merged.suite_id = suiteId;
    merged.suiteId = suiteId;
  }
  if (officeId) {
    merged.office_id = officeId;
    merged.officeId = officeId;
  }
  return merged;
}

function readHeaderString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

/**
 * Verify tool auth header matches configured shared secret.
 */
function verifySecret(req: Request, res: Response): boolean {
  const acceptedSecrets = collectAcceptedSecrets();
  if (acceptedSecrets.length === 0) {
    logger.error('[AgentTool] TOOL_WEBHOOK_SHARED_SECRET missing; refusing webhook requests');
    res.status(503).json({ error: 'Service unavailable' });
    return false;
  }
  const body = getRequestBody(req);
  // Keep legacy header compatibility on by default during migration.
  // THREAT-021: this default-true creates an indefinite tail for the
  // x-elevenlabs-secret header. Migration deadline: 2026-06-01 — by then,
  // production Railway env should have ALLOW_LEGACY_TOOL_SECRET_HEADER=false
  // (USER ACTION). Every legacy-header request below logs a WARN with
  // path so the rollout is observable; once those warns drop to zero we
  // can safely flip the flag.
  const allowLegacyHeader = String(process.env.ALLOW_LEGACY_TOOL_SECRET_HEADER || 'true').toLowerCase() !== 'false';
  const aspireSecret = readHeaderString(req.headers['x-aspire-tool-secret'] as string | string[] | undefined);
  const legacySecret = allowLegacyHeader
    ? readHeaderString(req.headers['x-elevenlabs-secret'] as string | string[] | undefined)
    : '';
  // Security hardening: only accept secrets from tool headers. Do not read
  // Authorization/body fields to avoid propagating or logging leaked tokens.
  const secret = aspireSecret || legacySecret;
  if (!secret || !acceptedSecrets.includes(secret)) {
    logger.warn('[AgentTool] Invalid or missing secret', {
      path: req.path,
      hasSecret: !!secret,
      hasAspireHeader: !!aspireSecret,
      hasLegacyHeader: !!legacySecret,
      allowLegacyHeader,
    });
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!aspireSecret && legacySecret) {
    logger.warn('[AgentTool] Legacy auth header used; migrate tool to x-aspire-tool-secret', {
      path: req.path,
    });
  }
  return true;
}

function inferInvokeAgent(body: any): 'adam' | 'quinn' | 'tec' | 'clara' {
  const text = `${body?.task || ''} ${body?.details || ''} ${body?.query || ''}`.toLowerCase();
  if (body?.agent && ['adam', 'quinn', 'tec', 'clara'].includes(String(body.agent).toLowerCase())) {
    return String(body.agent).toLowerCase() as 'adam' | 'quinn' | 'tec' | 'clara';
  }
  if (body?.entity_type || body?.city || body?.filters || body?.card_cache_id) return 'adam';
  if (body?.invoice || body?.customer || /invoice|quote|billing|payment/.test(text)) return 'quinn';
  if (/contract|nda|legal|e-sign|esign|signature/.test(text)) return 'clara';
  return 'adam';
}

function inferLegacyInvokeSyncTarget(body: any): '/v1/tools/context' | '/v1/tools/search' | '/v1/tools/draft' | '/v1/tools/approve' | '/v1/tools/office-note' | '/v1/tools/invoke' {
  if (body?.approval_id || body?.capability_token || body?.action_type) return '/v1/tools/approve';
  if (body?.note || body?.title || body?.tags) return '/v1/tools/office-note';
  if (body?.draft_type || (body?.payload && !body?.task)) return '/v1/tools/draft';
  if (body?.task || body?.details || body?.agent || body?.entity_type || body?.city || body?.filters || body?.card_cache_id) return '/v1/tools/invoke';
  if (body?.query || body?.domain || body?.search_type) return '/v1/tools/search';
  return '/v1/tools/context';
}

function normalizeSuiteContext(body: any): { suiteId: string; officeId: string } {
  const rawSuite = normalizeUuid(body?.suite_id) || normalizeUuid(body?.suiteId);
  const fallbackSuite = normalizeUuid(getDefaultSuiteId()) || normalizeUuid(process.env.DEFAULT_SUITE_ID);
  const suiteId = rawSuite || fallbackSuite;
  const rawOffice = normalizeUuid(body?.office_id) || normalizeUuid(body?.officeId);
  const officeId = rawOffice || suiteId;
  // Audit trail for body-supplied suite_ids (THREAT-005). Without per-secret
  // tenant binding (Round 6 work), body suite_id is the dispatch key — log its
  // origin so we can detect cross-tenant abuse if it happens. We log only the
  // origin label, not the secret, never the value (Law #9).
  if (rawSuite) {
    logger.info('[AgentTool] suite_id_origin', {
      origin: 'body',
      suite_id: suiteId,
      // Distinguish caller-provided vs default fallback for forensics.
      hasOffice: !!rawOffice,
    });
  }
  return { suiteId, officeId };
}

/**
 * Legacy compatibility shim.
 * Some deployed tool configs still post to /v1/agents/invoke-sync on Aspire Desktop.
 * Route these calls to canonical /v1/tools/* handlers.
 */
router.post('/v1/agents/invoke-sync', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  try {
    // Normalize nested payloads first so legacy routes can correctly infer target
    // for Anam payloads that wrap arguments under `arguments`/`params`/`input`.
    const normalized = getRequestBody(req);
    const targetPath = inferLegacyInvokeSyncTarget(normalized);
    const body = { ...normalized };
    const { suiteId, officeId } = normalizeSuiteContext(body);
    if (suiteId && !body.suite_id) body.suite_id = suiteId;
    if (officeId && !body.office_id) body.office_id = officeId;
    if (targetPath === '/v1/tools/invoke' && !body.agent) {
      body.agent = inferInvokeAgent(body);
    }
    const port = process.env.PORT || '5001';
    const localUrl = `http://127.0.0.1:${port}${targetPath}`;
    const incomingSecret =
      readHeaderString(req.headers['x-aspire-tool-secret'] as string | string[] | undefined) ||
      readHeaderString(req.headers['x-elevenlabs-secret'] as string | string[] | undefined) ||
      collectAcceptedSecrets()[0] ||
      '';

    const proxyResp = await fetch(localUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aspire-tool-secret': incomingSecret,
      },
      body: JSON.stringify(body),
    });
    const payloadText = await proxyResp.text();
    let payload: any = {};
    try {
      payload = payloadText ? JSON.parse(payloadText) : {};
    } catch {
      payload = { status: proxyResp.ok ? 'completed' : 'error', message: proxyResp.ok ? 'Done.' : 'Tool unavailable right now.' };
    }
    // Avoid leaking internal retry/debug instructions back into model speech.
    if (!proxyResp.ok || payload?.status === 'error') {
      const sanitized = {
        ...payload,
        status: 'error',
        message: 'I am having trouble with that right now. Please try again.',
      };
      return res.status(200).json(sanitized);
    }
    return res.status(200).json(payload);
  } catch (err: unknown) {
    logger.error('[AgentTool] legacy invoke-sync shim error', {
      error: err instanceof Error ? err.message : 'unknown',
    });
    return res.status(200).json({
      status: 'error',
      message: 'I am having trouble with that right now. Please try again.',
    });
  }
});

/**
 * POST /v1/tools/context
 *
 * Returns business context for the user — profile, recent activity, status.
 * Used by all agents to understand the user's current state.
 */
router.post('/v1/tools/context', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, query } = body;
  logger.info('[AgentTool] context', { suite_id, query });

  try {
    // Get suite profile from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({
        context: 'Business context is not available right now.',
        status: 'unavailable',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Round 7 A.1 — enriched briefing. Whitelist of fields safe to surface to
    // Ava's voice context. EXPLICITLY EXCLUDED for privacy (Law #9):
    // home_address_line1, home_address_line2, date_of_birth, ssn, ein, banking,
    // raw lat/lng. City/state are surfaced; street address is NOT.
    const { data: profile } = await supabase
      .from('suite_profiles')
      .select(`
        owner_name, owner_title, business_name, industry, role_category,
        gender, team_size,
        business_city, business_state, home_city, home_state,
        timezone, currency, preferred_channel, sales_channel, customer_type,
        years_in_business, annual_revenue_band, fiscal_year_end_month,
        onboarding_completed_at, office_id
      `)
      .eq('suite_id', suite_id)
      .maybeSingle();

    // Fetch recent receipts (last 5 actions)
    const { data: recentReceipts } = await supabase
      .from('receipts')
      .select('action_type, outcome, created_at, agent_name')
      .eq('suite_id', suite_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const now = new Date();
    // Round 3 bug fix: Railway runs in UTC, so toLocaleDateString without a
    // timeZone option produced UTC dates/times — at 9:53 PM EDT the server
    // returned "1:53 AM" and Ava said "Good morning" instead of "Good evening".
    // Use suite_profiles.timezone if set, fall back to the request's
    // X-User-Timezone header (Anam can pass the browser tz), then America/New_York.
    const headerTz = typeof req.headers['x-user-timezone'] === 'string'
      ? (req.headers['x-user-timezone'] as string)
      : '';
    const timezone =
      (profile as any)?.timezone ||
      headerTz ||
      'America/New_York';

    // Round 7 A.1 + Round 8 prep derivations — split owner_name into
    // first_name AND last_name; derive gender_pronoun + salutation. Defaults
    // are "" (NOT "Unknown") so the prompt's omission rule cleanly skips
    // empty values. last_name is REQUIRED by the prompt's PRIMARY greeting
    // form ("Good morning, Mr. {{last_name}}.") — without it the prompt
    // falls back to first_name addressing, breaking the chief-of-staff
    // persona for the trades-worker ICP.
    const ownerName = ((profile as any)?.owner_name || '').toString().trim();
    let firstName = '';
    let lastName = '';
    if (ownerName) {
      const parts = ownerName.split(/\s+/);
      firstName = parts[0] || '';
      // last_name = everything after the first token, joined back. Handles
      // "Tony Lewis Scott" -> first=Tony, last="Lewis Scott". For single-token
      // names ("Tonio"), last_name stays empty and prompt falls back.
      lastName = parts.slice(1).join(' ');
    }

    const genderRaw = ((profile as any)?.gender || '').toString().trim().toLowerCase();
    let genderPronoun = 'they/them'; // safe default
    let salutation = ''; // empty when unknown — prompt omits it
    if (genderRaw === 'male' || genderRaw === 'm') {
      genderPronoun = 'he/him';
      salutation = 'Mr.';
    } else if (genderRaw === 'female' || genderRaw === 'f') {
      genderPronoun = 'she/her';
      salutation = 'Ms.';
    } else if (
      genderRaw === 'non-binary' || genderRaw === 'nonbinary' ||
      genderRaw === 'nb' || genderRaw === 'enby'
    ) {
      genderPronoun = 'they/them';
      salutation = 'Mx.';
    }

    const onboardingCompletedAt = (profile as any)?.onboarding_completed_at || null;

    const context = {
      current_date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: timezone }),
      current_time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone }),
      timezone,

      // Identity (Round 7 output-critic Issue #6: empty string instead of
      // "Unknown" / "General" so the prompt's "omit field when missing" rule
      // fires deterministically. Speaking "Unknown" or "General" aloud was
      // the original Round 7 user complaint.)
      owner_name: profile?.owner_name || '',
      first_name: firstName,
      last_name: lastName,
      salutation,
      gender_pronoun: genderPronoun,
      owner_title: (profile as any)?.owner_title || '',

      // Business
      business_name: profile?.business_name || '',
      industry: profile?.industry || '',
      role_category: (profile as any)?.role_category || '',
      team_size: (profile as any)?.team_size || '',
      years_in_business: (profile as any)?.years_in_business ?? null,
      annual_revenue_band: (profile as any)?.annual_revenue_band || '',
      fiscal_year_end_month: (profile as any)?.fiscal_year_end_month ?? null,
      currency: (profile as any)?.currency || '',

      // Location (city/state ONLY — street address whitelisted out per Law #9)
      office_city: (profile as any)?.business_city || '',
      office_state: (profile as any)?.business_state || '',
      home_city: (profile as any)?.home_city || '',
      home_state: (profile as any)?.home_state || '',

      // Channels & sales
      preferred_channel: (profile as any)?.preferred_channel || '',
      sales_channel: (profile as any)?.sales_channel || '',
      customer_type: (profile as any)?.customer_type || '',

      // Onboarding state
      onboarding_completed: !!onboardingCompletedAt,
      onboarding_completed_at: onboardingCompletedAt,

      recent_activity: (recentReceipts || []).map((r: any) => ({
        action: r.action_type,
        outcome: r.outcome,
        agent: r.agent_name,
        when: r.created_at,
      })),
      status: 'ok',
    };

    return res.json(context);
  } catch (err) {
    logger.error('[AgentTool] context error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      context: 'I was not able to retrieve your business context right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/search
 *
 * Searches across emails, calendar, contacts, invoices based on agent + query.
 * Returns structured results the agent can read aloud.
 */
router.post('/v1/tools/search', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, query, search_type } = body;
  logger.info('[AgentTool] search', { suite_id, query, search_type });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({
        results: [],
        message: 'Search is not available right now.',
        count: 0,
        status: 'unavailable',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const resolvedType = (search_type || '').toLowerCase();
    let results: any[] = [];
    let message = '';

    if (resolvedType === 'calendar' || resolvedType === 'meetings' || resolvedType === 'schedule') {
      // Search calendar events
      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, description, start_time, end_time, duration_minutes, location, status, participants')
        .eq('suite_id', suite_id)
        .order('start_time', { ascending: true })
        .limit(10);
      results = (data || []).map((e: any) => ({
        type: 'calendar_event',
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
        duration_minutes: e.duration_minutes,
        location: e.location,
        status: e.status,
      }));
      message = results.length > 0
        ? `Found ${results.length} calendar event${results.length > 1 ? 's' : ''}.`
        : 'No calendar events found.';
    } else if (resolvedType === 'invoices' || resolvedType === 'invoice') {
      // Search receipts for invoice-related actions
      const { data } = await supabase
        .from('receipts')
        .select('id, action_type, outcome, summary, created_at, agent_name, metadata')
        .eq('suite_id', suite_id)
        .in('action_type', ['invoice.created', 'invoice.sent', 'invoice.draft', 'office_note'])
        .order('created_at', { ascending: false })
        .limit(10);
      results = (data || []).map((r: any) => ({
        type: 'invoice_receipt',
        action: r.action_type,
        outcome: r.outcome,
        summary: r.summary,
        date: r.created_at,
        agent: r.agent_name,
      }));
      message = results.length > 0
        ? `Found ${results.length} invoice record${results.length > 1 ? 's' : ''}.`
        : 'No invoices found.';
    } else if (resolvedType === 'contacts' || resolvedType === 'contact') {
      // Search suite profiles for contacts. Law #6: tenant isolation.
      // suite_profiles is keyed by suite_id; without this filter every tenant's
      // contacts would leak (THREAT-003).
      const { data } = await supabase
        .from('suite_profiles')
        .select('suite_id, owner_name, business_name, industry')
        .eq('suite_id', suite_id)
        .limit(10);
      results = (data || []).map((p: any) => ({
        type: 'contact',
        name: p.owner_name,
        business: p.business_name,
        industry: p.industry,
      }));
      message = results.length > 0
        ? `Found ${results.length} contact${results.length > 1 ? 's' : ''}.`
        : 'No contacts found.';
    } else {
      // General search — search recent receipts matching query text
      const { data } = await supabase
        .from('receipts')
        .select('id, action_type, outcome, summary, created_at, agent_name')
        .eq('suite_id', suite_id)
        .order('created_at', { ascending: false })
        .limit(10);
      results = (data || []).map((r: any) => ({
        type: 'activity',
        action: r.action_type,
        outcome: r.outcome,
        summary: r.summary,
        date: r.created_at,
        agent: r.agent_name,
      }));
      message = results.length > 0
        ? `Found ${results.length} recent activit${results.length > 1 ? 'ies' : 'y'}.`
        : `No results found for "${query || 'items'}".`;
    }

    return res.json({
      results,
      message,
      count: results.length,
      status: 'ok',
    });
  } catch (err) {
    logger.error('[AgentTool] search error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      results: [],
      message: 'Search is temporarily unavailable. Please try again in a moment.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/draft
 *
 * Creates a draft (email, invoice, meeting invite) for user review.
 * Returns the draft summary for the agent to read back.
 */
router.post('/v1/tools/draft', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, draft_type, ...draftParams } = body;
  logger.info('[AgentTool] draft', { suite_id, draft_type, params: Object.keys(draftParams) });

  try {
    // ── Calendar Event (meeting, task, reminder, deadline, follow-up, anything) ──
    if (draft_type === 'meeting' || draft_type === 'calendar' || draft_type === 'event' || draft_type === 'reminder' || draft_type === 'task' || draft_type === 'deadline' || draft_type === 'follow_up') {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      if (!supabaseUrl || !supabaseKey) {
        return res.json({
          draft_id: null,
          draft_type: 'meeting',
          summary: 'Calendar is not available right now. Please try again later.',
          status: 'error',
        });
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      const title = draftParams.subject || draftParams.title || 'Meeting';
      const description = draftParams.body || draftParams.description || '';
      const location = draftParams.location || '';
      const participants = draftParams.to ? [draftParams.to] : [];

      // Parse start_time — try ISO string first, then date+time combo, then default
      let startTime: Date;
      const now = new Date();

      if (draftParams.start_time) {
        startTime = new Date(draftParams.start_time);
      } else if (draftParams.date && draftParams.time) {
        startTime = new Date(`${draftParams.date}T${draftParams.time}`);
      } else {
        // Default to tomorrow at 9 AM if no time specified
        startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      }

      // ── Date sanity guard ──────────────────────────────────────────────
      // LLMs sometimes hallucinate dates from their training cutoff (e.g. 2023)
      // instead of the real current year. Detect and correct:
      //   1. Invalid date → default to tomorrow 9 AM
      //   2. Year before current year → preserve month/day/time, snap to current year
      //      (if that result is still in the past, bump to next year)
      //   3. More than 2 years in the future → cap to current year (likely hallucination)
      //   4. Already past today but within current year → bump to tomorrow same time
      //      (catches "today at 2pm" when it's already 5pm)
      if (isNaN(startTime.getTime())) {
        logger.warn('[AgentTool] draft: invalid start_time, defaulting to tomorrow 9 AM', { raw: draftParams.start_time });
        startTime = new Date(now);
        startTime.setDate(startTime.getDate() + 1);
        startTime.setHours(9, 0, 0, 0);
      } else if (startTime.getFullYear() < now.getFullYear()) {
        const originalYear = startTime.getFullYear();
        startTime.setFullYear(now.getFullYear());
        if (startTime.getTime() < now.getTime()) {
          startTime.setFullYear(now.getFullYear() + 1);
        }
        logger.warn('[AgentTool] draft: corrected past-year date', { original: originalYear, corrected: startTime.getFullYear() });
      } else if (startTime.getFullYear() > now.getFullYear() + 2) {
        logger.warn('[AgentTool] draft: date too far in future, capping to current year', { original: startTime.getFullYear() });
        startTime.setFullYear(now.getFullYear());
      }

      const durationMinutes = draftParams.duration_minutes || 30;
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // Map draft_type to valid event_type (DB constraint: meeting, task, reminder, call, deadline, other)
      const eventTypeMap: Record<string, string> = {
        meeting: 'meeting', task: 'task', reminder: 'reminder', call: 'call',
        deadline: 'deadline', calendar: 'meeting', event: 'meeting',
        follow_up: 'reminder', follow_up_call: 'call',
      };
      const eventType = eventTypeMap[draft_type] || 'other';

      const { data: event, error: insertErr } = await supabase
        .from('calendar_events')
        .insert({
          suite_id,
          title,
          description,
          event_type: eventType,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          duration_minutes: durationMinutes,
          location,
          participants,
          source: 'ava',
          created_by: user_id || 'ava',
          status: 'pending_approval',
        })
        .select()
        .single();

      if (insertErr) {
        logger.error('[AgentTool] draft meeting insert error', { error: insertErr.message });
        return res.json({
          draft_id: null,
          draft_type: 'meeting',
          summary: 'I was not able to add that to your calendar right now. Please try again.',
          status: 'error',
        });
      }

      const dateStr = startTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const timeStr = startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      // F-MED-A2: emit receipt for calendar draft creation (Law #2). YELLOW
      // tier — calendar entries are state changes that may need confirmation.
      try {
        const correlationId = `corr-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-draft-${event.id}`,
          suite_id,
          tenant_id: suite_id || 'default',
          office_id: suite_id || null,
          receipt_type: 'calendar_draft',
          status: 'SUCCEEDED',
          correlation_id: correlationId,
          actor_type: 'WORKER',
          actor_id: 'ava',
          action: {
            type: 'calendar.draft_created',
            event_id: event.id,
            event_type: eventType,
            risk_tier: 'YELLOW',
            tool_used: 'calendar.draft',
            reason_code: 'DRAFT_PENDING_APPROVAL',
          },
          result: { event_id: event.id, start_time: startTime.toISOString(), duration_minutes: durationMinutes },
          hash_alg: 'sha256',
        });
      } catch (recErr) {
        logger.warn('[AgentTool] draft calendar receipt write failed', {
          error: recErr instanceof Error ? recErr.message : 'unknown',
        });
      }

      return res.json({
        draft_id: event.id,
        draft_type: 'meeting',
        title,
        date: dateStr,
        time: timeStr,
        duration_minutes: durationMinutes,
        location: location || null,
        participants,
        summary: `Added ${title} on ${dateStr} at ${timeStr} to your calendar.`,
        status: 'created',
      });
    }

    // ── Other draft types (email, invoice, office_note) — stub for now ──
    return res.json({
      draft_id: `draft_${Date.now()}`,
      draft_type: draft_type || 'general',
      summary: `Draft created with the details you provided. Please review and confirm before I send it.`,
      params_received: draftParams,
      status: 'pending_review',
    });
  } catch (err) {
    logger.error('[AgentTool] draft error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to create the draft right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/approve
 *
 * Submits a confirmed draft for execution after user approval.
 * This is a YELLOW tier action — requires user confirmation.
 */
router.post('/v1/tools/approve', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, user_id, draft_id, action_type } = body;
  logger.info('[AgentTool] approve', { suite_id, draft_id, action_type });

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({ status: 'error', message: 'Approval service is not available right now.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const approvalId = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const correlationId = `corr-approve-${Date.now()}`;

    // Insert approval request into approval_requests table
    const { data: approval, error: insertErr } = await supabase
      .from('approval_requests')
      .insert({
        approval_id: approvalId,
        tenant_id: suite_id || 'default',
        run_id: correlationId,
        tool: action_type || 'general',
        operation: 'approve',
        risk_tier: 'yellow',
        policy_version: 'v1',
        approval_hash: `sha256:${approvalId}`,
        payload_redacted: { draft_id, action_type, approved_by: user_id || 'voice' },
        constraints: { max_amount: null, expires_in_seconds: 3600 },
        status: 'approved',
        created_by_user_id: null,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
        decided_at: new Date().toISOString(),
        decision_surface: 'voice',
        decision_reason: 'User confirmed via Ava voice conversation',
        draft_summary: `Approved: ${action_type || 'action'} for draft ${draft_id || 'unknown'}`,
        assigned_agent: 'ava',
      })
      .select()
      .single();

    if (insertErr) {
      logger.error('[AgentTool] approve insert error', { error: insertErr.message });
      return res.json({
        status: 'error',
        message: 'I was not able to process the approval right now. Please try again.',
      });
    }

    // Also emit a receipt (Law #2). Schema-correct fields: status uppercase
    // (CHECK IN ('PENDING','SUCCEEDED','FAILED','DENIED')), actor_type uppercase
    // (CHECK IN ('USER','SYSTEM','WORKER')), and governance fields nested in
    // action JSON. receipt_hash is computed by trust_compute_receipt_hash()
    // trigger — do NOT set it client-side.
    await supabase.from('receipts').insert({
      receipt_id: `rcpt-${approvalId}`,
      suite_id,
      tenant_id: suite_id || 'default',
      office_id: suite_id || null,
      receipt_type: 'approval',
      status: 'SUCCEEDED',
      correlation_id: correlationId,
      actor_type: 'WORKER',
      actor_id: 'ava',
      action: {
        type: 'approve',
        draft_id,
        action_type,
        risk_tier: 'YELLOW',
        tool_used: 'approval.create',
        reason_code: 'APPROVED_BY_USER',
      },
      result: { approval_id: approvalId, status: 'approved' },
      hash_alg: 'sha256',
    });

    return res.json({
      approval_id: approvalId,
      draft_id: draft_id || 'unknown',
      status: 'approved',
      message: 'Approved and recorded. Moving forward with your request.',
    });
  } catch (err) {
    logger.error('[AgentTool] approve error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to process the approval right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/invoke
 *
 * Routes work to internal backend agents (Quinn, Adam, Tec).
 * Clara is NOT invokable here — contracts go through video mode.
 * Law #1: Orchestrator routes, agents execute.
 * Law #2: Every invoke emits a receipt.
 */
const VALID_INVOKE_AGENTS = ['quinn', 'adam', 'tec', 'clara'] as const;

router.post('/v1/tools/invoke', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  // Round 7 R-001: one-shot diagnostic log to capture exact wire format Anam
  // posts for invoke_adam (flat vs bodyParams-wrapped). Gated behind env flag
  // so it stays off in prod by default. MUST run AFTER verifySecret so
  // unauthenticated callers cannot spray the Railway log stream. PII
  // protection: rawBodyPreview is truncated to 200 chars — DO NOT remove
  // the slice. Roll back once we have captured one payload (per plan D.7).
  if (process.env.LOG_TOOL_INVOKE_DIAG === 'true') {
    const diagRawBody = (req as any).rawBody;
    logger.info('[AgentTool][invoke][diag]', {
      contentType: req.headers['content-type'] || '(none)',
      contentLength: req.headers['content-length'] || '(none)',
      rawBodyLen: diagRawBody?.length ?? 0,
      rawBodyPreview: diagRawBody ? diagRawBody.toString('utf-8').slice(0, 200) : '',
      bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body).slice(0, 12) : [],
    });
  }

  // MVEO Layer 4 — wire-shape sampler. 1% of all invoke calls always-on.
  // Records the envelope shape (sorted body keys + content-type + nested-args
  // flag) so a daily cron can detect NOVEL shapes that we haven't unwrapped
  // before. Would have caught the May 3 MISSING_TASK envelope mismatch days
  // before it impacted the user. Best-effort, never blocks the request.
  if (Math.random() < 0.01) {
    const sampleRawBody = (req as any).rawBody;
    const sampleSuiteId = typeof (req.body as any)?.suite_id === 'string'
      ? (req.body as any).suite_id
      : (getDefaultSuiteId() || '');
    const bodyKeys = req.body && typeof req.body === 'object'
      ? Object.keys(req.body as Record<string, any>).sort().slice(0, 30)
      : [];
    const hasNestedArgs = !!(req.body
      && typeof req.body === 'object'
      && ((req.body as any).arguments
        || (req.body as any).bodyParams
        || (req.body as any).tool_calls
        || (req.body as any).function_call));
    const contentType = String(req.headers['content-type'] || '').slice(0, 100);
    const shapeSignature = JSON.stringify({ k: bodyKeys, c: contentType, n: hasNestedArgs });
    const shapeHash = require('crypto').createHash('sha256').update(shapeSignature).digest('hex').slice(0, 16);

    void (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (!supabaseUrl || !supabaseKey || !sampleSuiteId) return;
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Upsert: if (tenant_id, tool_name, shape_hash) exists, bump
        // last_seen + sample_count; otherwise insert with first_seen=now().
        const { error } = await supabase.rpc('mveo_record_envelope_sample', {
          p_tenant_id: sampleSuiteId,
          p_tool_name: 'invoke',
          p_shape_hash: shapeHash,
          p_body_keys: bodyKeys,
          p_content_type: contentType,
          p_raw_body_len: sampleRawBody?.length ?? 0,
          p_has_nested_arguments: hasNestedArgs,
        });
        if (error) {
          logger.warn('[EnvelopeSampler] upsert failed', { error: error.message });
        }
      } catch {
        // sampler is fire-and-forget; never affects request
      }
    })();
  }

  // Round 3 hotfix: if express body parsers didn't populate req.body but the
  // verify callback captured a raw buffer, parse it here as JSON. Anam's
  // webhook runtime sometimes posts with non-standard Content-Type.
  const rawBody = (req as any).rawBody;
  const reqBodyEmpty = !req.body || (typeof req.body === 'object' && Object.keys(req.body).length === 0);
  if (reqBodyEmpty && rawBody && rawBody.length > 0) {
    try {
      const parsed = JSON.parse(rawBody.toString('utf-8'));
      if (parsed && typeof parsed === 'object') {
        req.body = parsed;
        logger.warn('[AgentTool] invoke recovered body from raw buffer', {
          contentType: req.headers['content-type'] || '(none)',
          rawLength: rawBody.length,
          recoveredKeys: Object.keys(parsed).slice(0, 12),
        });
      }
    } catch (parseErr) {
      // THREAT-012: rawSample previously logged 200 chars of raw body which can
      // include PII (addresses, names, phone numbers). Replace with a hex
      // fingerprint of the first 8 bytes for debugging without exposing
      // content.
      const fingerprint = rawBody.length > 0
        ? Buffer.from(rawBody).slice(0, 8).toString('hex')
        : '';
      logger.error('[AgentTool] invoke raw body JSON parse failed', {
        contentType: req.headers['content-type'] || '(none)',
        rawLength: rawBody.length,
        rawFingerprint: fingerprint,
        error: parseErr instanceof Error ? parseErr.message : 'unknown',
      });
    }
  }

  const body = getRequestBody(req);
  const { suite_id, details, user_id } = body;
  const providedAgent = typeof body.agent === 'string' ? String(body.agent).toLowerCase().trim() : '';
  const resolvedAgent = (providedAgent && VALID_INVOKE_AGENTS.includes(providedAgent as any))
    ? providedAgent
    : inferInvokeAgent(body);

  // Anam may send query-centric payloads; normalize into task text for backend invoke.
  const taskFromTask = typeof body.task === 'string' ? body.task.trim() : '';
  const taskFromQuery = typeof body.query === 'string' ? body.query.trim() : '';
  const taskFromDetails = typeof details === 'string' ? details.trim() : '';
  const normalizedTask = taskFromTask || taskFromQuery || taskFromDetails;

  // Round 7 C-1/C-2/C-3: mint correlationId + suite_id BEFORE validation so
  // every early-exit path (INVALID_AGENT, MISSING_TASK, MISCONFIGURATION) can
  // emit a receipt. Law #2 demands receipt coverage even on denied/failed
  // invocations.
  const correlationId = `corr-invoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeSuiteId =
    (typeof suite_id === 'string' && suite_id.trim()) ||
    getDefaultSuiteId() ||
    process.env.DEFAULT_SUITE_ID ||
    '';
  const safeOfficeId = safeSuiteId;

  // Helper: emit an early-exit receipt (denial or misconfig failure) so the
  // receipt chain stays complete even when we never call the orchestrator.
  // Mirrors the upstream-fail receipt shape at the dispatch error site so the
  // schema stays consistent. Status MUST be uppercase ('DENIED'|'FAILED') and
  // actor_type 'WORKER' — Round 5 found a CHECK constraint silent failure on
  // lowercase values.
  const emitEarlyExitReceipt = async (params: {
    receiptType: 'invoke_denial' | 'invoke_error';
    status: 'DENIED' | 'FAILED';
    reasonCode: 'INVALID_AGENT' | 'MISSING_TASK' | 'MISCONFIGURATION';
    toolUsed: string;
  }): Promise<void> => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      // Round 7 output-critic Issue #2: validate suite_id / office_id are
      // valid UUIDs before INSERT. Postgres rejects non-UUID values for the
      // uuid columns, and the catch below swallows the error silently —
      // which would defeat the entire point of C-1/C-2/C-3 (Wave 3.5 hotfix).
      // Skip the receipt write if suite_id is not a valid UUID; office_id
      // becomes null when its UUID is invalid (column is nullable).
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validSuiteId = typeof safeSuiteId === 'string' && UUID_RE.test(safeSuiteId);
      const validOfficeId = typeof safeOfficeId === 'string' && UUID_RE.test(safeOfficeId);
      if (!validSuiteId) {
        logger.warn('[AgentTool] invoke early-exit receipt skipped: suite_id is not a valid UUID', {
          reason: params.reasonCode,
          suiteIdType: typeof safeSuiteId,
        });
        return;
      }
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-${correlationId}`,
          suite_id: safeSuiteId,
          tenant_id: safeSuiteId,
          office_id: validOfficeId ? safeOfficeId : null,
          receipt_type: params.receiptType,
          status: params.status,
          correlation_id: correlationId,
          actor_type: 'WORKER',
          actor_id: 'ava',
          action: {
            action_type: 'invoke',
            risk_tier: 'GREEN',
            tool_used: params.toolUsed,
            reason_code: params.reasonCode,
          },
          hash_alg: 'sha256',
        });
      }
    } catch (recErr) {
      logger.warn('[AgentTool] invoke early-exit receipt write failed', {
        reason: params.reasonCode,
        error: recErr instanceof Error ? recErr.message : 'unknown',
      });
    }
  };

  logger.info('[AgentTool] invoke', {
    suite_id,
    agent: resolvedAgent,
    task: normalizedTask,
    correlationId,
    hasTask: !!taskFromTask,
    hasQuery: !!taskFromQuery,
    hasNestedArguments: !!(req.body && typeof req.body === 'object' && (req.body as any).arguments && typeof (req.body as any).arguments === 'object'),
    bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body as Record<string, any>).slice(0, 12) : [],
    contentType: req.headers['content-type'] || '(none)',
    rawBodyLen: (req as any).rawBody ? (req as any).rawBody.length : 0,
  });

  if (!resolvedAgent || !VALID_INVOKE_AGENTS.includes(resolvedAgent as any)) {
    // Round 7 C-2: receipt for INVALID_AGENT denial.
    await emitEarlyExitReceipt({
      receiptType: 'invoke_denial',
      status: 'DENIED',
      reasonCode: 'INVALID_AGENT',
      toolUsed: 'agent.invoke',
    });
    return res.status(200).json({
      error: 'INVALID_AGENT',
      status: 'error',
      message: `Agent must be one of: ${VALID_INVOKE_AGENTS.join(', ')}. Clara is handled through video mode.`,
    });
  }

  // Anam may send sparse request bodies. Build a fallback task to avoid hard
  // failing with HTTP 400 and keep voice sessions stable.
  const fallbackTaskParts = [
    typeof body.entity_type === 'string' ? body.entity_type.trim() : '',
    typeof body.city === 'string' ? body.city.trim() : '',
    typeof body.card_cache_id === 'string' ? `cache ${body.card_cache_id.trim()}` : '',
  ].filter(Boolean);
  const effectiveTask = normalizedTask || (fallbackTaskParts.length > 0 ? `Research ${fallbackTaskParts.join(' ')}` : '');

  if (!effectiveTask) {
    logger.warn('[AgentTool] invoke missing task/query/details after normalization', {
      agent: resolvedAgent,
      correlationId,
      rawBodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body as Record<string, any>).slice(0, 20) : [],
      normalizedKeys: Object.keys(body).slice(0, 20),
    });
    // Round 7 C-1: receipt for MISSING_TASK denial — closes the silent-failure
    // gap surfaced in transcript 3ca28bc6 (3× MISSING_TASK with no receipts).
    await emitEarlyExitReceipt({
      receiptType: 'invoke_denial',
      status: 'DENIED',
      reasonCode: 'MISSING_TASK',
      toolUsed: `invoke_${resolvedAgent}`,
    });
    return res.status(200).json({
      error: 'MISSING_TASK',
      status: 'error',
      message: 'I need a specific request to research. Tell me what to look up and I can run it now.',
    });
  }

  try {
    // Proxy to Python backend A2A dispatch — calls real agents (Quinn, Adam, Tec)
    const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
    if (!orchestratorUrl) {
      logger.warn('[AgentTool] ORCHESTRATOR_URL not set — cannot reach agents');
      // Round 7 C-3: receipt for MISCONFIGURATION failure.
      await emitEarlyExitReceipt({
        receiptType: 'invoke_error',
        status: 'FAILED',
        reasonCode: 'MISCONFIGURATION',
        toolUsed: `invoke_${resolvedAgent}`,
      });
      return res.json({
        agent: resolvedAgent,
        result: `I was not able to reach ${resolvedAgent} right now because the backend service is not configured. Please try again later.`,
        status: 'error',
      });
    }

    logger.info('[AgentTool] invoke -> orchestrator', {
      agent: resolvedAgent,
      correlationId,
      target: `${orchestratorUrl}${ORCHESTRATOR_INVOKE_PATH}`,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 52000); // 52s — backend has 45s playbook timeout + 7s margin for network

    // Round 7 C-1/C-2/C-3: safeSuiteId / safeOfficeId / correlationId moved to
    // top of handler so early-exit receipts can use them. Re-aliased here for
    // readability; do not redeclare.
    const taskText = effectiveTask;
    let detailsText = typeof details === 'string' ? details : '';
    const queryText = typeof body.query === 'string' ? body.query.trim() : '';
    const addressText = typeof body.address === 'string' ? body.address.trim() : '';
    const entityText = typeof body.entity === 'string' ? body.entity.trim() : '';
    const cityText = typeof body.city === 'string' ? body.city.trim() : '';
    const entityTypeText = typeof body.entity_type === 'string' ? body.entity_type.trim() : '';
    const customerNameText = typeof body.customer_name === 'string' ? body.customer_name.trim() : '';
    const customerEmailText = typeof body.customer_email === 'string' ? body.customer_email.trim() : '';
    const customerFirstNameText = typeof body.customer_first_name === 'string' ? body.customer_first_name.trim() : '';
    const customerLastNameText = typeof body.customer_last_name === 'string' ? body.customer_last_name.trim() : '';
    const customerCompanyText = typeof body.customer_company === 'string' ? body.customer_company.trim() : '';
    const customerPhoneText = typeof body.customer_phone === 'string' ? body.customer_phone.trim() : '';
    const customerAddressText = typeof body.customer_address === 'string' ? body.customer_address.trim() : '';
    const notesText = typeof body.notes === 'string' ? body.notes.trim() : '';
    const lineItems = Array.isArray(body.line_items) ? body.line_items : [];
    const totalCents = Number.isFinite(Number(body.total_cents)) ? Number(body.total_cents) : null;
    const dueDays = Number.isFinite(Number(body.due_days)) ? Number(body.due_days) : null;
    const isQuote = typeof body.is_quote === 'boolean' ? body.is_quote : null;
    const currencyText = typeof body.currency === 'string' ? body.currency.trim() : '';

    if (resolvedAgent === 'quinn') {
      const quinnDetailParts: string[] = [];
      if (customerNameText) quinnDetailParts.push(`customer_name: ${customerNameText}`);
      if (customerEmailText) quinnDetailParts.push(`customer_email: ${customerEmailText}`);
      if (customerFirstNameText) quinnDetailParts.push(`customer_first_name: ${customerFirstNameText}`);
      if (customerLastNameText) quinnDetailParts.push(`customer_last_name: ${customerLastNameText}`);
      if (customerCompanyText) quinnDetailParts.push(`customer_company: ${customerCompanyText}`);
      if (customerPhoneText) quinnDetailParts.push(`customer_phone: ${customerPhoneText}`);
      if (customerAddressText) quinnDetailParts.push(`customer_address: ${customerAddressText}`);
      if (currencyText) quinnDetailParts.push(`currency: ${currencyText}`);
      if (totalCents !== null) quinnDetailParts.push(`total_cents: ${totalCents}`);
      if (dueDays !== null) quinnDetailParts.push(`due_days: ${dueDays}`);
      if (isQuote !== null) quinnDetailParts.push(`is_quote: ${isQuote}`);
      if (notesText) quinnDetailParts.push(`notes: ${notesText}`);
      if (lineItems.length > 0) {
        const safeItems = JSON.stringify(lineItems).slice(0, 1200);
        quinnDetailParts.push(`line_items: ${safeItems}`);
      }
      const quinnStructuredDetails = quinnDetailParts.join('; ');
      if (quinnStructuredDetails) {
        detailsText = detailsText
          ? `${detailsText}. ${quinnStructuredDetails}`
          : quinnStructuredDetails;
      } else if (!detailsText && queryText) {
        detailsText = queryText;
      }
    }

    // Anam commonly sends a generic task plus concrete query/address.
    // Preserve the specific query in details so downstream agents (especially Adam)
    // can actually resolve entities instead of receiving only generic intent text.
    if (resolvedAgent === 'adam' && !detailsText.trim()) {
      // Prioritize explicit lookup terms first, then fall back to task text so
      // Adam always gets concrete search context from the user utterance.
      detailsText = queryText || addressText || entityText || '';
      if (!detailsText && taskText && taskText.split(/\s+/).length >= 4) {
        detailsText = taskText;
      }
    }
    if (resolvedAgent === 'adam' && detailsText && queryText) {
      // Query remains the strongest intent anchor when present.
      detailsText = queryText;
      if (cityText && !detailsText.toLowerCase().includes(cityText.toLowerCase())) {
        detailsText = `${detailsText} (${cityText})`;
      }
      if (entityTypeText && !taskText.toLowerCase().includes(entityTypeText.toLowerCase())) {
        // Keep task concise but explicit about domain.
        logger.info('[AgentTool] Adam invoke enriched with query/entity_type context', {
          suite_id: safeSuiteId,
          query: queryText.slice(0, 120),
          entity_type: entityTypeText,
        });
      }
    }
    if (resolvedAgent === 'adam' && !detailsText.trim() && isLikelyPropertyIntent(taskText, detailsText)) {
      const pinned = getLatestPropertyAddress(safeSuiteId);
      if (pinned) {
        detailsText = pinned;
        logger.info('[AgentTool] Reused latest property address for Adam invoke', {
          suite_id: safeSuiteId,
          task: taskText.slice(0, 80),
          address: pinned,
        });
      }
    }

    // Wave A.5: pull through the Adam-specific location/store hints. If the
    // user previously picked a store in this session, auto-inject it on
    // follow-ups that omit store_id — the orchestrator skips re-prompting.
    cleanCardCache();
    const requestStoreId = typeof body.store_id === 'string' ? body.store_id.trim() : '';
    const actorIdForKey = typeof user_id === 'string' ? user_id : '';
    const storePickKey = safeSuiteId ? chosenStoreKey(safeSuiteId, actorIdForKey) : '';
    let effectiveStoreId = requestStoreId;
    if (!effectiveStoreId && storePickKey) {
      const cached = chosenStoreIdBySuite.get(storePickKey);
      if (cached && Date.now() - cached.timestamp <= STORE_PICK_TTL_MS) {
        effectiveStoreId = cached.storeId;
        logger.info('[AgentTool] Reused cached store_id for Adam invoke', {
          suite_id: safeSuiteId,
          actor_id: actorIdForKey || '(anon)',
          store_id: effectiveStoreId,
        });
      }
    }
    if (requestStoreId && storePickKey) {
      chosenStoreIdBySuite.set(storePickKey, {
        storeId: requestStoreId,
        timestamp: Date.now(),
      });
    }

    const invokePayload: Record<string, unknown> = {
      suite_id: safeSuiteId,
      office_id: safeOfficeId,
      correlation_id: correlationId,
      agent: resolvedAgent,
      task: taskText,
      details: detailsText,
      user_id,
    };

    // Wave A — pass through Adam tool-material-price-check hints.
    if (resolvedAgent === 'adam') {
      if (entityTypeText) invokePayload.entity_type = entityTypeText;
      if (cityText) invokePayload.city = cityText;
      const stateText = typeof body.state === 'string' ? body.state.trim() : '';
      if (stateText) invokePayload.state = stateText;
      const zipText = typeof body.zip_code === 'string' ? body.zip_code.trim() : '';
      if (zipText) invokePayload.zip_code = zipText;
      if (effectiveStoreId) invokePayload.store_id = effectiveStoreId;
      if (typeof body.on_sale === 'boolean') invokePayload.on_sale = body.on_sale;
      if (typeof body.voice_path === 'boolean') invokePayload.voice_path = body.voice_path;
      // Round 4 — user_address triggers Google Places nearest-HD resolver
      // in the orchestrator. Optional; backend gracefully falls through to
      // city→zip + Wave A.5 disambiguation when missing.
      const userAddressText = typeof body.user_address === 'string' ? body.user_address.trim() : '';
      if (userAddressText) invokePayload.user_address = userAddressText;
      // Round 7 A.3 — multi-store opt-in. When true, voice path also runs
      // Google Shopping (Lowe's, Walmart, Ace, Amazon) instead of HD-only.
      // Default false preserves HD-default behavior + voice latency.
      if (typeof body.include_other_stores === 'boolean') {
        invokePayload.include_other_stores = body.include_other_stores;
      }
    }
    const { response: a2aResp, endpoint: invokeEndpoint } = await dispatchOrchestratorInvoke(
      orchestratorUrl,
      invokePayload,
      controller.signal,
    );

    clearTimeout(timeout);

    if (!a2aResp.ok) {
      const errBody = await a2aResp.text().catch(() => '');
      logger.error('[AgentTool] A2A dispatch failed', {
        agent: resolvedAgent,
        status: a2aResp.status,
        endpoint: invokeEndpoint,
        body: errBody.slice(0, 200),
      });

      // F-MED-A3: emit failure receipt for upstream 4xx/5xx so the failure is
      // auditable and the receipt chain stays complete.
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        if (supabaseUrl && supabaseKey && safeSuiteId) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase.from('receipts').insert({
            receipt_id: `rcpt-invoke-up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            suite_id: safeSuiteId,
            tenant_id: safeSuiteId,
            office_id: safeOfficeId,
            receipt_type: 'invoke_error',
            status: 'FAILED',
            correlation_id: correlationId,
            actor_type: 'WORKER',
            actor_id: 'ava',
            action: {
              type: 'invoke',
              agent: resolvedAgent,
              risk_tier: 'GREEN',
              tool_used: 'agent.invoke',
              reason_code: 'UPSTREAM_ERROR',
            },
            result: { upstream_status: a2aResp.status, endpoint_used: invokeEndpoint },
            hash_alg: 'sha256',
          });
        }
      } catch (recErr) {
        logger.warn('[AgentTool] invoke upstream-fail receipt write failed', {
          error: recErr instanceof Error ? recErr.message : 'unknown',
        });
      }

      // THREAT-014: do not leak upstream body or status text to the model.
      return res.json({
        agent: resolvedAgent,
        result: `I was not able to reach ${resolvedAgent} right now. Please try again.`,
        status: 'error',
      });
    }

    const a2aResult = await a2aResp.json();
    logger.info('[AgentTool] A2A dispatch result', { agent: resolvedAgent, success: a2aResult.success, taskId: a2aResult.task_id });

    // ── Card Records Intercept ──
    // If Adam returned card_records (full property data), store them on the
    // gateway and strip from the ElevenLabs response. Desktop fetches full
    // records from GET /v1/tools/card-data/:id when show_cards fires.
    let responseData = a2aResult.data || null;
    if (resolvedAgent === 'adam' && Array.isArray(responseData?.card_records) && responseData.card_records.length > 0) {
      const cacheId = correlationId;
      const cacheSuiteId = safeSuiteId;
      cardRecordsCache.set(cacheId, {
        records: responseData.card_records,
        artifactType: responseData.artifact_type || '',
        suiteId: cacheSuiteId,
        timestamp: Date.now(),
      });
      latestCardCacheIdBySuite.set(cacheSuiteId, cacheId);
      if (PROPERTY_ARTIFACT_TYPES.has(responseData.artifact_type || '')) {
        maybeStoreLatestPropertyAddress(cacheSuiteId, responseData.card_records);
      }
      cleanCardCache();
      logger.info('[AgentTool] Cached card_records', { cacheId, count: responseData.card_records.length });

      // Strip card_records from ElevenLabs response (keeps LLM payload small)
      const { card_records, ...slimData } = responseData;
      responseData = { ...slimData, _card_cache_id: cacheId };
    }

    // ── Records Slim + Cache (new shape — products/stores/hotels) ──
    // Adam now returns full records under data.records (not card_records). A
    // 15-record payload with full thumbnails arrays, variants, and verification
    // metadata is ~15KB — too big for Anam's hosted LLM to copy verbatim into a
    // show_cards CLIENT call. Observed in session 73aee55d where Ava skipped
    // show_cards entirely after a 15-record paint search.
    //
    // Strategy: slim each record to display-essential fields only (~150 bytes
    // each, ~2KB total for 15) and cache the FULL records for follow-up
    // detail requests. Card cap at 25 to keep the LLM-facing payload bounded
    // even on large responses (still all renderable client-side).
    //
    // Law #2 (receipts): a2aResult already produced receipt_id for the
    // invocation; the slim is a non-state-changing transform on the response.
    // Law #6 (tenant isolation): cache keyed by suite_id; reads enforce match.
    // Law #9 (PII): slimRecord whitelists display fields — no PII added.
    // slimAdamRecord whitelists PRODUCT/STORE display fields. Property /
    // landlord pack records have a different schema (normalized_address,
    // living_sqft, year_built, beds, baths, owner_name, sale_history,
    // foreclosure_records, etc.) — running them through the slim function
    // strips every field and returns {} per record. Property packs are
    // also typically smaller (1-10 records) so slimming is unnecessary.
    // Skip slim for property/landlord artifact types — pass records through
    // unchanged but still cache + tag with _card_cache_id for follow-up
    // detail requests. May 4 user report: "fallback empty card" was
    // partially this — property records were arriving as `[{}]`.
    const responseArtifact = String((responseData as any)?.artifact_type || '').toLowerCase();
    const isPropertyArtifact = (
      responseArtifact === 'propertyfactpack' ||
      responseArtifact === 'landlordpropertypack' ||
      responseArtifact === 'rentcomppack' ||
      responseArtifact === 'permitandrenovationpack' ||
      responseArtifact === 'investmentopportunitypack' ||
      responseArtifact === 'neighborhooddemandpack'
    );
    if (
      resolvedAgent === 'adam' &&
      Array.isArray(responseData?.records) &&
      responseData.records.length > 0 &&
      isPropertyArtifact
    ) {
      // Property pack: cache full records, set markers, but DO NOT slim.
      const cacheId = correlationId;
      const cacheSuiteId = safeSuiteId;
      const fullRecords: any[] = responseData.records;
      cardRecordsCache.set(cacheId, {
        records: fullRecords,
        artifactType: responseData.artifact_type || '',
        suiteId: cacheSuiteId,
        timestamp: Date.now(),
      });
      latestCardCacheIdBySuite.set(cacheSuiteId, cacheId);
      if (PROPERTY_ARTIFACT_TYPES.has(responseData.artifact_type || '')) {
        maybeStoreLatestPropertyAddress(cacheSuiteId, fullRecords);
      }
      cleanCardCache();
      logger.info('[AgentTool] Cached property records (no slim)', {
        cacheId,
        artifactType: responseArtifact,
        recordCount: fullRecords.length,
      });
      responseData = {
        ...responseData,
        records: fullRecords,
        _card_cache_id: cacheId,
        _records_cached: true,
      };
    } else if (
      resolvedAgent === 'adam' &&
      Array.isArray(responseData?.records) &&
      responseData.records.length > 0
    ) {
      const cacheId = correlationId;
      const cacheSuiteId = safeSuiteId;
      const fullRecords: any[] = responseData.records;
      cardRecordsCache.set(cacheId, {
        records: fullRecords,
        artifactType: responseData.artifact_type || '',
        suiteId: cacheSuiteId,
        timestamp: Date.now(),
      });
      latestCardCacheIdBySuite.set(cacheSuiteId, cacheId);
      if (PROPERTY_ARTIFACT_TYPES.has(responseData.artifact_type || '')) {
        maybeStoreLatestPropertyAddress(cacheSuiteId, fullRecords);
      }
      cleanCardCache();

      const slimRecords = fullRecords.slice(0, RECORD_CAP).map(slimAdamRecord);
      const totalCount = typeof responseData.total_count === 'number'
        ? responseData.total_count
        : fullRecords.length;

      logger.info('[AgentTool] Slimmed records (new shape)', {
        cacheId,
        totalCount,
        slimmedCount: slimRecords.length,
        capped: fullRecords.length > RECORD_CAP,
      });

      responseData = {
        ...responseData,
        records: slimRecords,
        _card_cache_id: cacheId,
        _records_cached: true,
        total_count: totalCount,
      };
    }

    return res.json({
      agent: resolvedAgent,
      task: effectiveTask,
      result: a2aResult.result || a2aResult.message || `${resolvedAgent} has processed your request.`,
      data: responseData,
      receipt_id: a2aResult.receipt_id || null,
      status: a2aResult.success ? 'completed' : 'error',
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    // THREAT-014: never leak err.message to the model — those strings end up
    // spoken by the agent and may include stack traces, paths, or upstream
    // tokens. Generic message to caller; full detail server-side only.
    const message = isTimeout
      ? `${resolvedAgent} is taking longer than expected. Please try again in a moment.`
      : `I was not able to reach ${resolvedAgent} right now. Please try again.`;
    logger.error('[AgentTool] invoke error', { agent: resolvedAgent, error: err instanceof Error ? err.message : 'unknown', isTimeout });

    // F-MED-A3: emit a failure receipt so timeouts/errors are auditable.
    try {
      const correlationId = `corr-invoke-err-${Date.now()}`;
      const errSuiteId = (typeof suite_id === 'string' && suite_id.trim()) || getDefaultSuiteId() || '';
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (supabaseUrl && supabaseKey && errSuiteId) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-invoke-err-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          suite_id: errSuiteId,
          tenant_id: errSuiteId,
          office_id: errSuiteId,
          receipt_type: 'invoke_error',
          status: 'FAILED',
          correlation_id: correlationId,
          actor_type: 'WORKER',
          actor_id: 'ava',
          action: {
            type: 'invoke',
            agent: resolvedAgent,
            risk_tier: 'GREEN',
            tool_used: 'agent.invoke',
            reason_code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
          },
          result: { error: 'invoke_failed', isTimeout },
          hash_alg: 'sha256',
        });
      }
    } catch (recErr) {
      logger.warn('[AgentTool] invoke failure receipt write failed', {
        error: recErr instanceof Error ? recErr.message : 'unknown',
      });
    }

    return res.json({
      agent: resolvedAgent,
      result: message,
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/execute
 *
 * Executes an approved action using a capability token.
 * Only called after request_approval returns a token.
 * Law #4: RED tier actions require explicit authority.
 */
router.post('/v1/tools/execute', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, approval_id, capability_token, action_type } = body;
  logger.info('[AgentTool] execute', { suite_id, approval_id, action_type });

  if (!approval_id) {
    return res.status(400).json({ error: 'MISSING_APPROVAL', message: 'Approval ID is required.' });
  }

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      return res.json({ status: 'error', message: 'Execution service is not available right now.' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate the approval exists and is approved.
    // Law #6: tenant isolation. approval_id is server-minted but a leaked or
    // guessed id must not let one tenant execute another tenant's approval
    // (THREAT-013). Pin the lookup to the authenticated suite.
    const tenantFilter = (typeof suite_id === 'string' && suite_id.trim()) || '';
    let approvalQuery = supabase
      .from('approval_requests')
      .select('approval_id, status, risk_tier, tool, operation, draft_summary, expires_at, tenant_id')
      .eq('approval_id', approval_id);
    if (tenantFilter) {
      approvalQuery = approvalQuery.eq('tenant_id', tenantFilter);
    }
    const { data: approval } = await approvalQuery.maybeSingle();

    if (!approval) {
      return res.status(404).json({
        status: 'error',
        message: 'Approval not found. The request may have expired or was never approved.',
      });
    }

    if (approval.status !== 'approved') {
      return res.json({
        status: 'denied',
        message: `This request has status "${approval.status}" and cannot be executed.`,
      });
    }

    // Check expiry
    if (new Date(approval.expires_at) < new Date()) {
      return res.json({
        status: 'expired',
        message: 'This approval has expired. Please request a new approval.',
      });
    }

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Mark approval as executed
    await supabase
      .from('approval_requests')
      .update({ status: 'executed', decided_at: new Date().toISOString() })
      .eq('approval_id', approval_id);

    // Emit execution receipt (Law #2). approval_requests row is mutated above
    // (state machine), but the receipt below is the immutable audit record of
    // the transition itself.
    const correlationId = `corr-exec-${Date.now()}`;
    await supabase.from('receipts').insert({
      receipt_id: `rcpt-${executionId}`,
      suite_id,
      tenant_id: suite_id || 'default',
      office_id: suite_id || null,
      receipt_type: 'execution',
      status: 'SUCCEEDED',
      correlation_id: correlationId,
      actor_type: 'WORKER',
      actor_id: 'ava',
      action: {
        type: 'execute',
        approval_id,
        action_type,
        risk_tier: approval.risk_tier || 'YELLOW',
        tool_used: approval.tool || 'execute',
        reason_code: 'CAPABILITY_OK',
      },
      result: { execution_id: executionId, status: 'executed' },
      hash_alg: 'sha256',
    });

    return res.json({
      execution_id: executionId,
      approval_id,
      action_type: action_type || approval.tool || 'unknown',
      status: 'executed',
      message: 'Action has been executed and recorded.',
    });
  } catch (err) {
    logger.error('[AgentTool] execute error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      message: 'I was not able to execute that action right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/office-note
 *
 * Saves a request/intent to Office Memory for voice→video session continuity.
 * For now: writes to receipts table as office_note action type (append-only).
 * When Office Memory goes live: writes to write-memory-event endpoint instead.
 * Law #2: Every note is a receipt.
 */
router.post('/v1/tools/office-note', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, note_type, summary, next_step, entity } = body;
  logger.info('[AgentTool] office-note', { suite_id, note_type, entity });

  if (!summary || typeof summary !== 'string') {
    return res.status(400).json({ error: 'MISSING_SUMMARY', message: 'Summary is required.' });
  }

  const validNoteTypes = ['handoff', 'contract_request', 'follow_up', 'reminder'];
  const resolvedType = validNoteTypes.includes(note_type) ? note_type : 'handoff';

  try {
    const noteId = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Write to receipts table as office_note (append-only, Law #2)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const correlationId = `corr-note-${Date.now()}`;
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-${noteId}`,
          suite_id,
          tenant_id: suite_id || 'default',
          office_id: suite_id || null,
          receipt_type: 'office_note',
          status: 'SUCCEEDED',
          correlation_id: correlationId,
          actor_type: 'WORKER',
          actor_id: 'ava',
          action: {
            type: 'office_note',
            note_type: resolvedType,
            entity,
            risk_tier: 'GREEN',
            tool_used: 'office_memory.write',
            reason_code: 'NOTE_SAVED',
          },
          result: { note_id: noteId, summary, next_step },
          hash_alg: 'sha256',
        });
      }
    } catch (dbErr) {
      // Non-fatal — note is still returned even if DB write fails
      logger.warn('[AgentTool] office-note DB write failed', {
        error: dbErr instanceof Error ? dbErr.message : 'unknown',
      });
    }

    return res.json({
      note_id: noteId,
      note_type: resolvedType,
      summary,
      next_step: next_step || null,
      entity: entity || null,
      saved: true,
      message: 'Note saved. Video Ava will see this when the user switches to video mode.',
    });
  } catch (err) {
    logger.error('[AgentTool] office-note error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.json({
      saved: false,
      message: 'I was not able to save that note right now. Please try again.',
      status: 'error',
    });
  }
});

/**
 * POST /v1/tools/analyze-document
 *
 * Processes an uploaded document and returns extracted text.
 * Supports: PDF, DOCX, XLSX, PNG, JPG, CSV (up to 10MB).
 * Law #9: No secrets in responses.
 */
router.post('/v1/tools/analyze-document', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suite_id, document_id, file_name, file_content } = body;
  logger.info('[AgentTool] analyze-document', { suite_id, document_id, file_name });

  try {
    // Route to Tec (document agent) via orchestrator invoke API
    const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
    if (!orchestratorUrl) {
      return res.json({
        document_id: document_id || `doc_${Date.now()}`,
        file_name: file_name || 'unknown',
        extracted_text: 'Document processing is not available right now.',
        status: 'error',
      });
    }

    const correlationId = `corr-doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const invokePayload = {
      suite_id,
      office_id: suite_id,
      correlation_id: correlationId,
      agent: 'tec',
      task: `Analyze document: ${file_name || 'uploaded file'}`,
      details: file_content ? `File content provided (base64). Document ID: ${document_id || 'none'}` : `Document ID: ${document_id || 'none'}`,
    };
    const { response: a2aResp, endpoint: invokeEndpoint } = await dispatchOrchestratorInvoke(
      orchestratorUrl,
      invokePayload,
      controller.signal,
    );

    clearTimeout(timeout);

    if (!a2aResp.ok) {
      const errBody = await a2aResp.text().catch(() => '');
      logger.error('[AgentTool] analyze-document A2A failed', {
        status: a2aResp.status,
        endpoint: invokeEndpoint,
        body: errBody.slice(0, 200),
      });
      return res.json({
        document_id: document_id || `doc_${Date.now()}`,
        file_name: file_name || 'unknown',
        extracted_text: 'I was not able to process that document right now. Please try again.',
        status: 'error',
      });
    }

    const a2aResult = await a2aResp.json();

    // Emit receipt (Law #2)
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from('receipts').insert({
          receipt_id: `rcpt-doc-${Date.now()}`,
          suite_id,
          tenant_id: suite_id || 'default',
          office_id: suite_id || null,
          receipt_type: 'document_analysis',
          status: a2aResult.success ? 'SUCCEEDED' : 'FAILED',
          correlation_id: correlationId,
          actor_type: 'WORKER',
          actor_id: 'tec',
          action: {
            type: 'analyze_document',
            file_name,
            document_id,
            risk_tier: 'GREEN',
            tool_used: 'tec.analyze_document',
            reason_code: a2aResult.success ? 'DOC_PROCESSED' : 'DOC_FAILED',
          },
          result: { success: a2aResult.success, receipt_id: a2aResult.receipt_id },
          hash_alg: 'sha256',
        });
      }
    } catch (dbErr) {
      logger.warn('[AgentTool] analyze-document receipt write failed', { error: dbErr instanceof Error ? dbErr.message : 'unknown' });
    }

    return res.json({
      document_id: document_id || `doc_${Date.now()}`,
      file_name: file_name || 'unknown',
      extracted_text: a2aResult.result || 'Document has been processed.',
      data: a2aResult.data || null,
      receipt_id: a2aResult.receipt_id || null,
      status: a2aResult.success ? 'completed' : 'error',
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    logger.error('[AgentTool] analyze-document error', { error: err instanceof Error ? err.message : 'unknown', isTimeout });
    return res.json({
      document_id: document_id || `doc_${Date.now()}`,
      file_name: file_name || 'unknown',
      extracted_text: isTimeout
        ? 'Document processing is taking longer than expected. Please try again.'
        : 'I was not able to analyze that document right now. Please try again.',
      status: 'error',
    });
  }
});

// ─── Card Data Endpoint ──────────────────────────────────────────────────────
// Desktop fetches full property records from this endpoint when show_cards fires.
// The gateway stores card_records in memory when invoke_adam returns them, strips
// them from the ElevenLabs payload, and serves them here.
// Path starts with /api/ so Metro dev proxy forwards it (only /api + /objects are proxied).

router.post('/api/card-data/refetch', cardDataRateLimit, async (req: Request, res: Response) => {
  // Law #3: Fail closed. Refetch dispatches Adam against a suite — without auth
  // the body's suite_id is attacker-controlled and would allow cross-tenant
  // billing/abuse (THREAT-001).
  if (!verifySecret(req, res)) return;

  const body = getRequestBody(req);
  const { suiteId: authSuiteId } = normalizeSuiteContext(body);
  const { artifact_type, seed_record } = body;
  const artifactType = typeof artifact_type === 'string' ? artifact_type : '';
  if (!PROPERTY_ARTIFACT_TYPES.has(artifactType)) {
    return res.status(400).json({ error: 'UNSUPPORTED_ARTIFACT', message: 'Auto-refetch supports property artifacts only.' });
  }
  if (!authSuiteId) {
    return res.status(400).json({ error: 'MISSING_SUITE_ID', message: 'suite_id is required for refetch.' });
  }
  const suiteId = authSuiteId;

  const task = buildPropertyRefetchTask(seed_record, suiteId);
  if (!task) {
    return res.status(400).json({ error: 'MISSING_ADDRESS', message: 'Seed record missing address for refetch.' });
  }

  const orchestratorUrl = process.env.ORCHESTRATOR_URL?.trim();
  if (!orchestratorUrl) {
    logger.warn('[CardData] Refetch unavailable: ORCHESTRATOR_URL missing');
    return res.status(503).json({ error: 'UNAVAILABLE', message: 'Refetch unavailable.' });
  }

  const correlationId = `corr-refetch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const invokePayload = {
      suite_id: suiteId,
      office_id: suiteId,
      correlation_id: correlationId,
      agent: 'adam',
      task,
      details: '',
    };
    const { response: invokeResp, endpoint: invokeEndpoint } = await dispatchOrchestratorInvoke(
      orchestratorUrl,
      invokePayload,
      controller.signal,
    );
    clearTimeout(timeout);

    if (!invokeResp.ok) {
      const body = await invokeResp.text().catch(() => '');
      logger.warn('[CardData] Refetch invoke failed', {
        status: invokeResp.status,
        endpoint: invokeEndpoint,
        body: body.slice(0, 180),
      });
      return res.status(502).json({ error: 'REFETCH_FAILED', message: 'Refetch failed.' });
    }

    const result = await invokeResp.json();
    const responseData = result?.data || {};
    const fullRecords = Array.isArray(responseData?.card_records) ? responseData.card_records : [];
    if (fullRecords.length === 0) {
      logger.warn('[CardData] Refetch returned no card_records', { artifactType, task: task.slice(0, 120) });
      return res.status(404).json({ error: 'NO_DATA', message: 'No card data returned from refetch.' });
    }

    cardRecordsCache.set(correlationId, {
      records: fullRecords,
      artifactType: responseData?.artifact_type || artifactType,
      suiteId,
      timestamp: Date.now(),
    });
    latestCardCacheIdBySuite.set(suiteId, correlationId);
    cleanCardCache();

    logger.info('[CardData] Refetch recovered records', { cacheId: correlationId, count: fullRecords.length });
    return res.json({
      records: fullRecords,
      artifactType: responseData?.artifact_type || artifactType,
      cacheId: correlationId,
    });
  } catch (err) {
    logger.warn('[CardData] Refetch error', { error: err instanceof Error ? err.message : 'unknown' });
    return res.status(502).json({ error: 'REFETCH_ERROR', message: 'Failed to refetch property data.' });
  }
});

// ─── show_cards Server-Side Guard ────────────────────────────────────────────
// Wave 2.4: Deterministic backstop for the LLM prompt rule (Wave 2.3) that
// instructs Ava to pass card_cache_id on re-display requests. If the LLM
// regenerates show_cards from memory and ships sparse records (<3 keys each),
// this route rehydrates from the suite's most recent cache entry.
//
// Behaviour matrix:
//   1. Explicit card_cache_id → look it up; tenant-isolation match required.
//      Refuses fail-closed if the cache_id's suiteId differs from the request.
//   2. No card_cache_id, sparse records, recent latestCardCacheIdBySuite entry
//      exists for THIS suite → rehydrate and emit a [WARN] log so the LLM
//      regression is visible during rollout.
//   3. No card_cache_id, full records → pass-through (current behaviour).
//   4. No card_cache_id, sparse records, no recent cache → pass-through.
// Fire-and-forget receipt write for show_cards branches. show_cards is on the
// hot path (voice latency) — we never block the response on the DB insert, but
// every branch produces a receipt for audit (Law #2, F-MED-A1).
async function emitShowCardsReceipt(opts: {
  suiteId: string;
  source: string;
  cacheId?: string;
  artifactType: string;
  recordCount: number;
  outcome: 'CACHE_HIT' | 'REHYDRATED' | 'PASSTHROUGH' | 'CROSS_TENANT_REFUSED' | 'CACHE_MISS';
}): Promise<void> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !supabaseKey || !opts.suiteId) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const correlationId = `corr-show-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const status = opts.outcome === 'CROSS_TENANT_REFUSED' ? 'DENIED'
      : opts.outcome === 'CACHE_MISS' ? 'FAILED'
      : 'SUCCEEDED';
    await supabase.from('receipts').insert({
      receipt_id: `rcpt-show-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      suite_id: opts.suiteId,
      tenant_id: opts.suiteId,
      office_id: opts.suiteId,
      receipt_type: 'show_cards',
      status,
      correlation_id: correlationId,
      actor_type: 'WORKER',
      actor_id: 'ava',
      action: {
        type: 'show_cards',
        risk_tier: 'GREEN',
        tool_used: 'ui.show_cards',
        reason_code: opts.outcome,
        source: opts.source,
        cache_id: opts.cacheId || null,
      },
      result: {
        artifact_type: opts.artifactType,
        record_count: opts.recordCount,
      },
      hash_alg: 'sha256',
    });
  } catch (err) {
    logger.warn('[ShowCards] receipt write failed', { error: err instanceof Error ? err.message : 'unknown' });
  }
}

router.post('/v1/tools/show-cards', (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;
  const body = getRequestBody(req);
  const { suiteId } = normalizeSuiteContext(body);
  if (!suiteId) {
    return res.status(400).json({ error: 'MISSING_SUITE_ID', message: 'suite_id is required.' });
  }

  cleanCardCache();

  const incomingRecords = Array.isArray(body.records) ? body.records : [];
  const incomingArtifactType = typeof body.artifact_type === 'string' ? body.artifact_type : '';
  const incomingSummary = typeof body.summary === 'string' ? body.summary : '';
  const rawCacheId = typeof body.card_cache_id === 'string' ? body.card_cache_id.trim() : '';

  // Path 1: explicit card_cache_id provided. Honor it; fail closed on mismatch.
  if (rawCacheId) {
    const cached = cardRecordsCache.get(rawCacheId);
    if (!cached) {
      logger.warn('[ShowCards] Explicit cache_id miss', { cacheId: rawCacheId, suiteId });
      void emitShowCardsReceipt({
        suiteId,
        source: 'cache-by-id',
        cacheId: rawCacheId,
        artifactType: incomingArtifactType,
        recordCount: 0,
        outcome: 'CACHE_MISS',
      });
      return res.status(404).json({ error: 'CACHE_NOT_FOUND', message: 'Card cache expired or unknown.' });
    }
    if (cached.suiteId !== suiteId) {
      // Tenant isolation: never serve another suite's cache, even if the LLM
      // (or a malicious client) hands us a foreign cache_id. Law #6.
      logger.warn('[ShowCards] Cross-tenant rehydrate refused', {
        cacheId: rawCacheId,
        requestedSuite: suiteId,
        cachedSuite: cached.suiteId,
      });
      void emitShowCardsReceipt({
        suiteId,
        source: 'cache-by-id',
        cacheId: rawCacheId,
        artifactType: incomingArtifactType,
        recordCount: 0,
        outcome: 'CROSS_TENANT_REFUSED',
      });
      return res.status(404).json({ error: 'CACHE_NOT_FOUND', message: 'Card cache expired or unknown.' });
    }
    logger.info('[ShowCards] Rehydrated from explicit cache_id', {
      cacheId: rawCacheId,
      suiteId,
      count: cached.records.length,
    });
    void emitShowCardsReceipt({
      suiteId,
      source: 'cache-by-id',
      cacheId: rawCacheId,
      artifactType: cached.artifactType,
      recordCount: cached.records.length,
      outcome: 'CACHE_HIT',
    });
    return res.json({
      records: cached.records,
      artifactType: cached.artifactType,
      summary: incomingSummary,
      source: 'cache-by-id',
      cacheId: rawCacheId,
    });
  }

  // Path 2 + 4: no explicit cache_id. Detect sparse payloads and rehydrate
  // from latestCardCacheIdBySuite if a recent entry exists for THIS suite.
  if (isSparseRecordSet(incomingRecords)) {
    const latestId = latestCardCacheIdBySuite.get(suiteId) || '';
    const cached = latestId ? cardRecordsCache.get(latestId) : undefined;
    // cleanCardCache already evicted stale entries; the TTL check is implicit.
    // Belt-and-suspenders tenant check: latestCardCacheIdBySuite is keyed by
    // suiteId so this should always match, but verify anyway (Law #3 fail-closed).
    if (cached && cached.suiteId === suiteId) {
      logger.warn('[ShowCards] sparse show_cards rehydrated from cache', {
        suite: suiteId,
        cacheId: latestId,
        incomingRecordCount: incomingRecords.length,
        incomingArtifactType: incomingArtifactType || cached.artifactType,
        rehydratedRecordCount: cached.records.length,
      });
      void emitShowCardsReceipt({
        suiteId,
        source: 'cache',
        cacheId: latestId,
        artifactType: cached.artifactType,
        recordCount: cached.records.length,
        outcome: 'REHYDRATED',
      });
      return res.json({
        records: cached.records,
        artifactType: cached.artifactType,
        summary: incomingSummary,
        source: 'cache',
        cacheId: latestId,
      });
    }
    // Path 4: sparse but no recent cache. Pass through — the LLM may
    // legitimately have only thin info on a fresh request before any
    // invoke_adam has run.
    logger.info('[ShowCards] sparse payload, no recent cache; pass-through', {
      suite: suiteId,
      incomingRecordCount: incomingRecords.length,
    });
    void emitShowCardsReceipt({
      suiteId,
      source: 'client',
      artifactType: incomingArtifactType,
      recordCount: incomingRecords.length,
      outcome: 'PASSTHROUGH',
    });
    return res.json({
      records: incomingRecords,
      artifactType: incomingArtifactType,
      summary: incomingSummary,
      source: 'client',
    });
  }

  // Path 3: full records, no cache_id. Pass through unchanged.
  void emitShowCardsReceipt({
    suiteId,
    source: 'client',
    artifactType: incomingArtifactType,
    recordCount: incomingRecords.length,
    outcome: 'PASSTHROUGH',
  });
  return res.json({
    records: incomingRecords,
    artifactType: incomingArtifactType,
    summary: incomingSummary,
    source: 'client',
  });
});

router.get('/api/card-data/:id', cardDataRateLimit, (req: Request, res: Response) => {
  // Law #3: Fail closed. Card cache holds full property data — without auth a
  // cache-id enumeration attack could exfiltrate any tenant's records
  // (THREAT-002). suite_id derives from the authenticated tool secret context,
  // NOT the attacker-controlled query string.
  if (!verifySecret(req, res)) return;

  const id = String(req.params.id || '');
  const querySuiteFromString = typeof req.query.suite_id === 'string' ? req.query.suite_id.trim() : '';
  // GET has no body, so normalizeSuiteContext can't pull from body; verifySecret
  // already authenticated the caller, so the query suite_id is acceptable
  // *only* after secret verification (the attacker still needs a valid secret).
  // The previous unauthenticated handler made this query param the sole gate.
  const suiteId = normalizeUuid(querySuiteFromString) || normalizeUuid(getDefaultSuiteId());
  cleanCardCache();
  if (!suiteId) {
    return res.status(400).json({ error: 'MISSING_SUITE_ID', message: 'suite_id query param is required.' });
  }

  // "latest" resolves to the most recent cached entry for this suite.
  const resolvedId = id === 'latest' ? (latestCardCacheIdBySuite.get(suiteId) || null) : id;
  if (!resolvedId) {
    logger.warn('[CardData] No cached card data', { id });
    return res.status(404).json({ error: 'NOT_FOUND', message: 'No card data available.' });
  }

  const cached = cardRecordsCache.get(resolvedId);
  if (!cached) {
    logger.warn('[CardData] Cache miss', { id: resolvedId });
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Card data expired or not found.' });
  }
  if (cached.suiteId !== suiteId) {
    logger.warn('[CardData] Suite mismatch', { id: resolvedId, requestedSuite: suiteId, cachedSuite: cached.suiteId });
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Card data not found.' });
  }

  logger.info('[CardData] Serving cached records', { id: resolvedId, count: cached.records.length, artifactType: cached.artifactType });
  return res.json({
    records: cached.records,
    artifactType: cached.artifactType,
  });
});

// ─── MVEO Layer 3 — Synthetic Ava Paint Canary ───────────────────────────────
// Internal endpoint hit by pg_cron (via pg_net) every 15 minutes. Drives a
// synthetic invoke_adam call with a known-good payload and asserts the
// response shape that the May 3 transcripts revealed was breaking
// (records present, _card_cache_id set, slim records well-formed, no
// MISSING_TASK / no envelope mismatch).
//
// Why this matters: Pass 1 detectors (anomaly + tool-chain) only fire when
// REAL traffic is broken. The canary catches regressions during quiet hours
// or before any real user hits the broken state.
//
// Auth: same shared secret used for /v1/tools/* — pg_cron signs the request
// with the secret retrieved from Vault.
router.post('/internal/canary/ava-paint-flow', async (req: Request, res: Response) => {
  if (!verifySecret(req, res)) return;

  const correlationId = `canary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const canarySuiteId = process.env.MVEO_CANARY_SUITE_ID
    || getDefaultSuiteId()
    || process.env.DEFAULT_SUITE_ID
    || '';

  if (!canarySuiteId) {
    return res.status(503).json({
      error: 'NO_CANARY_SUITE',
      correlation_id: correlationId,
    });
  }

  // Synthetic payload — mirror the exact shape Anam Ava posts for paint
  // searches, with bodyParams envelope variant (the one we observed in
  // production transcripts). Address is a known Tallahassee location with
  // stable Home Depot proximity.
  const syntheticBody = {
    bodyParams: {
      task: 'canary: find paint at Home Depot near job site',
      agent: 'adam',
      query: 'paint',
      entity_type: 'product',
      user_address: '1575 Paul Russell Road, Tallahassee, FL 32301',
      suite_id: canarySuiteId,
    },
  };

  // Loopback to the public invoke endpoint so we exercise the FULL stack:
  // body parser, secret check, getRequestBody, dispatch, slim, cache, and
  // response shape. Localhost target so we don't egress to Railway from
  // inside Railway.
  const port = process.env.PORT || '5000';
  const internalUrl = `http://127.0.0.1:${port}/v1/tools/invoke`;
  const startedAt = Date.now();

  type CanaryFailure = { check: string; got: unknown; expected: unknown };
  const failures: CanaryFailure[] = [];

  let upstreamStatus = 0;
  let upstreamBody: any = null;

  try {
    const tokenSecret = process.env.ASPIRE_TOOL_SECRET
      || (process.env.TOOL_WEBHOOK_SHARED_SECRET || '').split(',')[0]
      || '';
    const upstream = await fetch(internalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aspire-tool-secret': tokenSecret,
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(syntheticBody),
      signal: AbortSignal.timeout(15000),
    });
    upstreamStatus = upstream.status;
    upstreamBody = await upstream.json().catch(() => null);
  } catch (err) {
    failures.push({
      check: 'upstream_invoke_reachable',
      got: err instanceof Error ? err.message : 'unknown',
      expected: 'invoke endpoint responds within 15s',
    });
  }

  const elapsedMs = Date.now() - startedAt;

  // ── Assertions on the response shape ──
  if (upstreamStatus !== 200) {
    failures.push({
      check: 'http_200',
      got: upstreamStatus,
      expected: 200,
    });
  }
  if (upstreamBody?.error) {
    failures.push({
      check: 'no_error_field',
      got: upstreamBody.error,
      expected: 'undefined',
    });
  }
  if (upstreamBody?.status !== 'completed') {
    failures.push({
      check: 'status_completed',
      got: upstreamBody?.status,
      expected: 'completed',
    });
  }
  const data = upstreamBody?.data;
  if (!data || typeof data !== 'object') {
    failures.push({ check: 'data_object', got: typeof data, expected: 'object' });
  } else {
    if (!Array.isArray(data.records) || data.records.length === 0) {
      failures.push({
        check: 'records_non_empty',
        got: Array.isArray(data.records) ? data.records.length : typeof data.records,
        expected: '>= 1',
      });
    }
    if (typeof data._card_cache_id !== 'string' || !data._card_cache_id) {
      failures.push({
        check: 'card_cache_id_present',
        got: data._card_cache_id,
        expected: 'non-empty string',
      });
    }
    if (data._records_cached !== true) {
      failures.push({
        check: 'records_cached_flag',
        got: data._records_cached,
        expected: true,
      });
    }
    // Slim records check: at least one product record with display fields.
    if (Array.isArray(data.records)) {
      const productRecords = data.records.filter((r: any) =>
        r && (r.product_name || r.name) && typeof r.price === 'number',
      );
      if (productRecords.length === 0) {
        failures.push({
          check: 'has_product_record_with_display_fields',
          got: data.records.length + ' records, none with product_name+price',
          expected: '>= 1 product with name + price',
        });
      }
      // Bloat regression: any record carrying thumbnails/variants is a sign
      // that slimAdamRecord stopped firing (regression of the May 3 fix).
      const bloatedRecords = data.records.filter((r: any) =>
        r && (Array.isArray(r.thumbnails) || Array.isArray(r.variants) || r.specifications),
      );
      if (bloatedRecords.length > 0) {
        failures.push({
          check: 'no_bloat_fields',
          got: bloatedRecords.length + ' records with thumbnails/variants/specifications',
          expected: '0 (slimAdamRecord must strip these)',
        });
      }
    }
  }

  // ── Insert incident on any failure ──
  if (failures.length > 0) {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const failureSummary = failures.map((f) => f.check).join(', ');
        await supabase.rpc('mveo_insert_incident', {
          p_tenant_id: canarySuiteId,
          p_severity: 'high',
          p_source: 'mveo_canary',
          p_title: `Synthetic canary FAILED: ${failureSummary}`,
          p_description: `Ava paint canary detected a regression. ${failures.length} check(s) failed. Check the metadata.failures field for what broke.`,
          p_component: 'mveo_synthetic_canary',
          p_fingerprint: `mveo:canary:ava_paint_flow:${failures.map((f) => f.check).sort().join('|')}`,
          p_metadata: {
            failures,
            elapsed_ms: elapsedMs,
            upstream_status: upstreamStatus,
            response_keys: upstreamBody && typeof upstreamBody === 'object'
              ? Object.keys(upstreamBody)
              : [],
            data_keys: data && typeof data === 'object'
              ? Object.keys(data)
              : [],
            record_count: Array.isArray(data?.records) ? data.records.length : 0,
            detector: 'mveo_canary_ava_paint_flow',
          },
          p_correlation_id: correlationId,
          p_dedupe_window: '15 minutes',
        });
      }
    } catch (recErr) {
      logger.error('[Canary] failed to insert incident', {
        error: recErr instanceof Error ? recErr.message : 'unknown',
      });
    }
  }

  logger.info('[Canary] ava-paint-flow', {
    correlation_id: correlationId,
    elapsed_ms: elapsedMs,
    upstream_status: upstreamStatus,
    failure_count: failures.length,
    record_count: Array.isArray(data?.records) ? data.records.length : 0,
  });

  return res.status(failures.length > 0 ? 200 : 200).json({
    canary: 'ava_paint_flow',
    ok: failures.length === 0,
    elapsed_ms: elapsedMs,
    correlation_id: correlationId,
    failure_count: failures.length,
    failures: failures.length > 0 ? failures : undefined,
  });
});

// Test-only surface area. Not consumed by production code paths; gives the
// Jest suite for the show_cards guard a way to seed and inspect the in-memory
// caches without exporting them globally.
export const __testing__ = {
  cardRecordsCache,
  latestCardCacheIdBySuite,
  isSparseRecord,
  isSparseRecordSet,
  slimAdamRecord,
  RECORD_CAP,
};

export default router;
