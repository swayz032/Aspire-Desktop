import crypto from 'crypto';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { createTrustSpineReceipt } from '../receiptService';
import * as polaris from './polarisClient';
import { encryptPassword } from './imapClient';
import { logger } from '../logger';

// ─── State Machine ───

// Valid state transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  // Google path
  INIT: ['GOOGLE_OAUTH_PENDING', 'DOMAIN_SELECTED', 'FAILED'],
  GOOGLE_OAUTH_PENDING: ['GOOGLE_OAUTH_COMPLETE', 'FAILED'],
  GOOGLE_OAUTH_COMPLETE: ['CHECKS_RUNNING', 'FAILED'],

  // PolarisM path
  DOMAIN_SELECTED: ['POLARIS_DOMAIN_ADDED', 'FAILED'],
  POLARIS_DOMAIN_ADDED: ['DNS_PLAN_READY', 'FAILED'],
  DNS_PLAN_READY: ['VERIFYING_DNS', 'FAILED'],
  VERIFYING_DNS: ['DNS_HEALTHY', 'FAILED'],
  DNS_HEALTHY: ['DKIM_ENABLED', 'MAILBOX_PROVISIONED', 'FAILED'],
  DKIM_ENABLED: ['DNS_HEALTHY', 'MAILBOX_PROVISIONED', 'FAILED'],
  MAILBOX_PROVISIONED: ['CHECKS_RUNNING', 'FAILED'],

  // Common final
  CHECKS_RUNNING: ['ACTIVE', 'FAILED'],
  ACTIVE: [],
  FAILED: ['INIT'],
};

function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

async function transitionState(
  jobId: string,
  suiteId: string,
  targetState: string,
  updates?: Record<string, any>,
): Promise<void> {
  // Read current state
  const result = await db.execute(sql`
    SELECT state FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) throw new Error('Onboarding job not found');

  const currentState = rows[0].state;
  if (!isValidTransition(currentState, targetState)) {
    // Fail-closed: invalid transition → FAILED state
    await db.execute(sql`
      UPDATE app.mail_onboarding_jobs
      SET state = 'FAILED',
          state_updated_at = now(),
          last_error = ${`Invalid transition: ${currentState} → ${targetState}`}
      WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
    `);

    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.invalid_transition',
      status: 'FAILED',
      action: { jobId, fromState: currentState, targetState },
      result: { error: 'Invalid state transition' },
    });

    throw new Error(`Invalid state transition: ${currentState} → ${targetState}`);
  }

  // Parameterized state transition — Law #6: suite_id + state guard for optimistic lock
  await db.execute(sql`
    UPDATE app.mail_onboarding_jobs
    SET state = ${targetState},
        state_updated_at = now()
    WHERE id = ${jobId}::uuid
      AND suite_id = ${suiteId}::uuid
      AND state = ${currentState}
  `);

  // Apply additional updates if any
  if (updates && Object.keys(updates).length > 0) {
    for (const [key, value] of Object.entries(updates)) {
      // All UPDATEs include suite_id guard — Law #6: Tenant Isolation
      if (key === 'domain') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET domain = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'domain_mode') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET domain_mode = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'mailbox_email') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET mailbox_email = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'display_name') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET display_name = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'verification_txt') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET verification_txt = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'dkim_host') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET dkim_host = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'dkim_value') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET dkim_value = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'last_health') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET last_health = ${JSON.stringify(value)}::jsonb WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'last_error') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET last_error = ${value} WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'eli_config') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET eli_config = ${JSON.stringify(value)}::jsonb WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      } else if (key === 'domain_purchase') {
        await db.execute(sql`UPDATE app.mail_onboarding_jobs SET domain_purchase = ${JSON.stringify(value)}::jsonb WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid`);
      }
    }
  }
}

// ─── Public API ───

export async function startOnboarding(
  suiteId: string,
  officeId: string,
  provider: 'POLARIS' | 'GOOGLE',
  context?: any,
): Promise<{ jobId: string; correlationId: string; provider: string; state: string }> {
  const correlationId = `corr_${crypto.randomUUID()}`;

  try {
    const result = await db.execute(sql`
      INSERT INTO app.mail_onboarding_jobs (suite_id, office_id, correlation_id, provider, state)
      VALUES (${suiteId}::uuid, ${officeId}::uuid, ${correlationId}, ${provider}, 'INIT')
      RETURNING id
    `);
    const rows = (result.rows || result) as any[];
    const jobId = rows[0].id;

    // YELLOW receipt — starting external service setup
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.started',
      status: 'SUCCEEDED',
      correlationId,
      action: { provider, jobId },
      result: { state: 'INIT' },
    });

    // If Google, transition to GOOGLE_OAUTH_PENDING
    if (provider === 'GOOGLE') {
      await transitionState(jobId, suiteId, 'GOOGLE_OAUTH_PENDING');
    }

    return { jobId, correlationId, provider, state: provider === 'GOOGLE' ? 'GOOGLE_OAUTH_PENDING' : 'INIT' };
  } catch (err: any) {
    // Failure receipt — Law #2: receipt even on failure
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.start_failed',
      status: 'FAILED',
      correlationId,
      action: { provider, operation: 'start_onboarding' },
      result: { error: 'start_failed' },
    }).catch(() => {});
    throw err;
  }
}

export async function getOnboarding(
  jobId: string,
  suiteId: string,
): Promise<any> {
  const result = await db.execute(sql`
    SELECT * FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) throw new Error('Onboarding job not found');

  const job = rows[0];

  // Map to frontend MailOnboardingState shape
  return {
    jobId: job.id,
    provider: job.provider,
    state: job.state,
    domain: job.domain,
    domainMode: job.domain_mode === 'byod' ? 'EXISTING_DOMAIN' : job.domain_mode === 'buy_domain' ? 'NEW_DOMAIN' : undefined,
    mailboxes: job.mailbox_email ? [{ email: job.mailbox_email, displayName: job.display_name }] : [],
    dnsPlan: job.state === 'DNS_PLAN_READY' || job.dkim_host ? getDnsPlanRecords(job) : undefined,
    dnsStatus: job.last_health ? {
      lastCheckedAt: job.state_updated_at,
      results: formatHealthResults(job.last_health),
    } : undefined,
    oauthStatus: job.provider === 'GOOGLE' ? {
      connectedEmail: job.mailbox_email,
      scopes: ['gmail.readonly', 'gmail.send', 'gmail.modify', 'gmail.labels'],
    } : undefined,
    checks: job.eli_config?.checks || undefined,
    eli: job.eli_config?.policy || undefined,
    domainPurchase: job.domain_purchase || undefined,
    lastError: job.last_error,
    correlationId: job.correlation_id,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

function getDnsPlanRecords(job: any): Array<{ type: string; host: string; value: string; ttl?: number }> {
  const records: Array<{ type: string; host: string; value: string; ttl?: number }> = [
    { type: 'MX', host: '@', value: 'mx1.emailarray.com', ttl: 3600 },
    { type: 'MX', host: '@', value: 'mx2.emailarray.com', ttl: 3600 },
    { type: 'SPF', host: '@', value: 'v=spf1 include:spf.emailarray.com ~all', ttl: 3600 },
    { type: 'CNAME', host: 'webmail', value: 'webmail.emailarray.com', ttl: 3600 },
  ];

  if (job.verification_txt) {
    records.push({ type: 'TXT', host: '@', value: job.verification_txt, ttl: 3600 });
  }

  if (job.dkim_host && job.dkim_value) {
    records.push({ type: 'DKIM', host: job.dkim_host, value: job.dkim_value, ttl: 3600 });
  }

  return records;
}

function formatHealthResults(health: any): Array<{ type: string; ok: boolean; observed?: string }> {
  if (!health || typeof health !== 'object') return [];
  return [
    { type: 'MX', ok: !!health.mxOk },
    { type: 'SPF', ok: !!health.spfOk },
    { type: 'DKIM', ok: !!health.dkimOk },
    { type: 'Verification', ok: !!health.verified },
  ];
}

export async function setDomain(
  jobId: string,
  suiteId: string,
  domain: string,
  domainMode: string,
): Promise<{ verificationTxt?: string }> {
  // Validate domain format
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    throw new Error('Invalid domain format');
  }

  const mode = domainMode === 'NEW_DOMAIN' ? 'buy_domain' : 'byod';

  await transitionState(jobId, suiteId, 'DOMAIN_SELECTED', {
    domain,
    domain_mode: mode,
  });

  // Receipt — Law #2: domain selected
  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.onboarding.domain_set',
    status: 'SUCCEEDED',
    action: { jobId, domain, mode, operation: 'set_domain' },
    result: { domainMode: mode },
  }).catch(() => {});

  // For BYOD, add domain to PolarisM
  if (mode === 'byod') {
    try {
      const result = await polaris.addDomain(domain, suiteId);
      await transitionState(jobId, suiteId, 'POLARIS_DOMAIN_ADDED', {
        verification_txt: result.verificationTxt,
      });

      // Store domain in mail_domains table
      await db.execute(sql`
        INSERT INTO app.mail_domains (suite_id, office_id, domain_name, registrar, status, provider_ref)
        SELECT ${suiteId}::uuid, office_id, ${domain}, 'external', 'pending_verification', ${result.domainId || ''}
        FROM app.mail_onboarding_jobs WHERE id = ${jobId}::uuid
        ON CONFLICT (suite_id, domain_name) DO UPDATE SET
          status = 'pending_verification',
          provider_ref = EXCLUDED.provider_ref,
          updated_at = now()
      `);

      return { verificationTxt: result.verificationTxt };
    } catch (err: any) {
      // Failure receipt — Law #2
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.onboarding.domain_set_failed',
        status: 'FAILED',
        action: { jobId, domain, mode, operation: 'set_domain' },
        result: { error: 'polaris_add_domain_failed' },
      }).catch(() => {});
      await transitionState(jobId, suiteId, 'FAILED', {
        last_error: 'PolarisM addDomain failed',
      }).catch(() => {});
      throw err;
    }
  }

  return {};
}

export async function generateDnsPlan(
  jobId: string,
  suiteId: string,
  domain: string,
  mailbox: string,
  displayName: string,
  domainMode: string,
): Promise<{ records: any[] }> {
  // Get job to read verification_txt and dkim values
  const result = await db.execute(sql`
    SELECT * FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) throw new Error('Job not found');

  const job = rows[0];

  // Try to enable DKIM
  let dkimHost = job.dkim_host;
  let dkimValue = job.dkim_value;
  if (!dkimHost && job.domain) {
    try {
      const dkim = await polaris.enableDKIM(job.domain, suiteId);
      dkimHost = dkim.dkimHost;
      dkimValue = dkim.dkimValue;
      await db.execute(sql`
        UPDATE app.mail_onboarding_jobs
        SET dkim_host = ${dkimHost}, dkim_value = ${dkimValue}
        WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
      `);
    } catch {
      // DKIM enable may fail if domain not yet verified — non-fatal
    }
  }

  // Store mailbox info
  await db.execute(sql`
    UPDATE app.mail_onboarding_jobs
    SET mailbox_email = ${`${mailbox}@${domain}`},
        display_name = ${displayName}
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);

  // Transition to DNS_PLAN_READY
  if (job.state === 'POLARIS_DOMAIN_ADDED' || job.state === 'DOMAIN_SELECTED') {
    await transitionState(jobId, suiteId, 'DNS_PLAN_READY');
  }

  const records = getDnsPlanRecords({ ...job, dkim_host: dkimHost, dkim_value: dkimValue });

  // Store DNS records in mail_dns_records table
  for (const rec of records) {
    await db.execute(sql`
      INSERT INTO app.mail_dns_records (suite_id, domain_id, record_type, record_name, record_value, status)
      SELECT ${suiteId}::uuid, domain_id, ${rec.type}, ${rec.host}, ${rec.value}, 'pending'
      FROM app.mail_domains
      WHERE suite_id = ${suiteId}::uuid AND domain_name = ${domain}
      ON CONFLICT DO NOTHING
    `);
  }

  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.dns.plan_generated',
    status: 'SUCCEEDED',
    action: { jobId, domain, recordCount: records.length },
    result: { records: records.map(r => ({ type: r.type, host: r.host })) },
  });

  return { records };
}

export async function checkDns(
  jobId: string,
  suiteId: string,
): Promise<{ health: polaris.DomainHealth; allHealthy: boolean }> {
  const result = await db.execute(sql`
    SELECT domain, state FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) throw new Error('Job not found');

  const { domain, state } = rows[0];
  if (!domain) throw new Error('No domain set on this job');

  const health = await polaris.getDomainHealth(domain, suiteId);

  // Store health results — Law #6: suite_id guard
  await db.execute(sql`
    UPDATE app.mail_onboarding_jobs
    SET last_health = ${JSON.stringify(health)}::jsonb
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);

  // Transition to VERIFYING_DNS if not already there
  if (state === 'DNS_PLAN_READY') {
    await transitionState(jobId, suiteId, 'VERIFYING_DNS');
  }

  // If verification passed and DKIM not yet enabled, enable it
  if (health.verified) {
    const jobData = await db.execute(sql`
      SELECT dkim_host, dkim_value FROM app.mail_onboarding_jobs
      WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
    `);
    const jobRows = (jobData.rows || jobData) as any[];
    if (!jobRows[0]?.dkim_host) {
      try {
        const dkim = await polaris.enableDKIM(domain, suiteId);
        await db.execute(sql`
          UPDATE app.mail_onboarding_jobs
          SET dkim_host = ${dkim.dkimHost}, dkim_value = ${dkim.dkimValue}
          WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
        `);
      } catch {
        // Non-fatal
      }
    }
  }

  // If all healthy, transition
  if (health.overall && (state === 'VERIFYING_DNS' || state === 'DNS_PLAN_READY')) {
    await transitionState(jobId, suiteId, 'DNS_HEALTHY');
  }

  // Receipt — Law #2: every state change produces a receipt
  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.dns.check_completed',
    status: health.overall ? 'SUCCEEDED' : 'FAILED',
    action: { jobId, domain, operation: 'dns_check' },
    result: {
      verified: health.verified,
      mxOk: health.mxOk,
      spfOk: health.spfOk,
      dkimOk: health.dkimOk,
      overall: health.overall,
    },
  }).catch(() => {});

  return { health, allHealthy: health.overall };
}

export async function createMailboxOnJob(
  jobId: string,
  suiteId: string,
  localPart: string,
  password: string,
): Promise<{ email: string }> {
  const result = await db.execute(sql`
    SELECT domain, office_id FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) throw new Error('Job not found');

  const { domain, office_id } = rows[0];
  if (!domain) throw new Error('No domain set');

  const mailboxResult = await polaris.createMailbox(domain, localPart, password, suiteId);
  const email = mailboxResult.email;

  // Encrypt password for IMAP/SMTP access — Law #9: encrypted at rest
  let encPwd: string | null = null;
  try {
    encPwd = encryptPassword(password);
  } catch {
    // TOKEN_ENCRYPTION_KEY not set — password won't be stored (IMAP won't work)
    // Non-fatal: mailbox is still created in PolarisM
    logger.warn('[createMailbox] TOKEN_ENCRYPTION_KEY not set — IMAP credentials not stored');
  }

  // Store in mail_accounts (with encrypted password for IMAP auth)
  await db.execute(sql`
    INSERT INTO app.mail_accounts (suite_id, office_id, domain_id, email_address, display_name, mailbox_provider, status, provider_ref, encrypted_password)
    SELECT ${suiteId}::uuid, ${office_id}::uuid, domain_id, ${email}, ${localPart}, 'polaris', 'provisioning', ${mailboxResult.mailboxId || ''}, ${encPwd}
    FROM app.mail_domains
    WHERE suite_id = ${suiteId}::uuid AND domain_name = ${domain}
    ON CONFLICT (suite_id, email_address) DO UPDATE SET
      status = 'provisioning',
      provider_ref = EXCLUDED.provider_ref,
      encrypted_password = COALESCE(EXCLUDED.encrypted_password, app.mail_accounts.encrypted_password),
      updated_at = now()
  `);

  await transitionState(jobId, suiteId, 'MAILBOX_PROVISIONED', {
    mailbox_email: email,
  });

  // Receipt — Law #2: mailbox provisioned
  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.mailbox.provisioned',
    status: 'SUCCEEDED',
    action: { jobId, domain, localPart, operation: 'create_mailbox' },
    result: { email: '<EMAIL_REDACTED>', provider: 'polaris' },
  }).catch(() => {});

  return { email };
}

export async function applyEliPolicy(
  jobId: string,
  suiteId: string,
  policy: any,
): Promise<void> {
  await db.execute(sql`
    UPDATE app.mail_onboarding_jobs
    SET eli_config = ${JSON.stringify({ policy })}::jsonb
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);

  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.eli.policy_applied',
    status: 'SUCCEEDED',
    action: { jobId, policy: { canDraft: policy.canDraft, canSend: policy.canSend, rateLimitPreset: policy.rateLimitPreset } },
    result: { applied: true },
  });
}

export async function activateOnboarding(
  jobId: string,
  suiteId: string,
): Promise<{ email: string }> {
  const result = await db.execute(sql`
    SELECT * FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) {
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.activation_denied',
      status: 'FAILED',
      action: { jobId, operation: 'activate' },
      result: { error: 'job_not_found' },
    }).catch(() => {});
    throw new Error('Job not found');
  }

  const job = rows[0];

  // Fail-closed: verify checks passed
  const checks = job.eli_config?.checks;
  if (checks && Array.isArray(checks)) {
    const failed = checks.filter((c: any) => c.status === 'FAIL');
    if (failed.length > 0) {
      await createTrustSpineReceipt({
        suiteId,
        receiptType: 'mail.onboarding.activation_denied',
        status: 'FAILED',
        action: { jobId, operation: 'activate' },
        result: { error: 'checks_not_passed', failedChecks: failed.length },
      }).catch(() => {});
      throw new Error(`Cannot activate: ${failed.length} checks failed`);
    }
  }

  try {
    // Update mail_accounts to active
    if (job.mailbox_email) {
      await db.execute(sql`
        UPDATE app.mail_accounts
        SET status = 'active', updated_at = now()
        WHERE suite_id = ${suiteId}::uuid AND email_address = ${job.mailbox_email}
      `);
    }

    await transitionState(jobId, suiteId, 'ACTIVE');

    // YELLOW receipt — mail system activated
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.activated',
      status: 'SUCCEEDED',
      action: { jobId, provider: job.provider, email: '<EMAIL_REDACTED>' },
      result: { state: 'ACTIVE', provider: job.provider },
    });

    return { email: job.mailbox_email || '' };
  } catch (err: any) {
    // Failure receipt — Law #2
    await createTrustSpineReceipt({
      suiteId,
      receiptType: 'mail.onboarding.activation_failed',
      status: 'FAILED',
      action: { jobId, operation: 'activate' },
      result: { error: 'activation_failed' },
    }).catch(() => {});
    throw err;
  }
}

export async function listAccounts(suiteId: string): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT account_id, email_address, display_name, mailbox_provider, status, encrypted_password
    FROM app.mail_accounts
    WHERE suite_id = ${suiteId}::uuid
    ORDER BY created_at DESC
  `);
  const rows = (result.rows || result) as any[];

  // Also check for Google OAuth connection
  const oauthResult = await db.execute(sql`
    SELECT email FROM oauth_tokens
    WHERE suite_id = ${suiteId}::uuid AND provider = 'google'
  `);
  const oauthRows = (oauthResult.rows || oauthResult) as any[];

  const accounts = rows.map((r: any) => ({
    id: r.account_id,
    provider: r.mailbox_provider?.toUpperCase() || 'POLARIS',
    email: r.email_address,
    displayName: r.display_name || r.email_address?.split('@')[0],
    status: r.status?.toUpperCase() === 'ACTIVE' ? 'ACTIVE' : 'SETUP_REQUIRED',
    capabilities: {
      canSend: true,
      canDraft: true,
      canLabels: r.mailbox_provider === 'gmail',
      canJunk: true,
      canThreads: true, // Both Gmail (REST API) and PolarisM (IMAP) support thread loading
      hasImapCredentials: !!r.encrypted_password,
    },
  }));

  // Add Google account if connected
  if (oauthRows.length) {
    const existing = accounts.find((a: any) => a.provider === 'GOOGLE' || a.provider === 'GMAIL');
    if (!existing) {
      accounts.unshift({
        id: 'google-oauth',
        provider: 'GOOGLE',
        email: oauthRows[0].email,
        displayName: oauthRows[0].email?.split('@')[0],
        status: 'ACTIVE',
        capabilities: {
          canSend: true,
          canDraft: true,
          canLabels: true,
          canJunk: true,
          canThreads: true,
          hasImapCredentials: false,
        },
      });
    }
  }

  return accounts;
}

export async function removeAccount(suiteId: string, accountId: string): Promise<{ removed: boolean }> {
  if (!accountId || typeof accountId !== 'string') {
    return { removed: false };
  }

  // Synthetic ID used by listAccounts() for Google OAuth connection.
  if (accountId === 'google-oauth') {
    const result = await db.execute(sql`
      DELETE FROM oauth_tokens
      WHERE suite_id = ${suiteId}::uuid
        AND provider = 'google'
    `);
    const rowCount = (result as any)?.rowCount ?? 0;
    return { removed: rowCount > 0 };
  }

  if (!/^[0-9a-fA-F-]{36}$/.test(accountId)) {
    return { removed: false };
  }

  // Polaris / mail_accounts: soft-delete by marking inactive.
  const result = await db.execute(sql`
    UPDATE app.mail_accounts
    SET status = 'inactive', updated_at = now()
    WHERE suite_id = ${suiteId}::uuid
      AND account_id = ${accountId}::uuid
      AND status <> 'inactive'
  `);
  const rowCount = (result as any)?.rowCount ?? 0;
  return { removed: rowCount > 0 };
}

export async function listMailReceipts(suiteId: string): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT receipt_id, receipt_type, status, action, result, created_at
    FROM receipts
    WHERE suite_id = ${suiteId}::uuid
      AND receipt_type LIKE 'mail.%'
    ORDER BY created_at DESC
    LIMIT 100
  `);
  const rows = (result.rows || result) as any[];
  return rows.map((r: any) => ({
    id: r.receipt_id,
    action: r.receipt_type,
    timestamp: r.created_at,
    status: r.status?.toLowerCase() === 'succeeded' ? 'success' : r.status?.toLowerCase() === 'failed' ? 'failure' : 'pending',
    detail: r.result?.error || r.action?.operation || r.receipt_type,
  }));
}
