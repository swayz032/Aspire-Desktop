import { db } from '../db';
import { sql } from 'drizzle-orm';
import { createTrustSpineReceipt } from '../receiptService';
import { getValidToken, getConnectedEmail } from './googleOAuth';
import { listLabels, createLabel, listThreads, createDraft, sendMessage, buildRawMessage } from './gmailClient';

export type CheckId = 'LIST' | 'DRAFT' | 'SEND_TEST' | 'LABEL';
export type CheckStatus = 'NOT_RUN' | 'PASS' | 'FAIL' | 'SKIP';

export interface CheckResult {
  id: CheckId;
  status: CheckStatus;
  message?: string;
}

// ─── Individual checks ───

async function checkList(accessToken: string): Promise<CheckResult> {
  try {
    const result = await listThreads(accessToken, { maxResults: 1 });
    return { id: 'LIST', status: 'PASS', message: `Can list threads (${result.resultSizeEstimate || 0} estimated)` };
  } catch (err: any) {
    return { id: 'LIST', status: 'FAIL', message: 'Cannot list messages' };
  }
}

async function checkDraft(accessToken: string): Promise<CheckResult> {
  try {
    const raw = buildRawMessage({
      to: '',
      subject: '[Aspire Test] Draft Verification',
      body: 'This draft was created by Aspire to verify mailbox access. You can safely delete it.',
    });
    await createDraft(accessToken, raw);
    return { id: 'DRAFT', status: 'PASS', message: 'Successfully created test draft' };
  } catch (err: any) {
    return { id: 'DRAFT', status: 'FAIL', message: 'Cannot create draft' };
  }
}

async function checkSendTest(accessToken: string, email: string): Promise<CheckResult> {
  try {
    const raw = buildRawMessage({
      to: email,
      subject: '[Aspire] Mailbox Verification',
      body: 'This is a test email sent by Aspire to verify your mailbox can send messages. No action needed.',
      from: email,
    });
    await sendMessage(accessToken, raw);
    return { id: 'SEND_TEST', status: 'PASS', message: 'Successfully sent test email to self' };
  } catch (err: any) {
    return { id: 'SEND_TEST', status: 'FAIL', message: 'Cannot send test email' };
  }
}

async function checkLabel(accessToken: string): Promise<CheckResult> {
  try {
    const labels = await listLabels(accessToken);
    const aspireLabel = labels.find((l: any) => l.name === 'Aspire/Managed');

    if (!aspireLabel) {
      await createLabel(accessToken, 'Aspire/Managed');
    }

    return { id: 'LABEL', status: 'PASS', message: 'Aspire/Managed label exists' };
  } catch (err: any) {
    return { id: 'LABEL', status: 'FAIL', message: 'Cannot manage labels' };
  }
}

// ─── Run checks ───

export async function runChecks(
  jobId: string,
  suiteId: string,
  requestedChecks?: string[],
): Promise<CheckResult[]> {
  // Get job to determine provider
  const result = await db.execute(sql`
    SELECT provider, mailbox_email, state FROM app.mail_onboarding_jobs
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const rows = (result.rows || result) as any[];
  if (!rows.length) throw new Error('Onboarding job not found');

  const { provider, mailbox_email } = rows[0];
  const checksToRun: CheckId[] = requestedChecks?.length
    ? requestedChecks as CheckId[]
    : ['LIST', 'DRAFT', 'SEND_TEST', 'LABEL'];

  const checks: CheckResult[] = [];

  if (provider === 'GOOGLE') {
    const accessToken = await getValidToken(suiteId);
    const email = mailbox_email || await getConnectedEmail(suiteId) || '';

    for (const checkId of checksToRun) {
      switch (checkId) {
        case 'LIST':
          checks.push(await checkList(accessToken));
          break;
        case 'DRAFT':
          checks.push(await checkDraft(accessToken));
          break;
        case 'SEND_TEST':
          // YELLOW — external communication
          checks.push(await checkSendTest(accessToken, email));
          break;
        case 'LABEL':
          checks.push(await checkLabel(accessToken));
          break;
      }
    }
  } else {
    // PolarisM — skip Gmail-specific checks, mark as PASS if mailbox exists
    for (const checkId of checksToRun) {
      checks.push({
        id: checkId,
        status: mailbox_email ? 'PASS' : 'SKIP',
        message: mailbox_email ? `Mailbox ${mailbox_email} provisioned` : 'No mailbox provisioned yet',
      });
    }
  }

  // Store checks in eli_config
  const existingConfig = await db.execute(sql`
    SELECT eli_config FROM app.mail_onboarding_jobs WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
  `);
  const configRows = (existingConfig.rows || existingConfig) as any[];
  const currentConfig = configRows[0]?.eli_config || {};

  await db.execute(sql`
    UPDATE app.mail_onboarding_jobs
    SET eli_config = ${JSON.stringify({ ...currentConfig, checks })}::jsonb,
        state = 'CHECKS_RUNNING',
        state_updated_at = now()
    WHERE id = ${jobId}::uuid AND suite_id = ${suiteId}::uuid
      AND state IN ('GOOGLE_OAUTH_COMPLETE', 'MAILBOX_PROVISIONED', 'CHECKS_RUNNING')
  `);

  // Receipt
  const allPassed = checks.every(c => c.status === 'PASS' || c.status === 'SKIP');
  await createTrustSpineReceipt({
    suiteId,
    receiptType: 'mail.checks.completed',
    status: allPassed ? 'SUCCEEDED' : 'FAILED',
    action: { jobId, checksRun: checks.map(c => c.id) },
    result: { checks: checks.map(c => ({ id: c.id, status: c.status })), allPassed },
  });

  return checks;
}
