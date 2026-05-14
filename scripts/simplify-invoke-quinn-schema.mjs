// Production fix: simplify invoke_quinn schema to only {agent, task, details}.
//
// Root cause: Anam's tool-call serializer reliably forwards the body when the
// brain emits {agent, task, details} (proven by Railway logs at 21:50:43Z and
// 21:51:58Z). It silently drops the body to 0 bytes when the brain emits
// structured fields like {customer_name, customer_email, line_items} (proven
// by Railway logs from 22:43:55Z onward across 4 distinct sessions).
//
// The brain decides which fields to emit based on the schema. By removing
// structured customer/invoice fields from the schema, the brain cannot emit
// them — it has no choice but to use `details` as a natural-language string.
//
// Backend Quinn handler at server.py:2196 already uses GPT-5.2 to parse
// {customer_name, customer_email, line_items, total_cents, due_days, notes,
// is_quote} from the natural-language full_task field. So no backend change
// is needed.
//
// This matches the schema pattern of invoke_clara (which also works):
//   { agent, task, details }
//
// Usage: ANAM_API_KEY=... node scripts/simplify-invoke-quinn-schema.mjs [--dry-run]
import process from 'node:process';

const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }
const DRY = process.argv.includes('--dry-run');
const BASE = 'https://api.anam.ai/v1';

async function api(p, opts = {}) {
  const r = await fetch(`${BASE}${p}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await r.text();
  let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${p} → ${r.status}: ${typeof body === 'string' ? body.slice(0,400) : JSON.stringify(body).slice(0,400)}`);
  return body;
}

const list = await api('/tools?perPage=200');
const tools = list.data || list;
const quinn = tools.find(t => t.name === 'invoke_quinn');
if (!quinn) { console.error('invoke_quinn not found'); process.exit(1); }

console.log('Current invoke_quinn schema:');
console.log('  required:', quinn.config.parameters.required);
console.log('  properties:', Object.keys(quinn.config.parameters.properties));
console.log('  additionalProperties:', quinn.config.parameters.additionalProperties);

const newParameters = {
  type: 'object',
  strict: false,
  required: ['agent', 'task', 'details'],
  properties: {
    agent: {
      type: 'string',
      enum: ['quinn'],
      description: 'Must be quinn',
    },
    task: {
      type: 'string',
      description: 'Either the literal string "invoice" or "quote" — nothing else.',
    },
    details: {
      type: 'string',
      description:
        "Natural-language description of the request. For a customer lookup (Step 2 of the invoicing workflow), this is just the customer's full name. For the final invoice/quote creation (Step 9), this is a single natural-language string containing: customer name, customer email, what's being billed (with quantity and per-unit price or flat amount), total amount, due date (or valid-until date for quotes), and any notes. Example: 'Ricky Joy LLC, email rickyjoy@gmail.com, billing for 500 GMA pallets at 9.50 each, total 4750, due in 20 days, notes: brand new GMA 48x40 pallets.' For quotes include the literal phrase 'this is a quote' inside this string.",
    },
  },
  additionalProperties: false,
};

const newConfig = { ...quinn.config, parameters: newParameters };

console.log('\nNew invoke_quinn schema (will replace):');
console.log('  required:', newParameters.required);
console.log('  properties:', Object.keys(newParameters.properties));
console.log('  additionalProperties:', newParameters.additionalProperties);

if (DRY) {
  console.log('\n--dry-run: no changes made');
  process.exit(0);
}

console.log('\nApplying...');
const updated = await api(`/tools/${quinn.id}`, {
  method: 'PUT',
  body: JSON.stringify({ config: newConfig }),
});
console.log('  required:', updated.config.parameters.required);
console.log('  properties:', Object.keys(updated.config.parameters.properties));
console.log('  additionalProperties:', updated.config.parameters.additionalProperties);
console.log('\n✓ invoke_quinn schema simplified.');
