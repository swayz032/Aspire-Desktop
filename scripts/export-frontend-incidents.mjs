import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function inferSeverity(contractId, mode) {
  if (mode === 'auth') {
    return 'sev2';
  }

  if (['landing-root', 'login-shell', 'home-shell'].includes(contractId)) {
    return 'sev2';
  }

  return 'sev3';
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    args[token.slice(2)] = argv[i + 1];
    i += 1;
  }
  return args;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function summarizeError(result) {
  const errors = [];

  if (result.error?.message) {
    errors.push(result.error.message);
  }

  for (const error of result.errors || []) {
    if (error?.message) errors.push(error.message);
  }

  return errors.join('\n').trim() || 'Unknown Playwright failure';
}

function collectSpecs(suite, chain = []) {
  const titleChain = [...chain, suite.title].filter(Boolean);
  const items = [];

  for (const child of suite.suites || []) {
    items.push(...collectSpecs(child, titleChain));
  }

  for (const spec of suite.specs || []) {
    for (const playwrightTest of spec.tests || []) {
      const finalResult = playwrightTest.results?.[playwrightTest.results.length - 1];
      items.push({
        titlePath: [...titleChain, spec.title],
        projectName: playwrightTest.projectName,
        status: finalResult?.status || 'unknown',
        durationMs: finalResult?.duration || 0,
        errorSummary: summarizeError(finalResult || {}),
        attachments: (finalResult?.attachments || [])
          .map((attachment) => attachment.path)
          .filter(Boolean),
      });
    }
  }

  return items;
}

function inferMode(flattened) {
  const contractIds = flattened
    .map((item) => item.titlePath[item.titlePath.length - 1] || '')
    .map((title) => title.split('|')[0]?.trim())
    .filter(Boolean);

  if (contractIds.some((id) => id === 'landing-root' || id === 'login-shell')) {
    return 'public';
  }

  if (
    contractIds.some((id) =>
      ['home-shell', 'finance-hub-shell', 'finance-connections-shell', 'voice-test-shell'].includes(id),
    )
  ) {
    return 'auth';
  }

  return 'unknown';
}

function buildInfraFailureIncident(reportPath, errorMessage) {
  return {
    contract_id: 'synthetic-infrastructure',
    title: 'Synthetic infrastructure failure',
    status: 'failed',
    project: process.env.ASPIRE_E2E_MODE || 'unknown',
    duration_ms: 0,
    error_summary: `${errorMessage} (${reportPath})`,
    attachments: [],
  };
}

function buildAdminIncidentPayload({ incident, payload, correlationId }) {
  const contractId = incident.contract_id || 'unknown-contract';
  return {
    title: `${contractId} | ${incident.title || 'Synthetic failure'}`,
    message: incident.error_summary,
    source: 'github_frontend_synthetics',
    component: incident.project || 'aspire-desktop',
    severity: inferSeverity(contractId, payload.mode),
    state: 'open',
    correlation_id: correlationId,
    trace_id: correlationId,
    session_id: payload.run_id || null,
    error_code: 'playwright_smoke_failed',
    fingerprint: [
      'frontend-smoke',
      payload.environment || 'unknown',
      payload.mode || 'unknown',
      contractId,
      payload.sha || 'unknown',
    ].join(':'),
    evidence_pack: {
      source: 'github-actions',
      component: 'frontend-synthetics',
      page_route: contractId,
      contract_id: contractId,
      mode: payload.mode,
      environment: payload.environment,
      repo: payload.repo,
      sha: payload.sha,
      ref: payload.ref,
      workflow: payload.workflow,
      run_id: payload.run_id,
      run_attempt: payload.run_attempt,
      run_url: payload.run_url,
      attachments: incident.attachments || [],
      duration_ms: incident.duration_ms || 0,
      title: incident.title,
      status: incident.status,
      error_summary: incident.error_summary,
    },
  };
}

async function exportToAdminIncidentReporter({ webhookUrl, webhookSecret, payload, incidents }) {
  if (incidents.length === 0) {
    console.log('[incident-export] no failing incidents, skipping admin reporter export');
    return;
  }

  const correlationSeed = payload.run_id || Date.now();
  for (const [index, incident] of incidents.entries()) {
    const correlationId = `frontend-synthetics-${correlationSeed}-${payload.mode || 'unknown'}-${index + 1}`;
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${webhookSecret}`,
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        'x-actor-id': 'github_frontend_synthetics',
      },
      body: JSON.stringify(buildAdminIncidentPayload({ incident, payload, correlationId })),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new Error(`admin incident export failed (${response.status}): ${responseBody}`);
    }
  }

  console.log(`[incident-export] exported ${incidents.length} incidents to admin reporter`);
}

async function exportToHmacWebhook({ webhookUrl, webhookSecret, payload, incidents }) {
  const canonicalBody = JSON.stringify(sortKeys(payload));
  const signature = `sha256=${crypto.createHmac('sha256', webhookSecret).update(canonicalBody).digest('hex')}`;

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-webhook-signature': signature,
      'x-correlation-id': `frontend-synthetics-${process.env.GITHUB_RUN_ID || Date.now()}`,
    },
    body: canonicalBody,
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`webhook export failed (${response.status}): ${responseBody}`);
  }

  console.log(`[incident-export] exported ${incidents.length} incidents to hmac webhook`);
}

async function loadReport(reportPath) {
  try {
    const contents = await fs.readFile(reportPath, 'utf8');
    return JSON.parse(contents);
  } catch (error) {
    return {
      suites: [],
      infraFailure: buildInfraFailureIncident(reportPath, error instanceof Error ? error.message : 'Unable to read report'),
    };
  }
}

const args = parseArgs(process.argv.slice(2));
const reportPath = path.resolve(process.cwd(), args.report || 'test-results/playwright-smoke.json');
const payloadPath = path.resolve(process.cwd(), args.output || 'test-results/frontend-incident-payload.json');
const webhookUrl = process.env.N8N_FRONTEND_INCIDENT_WEBHOOK_URL || '';
const webhookSecret = process.env.N8N_FRONTEND_INCIDENT_WEBHOOK_SECRET || '';
const report = await loadReport(reportPath);

const flattened = (report.suites || []).flatMap((suite) => collectSpecs(suite));
const incidents = report.infraFailure
  ? [report.infraFailure]
  : flattened
      .filter((item) => item.status !== 'passed' && item.status !== 'skipped')
      .map((item) => {
        const [contractId, title = item.titlePath[item.titlePath.length - 1]] = item.titlePath[item.titlePath.length - 1].split('|').map((part) => part.trim());
        return {
          contract_id: contractId,
          title,
          status: item.status,
          project: item.projectName || process.env.ASPIRE_E2E_MODE || 'unknown',
          duration_ms: item.durationMs,
          error_summary: item.errorSummary,
          attachments: item.attachments,
        };
      });

const total = flattened.length || (report.infraFailure ? 1 : 0);
const failed = incidents.length;
const passed = Math.max(total - failed, 0);
const skipped = flattened.filter((item) => item.status === 'skipped').length;
const mode = process.env.ASPIRE_E2E_MODE || inferMode(flattened);
const environment =
  process.env.ASPIRE_SYNTHETIC_ENV || (process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local');
const repo = process.env.GITHUB_REPOSITORY || null;
const runId = process.env.GITHUB_RUN_ID || null;
const runUrl = repo && runId ? `https://github.com/${repo}/actions/runs/${runId}` : null;

const payload = {
  source: 'playwright-smoke',
  app: 'aspire-desktop',
  environment,
  mode,
  generated_at: new Date().toISOString(),
  repo,
  sha: process.env.GITHUB_SHA || null,
  ref: process.env.GITHUB_REF_NAME || null,
  workflow: process.env.GITHUB_WORKFLOW || null,
  run_id: runId,
  run_attempt: process.env.GITHUB_RUN_ATTEMPT || null,
  run_url: runUrl,
  summary: {
    total,
    passed,
    failed,
    skipped,
  },
  incidents,
};

await fs.mkdir(path.dirname(payloadPath), { recursive: true });
await fs.writeFile(payloadPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`[incident-export] wrote payload to ${payloadPath}`);

if (!webhookUrl || !webhookSecret) {
  console.log('[incident-export] webhook env missing, skipping incident export');
  process.exit(0);
}

const adminIncidentPath = '/admin/ops/incidents/report';
if (webhookUrl.includes(adminIncidentPath)) {
  await exportToAdminIncidentReporter({ webhookUrl, webhookSecret, payload, incidents });
  process.exit(0);
}

await exportToHmacWebhook({ webhookUrl, webhookSecret, payload, incidents });
