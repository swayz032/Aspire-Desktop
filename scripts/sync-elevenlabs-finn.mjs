#!/usr/bin/env node
// [STATUS: v1] — ElevenLabs Finn sync. Pushes prompt + 4 KB docs + 13 tools to agent_2201kmqdjjyben0tyg2t5eexnmzg.
/**
 * Sync Aspire - Finn ElevenLabs agent from canonical docs.
 *
 * Usage:
 *   ELEVENLABS_API_KEY=... node scripts/sync-elevenlabs-finn.mjs
 *   DRY_RUN=true node scripts/sync-elevenlabs-finn.mjs
 *   node scripts/sync-elevenlabs-finn.mjs --dry-run
 *
 * Reads:
 *   docs/agents/finn/01_FINN_SYSTEM_PROMPT.md
 *   docs/agents/finn/02_FINN_VOICE_RULES_v1.md
 *   docs/agents/finn/03_FINN_TASK_WORKFLOWS_v1.md
 *   docs/agents/finn/04_FINN_STRATEGIC_PLAYBOOK_v1.md
 *   docs/agents/finn/05_FINANCE_HUB_CANON_v1.md
 *   docs/agents/finn/06_FINN_TOOLS_CONTRACT_v1.md  (reference — tools defined here in code)
 *   agent_configs/Aspire-Finn.json
 *
 * First message: "Hey {{salutation}} {{last_name}}, Finn here."
 * Tool count: 13 (per tools contract)
 * Idempotent. Dry-run default if no API key.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const API_KEY = process.env.ELEVENLABS_API_KEY || process.env.XI_API_KEY || '';
const DRY_RUN = process.argv.includes('--dry-run') || String(process.env.DRY_RUN || '').toLowerCase() === 'true' || !API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';
const TOOL_BASE_URL = (process.env.ASPIRE_TOOL_BASE_URL || 'https://www.aspireos.app/v1/tools').replace(/\/+$/, '');
const TOOL_SECRET = process.env.ELEVENLABS_TOOL_SECRET || process.env.XI_TOOL_SECRET || '67a31a3b169095c75b000239c6e7878511f7ed5092a824b2eeadeec7447a9fe6';

const configRaw = fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Finn.json'), 'utf-8');
const config = JSON.parse(configRaw);
const sync = config._v1_sync;
const AGENT_ID = sync.agent_id; // agent_2201kmqdjjyben0tyg2t5eexnmzg

const systemPrompt = fs.readFileSync(path.join(ROOT, sync.prompt_path), 'utf-8').trim();
const kbDocs = sync.kb_paths.map((p) => ({
  name: path.basename(p, '.md'),
  content: fs.readFileSync(path.join(ROOT, p), 'utf-8').trim(),
}));

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
}

function log(msg, data) {
  const ts = new Date().toISOString();
  if (data !== undefined) {
    console.log(`[${ts}] [finn] ${msg}`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
  } else {
    console.log(`[${ts}] [finn] ${msg}`);
  }
}

async function apiCall(method, pathname, body) {
  const url = `${BASE_URL}${pathname}`;
  log(`${DRY_RUN ? '[DRY-RUN] WOULD ' : ''}${method} ${url}`);
  if (DRY_RUN) {
    if (body) log('  body:', body);
    return { dry_run: true };
  }
  const res = await fetch(url, {
    method,
    headers: { 'xi-api-key': API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`ElevenLabs API ${res.status} ${method} ${pathname}: ${text.slice(0, 500)}`);
  return data;
}

// ── Finn's 13-tool definition ─────────────────────────────────────────────────
// Per 06_FINN_TOOLS_CONTRACT_v1.md and finance hub canon
function buildFinnTools() {
  const toolUrl = (p) => `${TOOL_BASE_URL}/${p.replace(/^\/+/, '')}`;
  const headers = { 'Content-Type': 'application/json', 'x-elevenlabs-secret': TOOL_SECRET };

  const webhookTool = (name, description, urlPath, schema, forcePreToolSpeech = false) => ({
    type: 'webhook',
    name,
    description,
    response_timeout_secs: 20,
    disable_interruptions: false,
    force_pre_tool_speech: forcePreToolSpeech,
    assignments: [],
    tool_call_sound_behavior: 'auto',
    tool_error_handling_mode: 'auto',
    dynamic_variables: { dynamicVariablePlaceholders: {} },
    execution_mode: 'immediate',
    api_schema: {
      request_headers: headers,
      url: toolUrl(urlPath),
      method: 'POST',
      path_params_schema: {},
      request_body_schema: schema,
      content_type: 'application/json',
    },
  });

  return [
    // 1. get_context
    webhookTool('get_context', 'Get the owner financial overview — cash flow, revenue, expenses, outstanding invoices, and alerts. Call at session start.', 'context', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'What financial context to retrieve', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 2. search_invoices
    webhookTool('search_invoices', 'Search invoices by client, status (paid, overdue, draft), date range, or amount.', 'search', {
      type: 'object', required: ['suite_id', 'query', 'domain'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'Invoice search query', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        domain: { type: 'string', enum: ['invoices'], description: 'Always "invoices"', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 3. get_financial_data
    webhookTool('get_financial_data', 'Retrieve financial analytics: monthly cash flow, revenue trends, expense breakdown, budget vs actual, P&L summary.', 'context', {
      type: 'object', required: ['suite_id', 'query'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        query: { type: 'string', description: 'Financial data request, e.g. "monthly cash flow", "top expenses this quarter"', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 4. finn_get_classifications
    webhookTool('finn_get_classifications', 'Get transaction classification suggestions for uncategorized expenses. Returns top categories with confidence scores.', 'finance/classification/suggestions', {
      type: 'object', required: ['suite_id'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        transaction_ids: { type: 'array', items: { type: 'string' }, description: 'Optional specific transaction IDs to classify', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        limit: { type: 'number', description: 'Max transactions to return (default 20)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 5. finn_get_reconciliation
    webhookTool('finn_get_reconciliation', 'Get current reconciliation status: matched, unmatched, and disputed transactions with bank balance vs book balance.', 'finance/reconciliation/status', {
      type: 'object', required: ['suite_id'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        period: { type: 'string', description: 'Optional period, e.g. "2026-04" or "current"', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 6. finn_search_expenses
    webhookTool('finn_search_expenses', 'Search expense transactions by vendor, category, date range, or amount band.', 'search', {
      type: 'object', required: ['suite_id', 'query', 'domain'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        query: { type: 'string', description: 'Expense search query', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        domain: { type: 'string', enum: ['expenses'], description: 'Always "expenses"', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        date_from: { type: 'string', description: 'ISO date filter start', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        date_to: { type: 'string', description: 'ISO date filter end', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 7. finn_get_tax_estimates
    webhookTool('finn_get_tax_estimates', 'Get quarterly estimated tax obligations based on current revenue and expense data. Returns estimated amounts and due dates.', 'finance/tax/estimates', {
      type: 'object', required: ['suite_id'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        tax_year: { type: 'number', description: 'Optional tax year (default current year)', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 8. finn_get_cash_flow_forecast
    webhookTool('finn_get_cash_flow_forecast', 'Get 30/60/90-day cash flow forecast based on outstanding invoices, recurring expenses, and historical patterns.', 'finance/forecast/cashflow', {
      type: 'object', required: ['suite_id'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        horizon_days: { type: 'number', description: 'Forecast horizon: 30, 60, or 90', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 9. create_invoice_draft
    webhookTool('create_invoice_draft', 'Create an invoice draft for user review. ALWAYS present summary and confirm before calling request_approval.', 'draft', {
      type: 'object', required: ['suite_id', 'draft_type', 'params'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        draft_type: { type: 'string', enum: ['invoice', 'quote'], description: 'invoice or quote', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        params: {
          type: 'object', required: ['client_name', 'amount_cents'],
          description: 'Invoice parameters',
          properties: {
            client_name: { type: 'string', description: 'Client or company name' },
            amount_cents: { type: 'number', description: 'Total in cents (e.g. 250000 for $2,500.00)' },
            line_items: { type: 'string', description: 'Line item descriptions' },
            due_date: { type: 'string', description: 'Due date ISO string' },
            notes: { type: 'string', description: 'Optional memo or notes' },
          },
        },
      },
    }, true),
    // 10. finn_draft_budget_proposal
    webhookTool('finn_draft_budget_proposal', 'Draft a budget proposal or financial recommendation for owner review. Does NOT execute — creates a draft only.', 'draft', {
      type: 'object', required: ['suite_id', 'draft_type', 'params'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        draft_type: { type: 'string', enum: ['budget_proposal', 'financial_recommendation'], description: 'Type of financial draft', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        params: {
          type: 'object', required: ['title', 'summary'],
          properties: {
            title: { type: 'string', description: 'Proposal title' },
            summary: { type: 'string', description: 'Financial summary and recommendation' },
            period: { type: 'string', description: 'Budget period e.g. "Q3 2026"' },
            line_items: { type: 'array', items: { type: 'object' }, description: 'Budget line items' },
          },
        },
      },
    }),
    // 11. finn_save_finance_memory
    webhookTool('finn_save_finance_memory', 'Persist a financial insight, decision, or alert to office memory for future sessions. Only for significant findings.', 'memory/write', {
      type: 'object', required: ['suite_id', 'memory_type', 'summary'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        memory_type: { type: 'string', enum: ['financial_insight', 'tax_decision', 'budget_alert', 'cash_flow_flag'], description: 'Category of financial memory', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        summary: { type: 'string', description: 'The financial insight or decision to persist', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        visibility_scope: { type: 'string', enum: ['finance'], description: 'Always finance for Finn', is_system_provided: false, dynamic_variable: '', constant_value: 'finance' },
        confidence: { type: 'number', description: 'Confidence 0.0-1.0', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 12. request_approval
    webhookTool('request_approval', 'Submit a confirmed draft for approval. ONLY call after owner reviews and confirms. Returns capability_token for execute_action.', 'approve', {
      type: 'object', required: ['suite_id', 'draft_id', 'action'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        draft_id: { type: 'string', description: 'draft_id from create_invoice_draft', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        action: { type: 'string', description: 'Action type matching original draft', is_system_provided: false, dynamic_variable: '', constant_value: '' },
      },
    }),
    // 13. execute_action (RED-tier, capability-token gated)
    webhookTool('execute_action', 'Execute an approved action using capability_token from request_approval. HIGH-STAKES: only call after approval returns token. Aspire does NOT move money — execution triggers downstream webhook only.', 'execute', {
      type: 'object', required: ['suite_id', 'capability_token', 'action', 'params'], properties: {
        suite_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'suite_id', constant_value: '' },
        user_id: { type: 'string', description: '', is_system_provided: false, dynamic_variable: 'user_id', constant_value: '' },
        capability_token: { type: 'string', description: 'Token from request_approval', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        action: { type: 'string', description: 'Action type', is_system_provided: false, dynamic_variable: '', constant_value: '' },
        params: { type: 'object', required: [], description: 'Action parameters', properties: {} },
      },
    }, true),
  ];
}

async function main() {
  log(`Starting sync for Aspire - Finn (${AGENT_ID})`);
  log(`Dry-run: ${DRY_RUN}`);
  log(`Prompt SHA: ${sha256(systemPrompt)}`);
  log(`KB docs (${kbDocs.length}): ${kbDocs.map((d) => d.name).join(', ')}`);
  log(`First message: "${sync.first_message}"`);

  const tools = buildFinnTools();
  log(`Tools to push: ${tools.length} (${tools.map((t) => t.name).join(', ')})`);

  // Before state
  log('--- BEFORE STATE ---');
  const before = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!before.dry_run) {
    log(`Before prompt SHA: ${sha256(before?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`Before tool count: ${(before?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`Before KB count: ${(before?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  // Push prompt + first_message + dynamic_variables
  log('--- PUSHING PROMPT ---');
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: {
      agent: {
        prompt: { prompt: systemPrompt },
        first_message: sync.first_message,
        dynamic_variables: {
          dynamic_variable_placeholders: Object.fromEntries(
            Object.entries(config.conversation_config?.agent?.dynamic_variables?.dynamic_variable_placeholders || {})
          ),
        },
      },
    },
  });
  log('Prompt pushed.');

  // Push KB docs
  log('--- PUSHING KB DOCS ---');
  for (const doc of kbDocs) {
    log(`Pushing KB: ${doc.name} (${doc.content.length} chars, SHA: ${sha256(doc.content)})`);
    await apiCall('POST', `/convai/agents/${AGENT_ID}/knowledge-base`, { name: doc.name, content: doc.content });
    log(`KB pushed: ${doc.name}`);
  }

  // Push tools
  log('--- PUSHING TOOLS ---');
  log(`Pushing ${tools.length} tools via prompt update`);
  await apiCall('PATCH', `/convai/agents/${AGENT_ID}`, {
    conversation_config: { agent: { prompt: { tools } } },
  });
  log(`${tools.length} tools pushed.`);

  // After state
  log('--- AFTER STATE ---');
  const after = await apiCall('GET', `/convai/agents/${AGENT_ID}`);
  if (!after.dry_run) {
    log(`After prompt SHA: ${sha256(after?.conversation_config?.agent?.prompt?.prompt || '')}`);
    log(`After tool count: ${(after?.conversation_config?.agent?.prompt?.tools || []).length}`);
    log(`After KB count: ${(after?.conversation_config?.agent?.prompt?.knowledge_base || []).length}`);
  }

  // Update last_synced_at
  if (!DRY_RUN) {
    const updated = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent_configs/Aspire-Finn.json'), 'utf-8'));
    updated._v1_sync.last_synced_at = new Date().toISOString();
    fs.writeFileSync(path.join(ROOT, 'agent_configs/Aspire-Finn.json'), JSON.stringify(updated, null, 4));
    log('Updated agent_configs/Aspire-Finn.json with last_synced_at.');
  }

  log(`Sync complete. agent_id=${AGENT_ID} tools=${tools.length} dry_run=${DRY_RUN}`);
}

main().catch((err) => {
  console.error('[finn] sync failed:', err.message || err);
  process.exit(1);
});
