import { db } from './db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';
import { logger } from './logger';

export type ReceiptStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'DENIED';
export type ActorType = 'USER' | 'SYSTEM' | 'WORKER';
export type ReceiptActionType = 'ingest_webhook' | 'sync_pull' | 'compute_snapshot' | 'propose_action' | 'execute_action';

export interface TrustSpineReceiptParams {
  suiteId: string;
  officeId?: string;
  receiptType: string;
  status?: ReceiptStatus;
  correlationId?: string;
  actorType?: ActorType;
  actorId?: string;
  action: Record<string, any>;
  result: Record<string, any>;
}

export interface CreateReceiptParams {
  suiteId: string;
  officeId: string;
  actionType: ReceiptActionType;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  policyDecisionId?: string;
  metadata?: Record<string, unknown>;
}

export interface Receipt {
  receiptId: string;
  suiteId: string;
  tenantId: string;
  officeId: string | null;
  receiptType: string;
  status: ReceiptStatus;
  correlationId: string;
  actorType: ActorType;
  actorId: string | null;
  action: Record<string, any>;
  result: Record<string, any>;
  createdAt: Date;
  hashAlg: string;
  receiptHash: string | null;
  signature: string | null;
}

function generateCorrelationId(): string {
  return `corr_${crypto.randomUUID()}`;
}

function generateReceiptId(): string {
  return crypto.randomBytes(16).toString('hex');
}

function rowToReceipt(row: Record<string, unknown>): Receipt {
  return {
    receiptId: row.receipt_id as string,
    suiteId: row.suite_id as string,
    tenantId: row.tenant_id as string,
    officeId: (row.office_id as string | null) || null,
    receiptType: row.receipt_type as string,
    status: row.status as ReceiptStatus,
    correlationId: row.correlation_id as string,
    actorType: row.actor_type as ActorType,
    actorId: (row.actor_id as string | null) || null,
    action: (row.action as Record<string, unknown>) || {},
    result: (row.result as Record<string, unknown>) || {},
    createdAt: new Date(row.created_at as string | number | Date),
    hashAlg: row.hash_alg as string,
    receiptHash: (row.receipt_hash as string | null) || null,
    signature: (row.signature as string | null) || null,
  };
}

/**
 * Creates a Trust Spine 15-column receipt.
 */
export async function createTrustSpineReceipt(params: TrustSpineReceiptParams): Promise<string> {
  try {
    const receiptId = generateReceiptId();
    const correlationId = params.correlationId || generateCorrelationId();
    const status = params.status || 'SUCCEEDED';
    const actorType = params.actorType || 'SYSTEM';

    const tenantResult = await db.execute(sql`SELECT tenant_id FROM app.suites WHERE suite_id = ${params.suiteId}::uuid`);
    const tenantRows = (tenantResult.rows || tenantResult) as Record<string, unknown>[];
    const tenantId = (tenantRows[0]?.tenant_id as string) || 'unknown';

    await db.execute(sql`
      INSERT INTO receipts (receipt_id, suite_id, tenant_id, receipt_type, status, correlation_id, actor_type, actor_id, office_id, action, result)
      VALUES (${receiptId}, ${params.suiteId}::uuid, ${tenantId}, ${params.receiptType}, ${status}, ${correlationId}, ${actorType}, ${params.actorId || null}, ${params.officeId || null}::uuid, ${JSON.stringify(params.action)}::jsonb, ${JSON.stringify(params.result)}::jsonb)
    `);

    logger.info(`Receipt created: ${receiptId} (${params.receiptType}/${status})`);
    return receiptId;
  } catch (error: unknown) {
    logger.error('Failed to create receipt', { error: error instanceof Error ? error.message : 'unknown' });
    throw error;
  }
}

/**
 * Backward-compatible wrapper for existing callers.
 * Maps old { actionType, inputs, outputs, metadata } to Trust Spine format.
 */
export async function createReceipt(params: CreateReceiptParams): Promise<string> {
  return createTrustSpineReceipt({
    suiteId: params.suiteId,
    officeId: params.officeId || undefined,
    receiptType: params.actionType,
    status: 'SUCCEEDED',
    actorType: 'SYSTEM',
    action: { ...params.inputs, policyDecisionId: params.policyDecisionId },
    result: { ...params.outputs, metadata: params.metadata },
  });
}

export async function getReceipt(receiptId: string): Promise<Receipt | null> {
  try {
    const result = await db.execute(sql`
      SELECT receipt_id, suite_id, tenant_id, office_id, receipt_type, status, correlation_id, actor_type, actor_id, action, result, created_at, hash_alg, receipt_hash, signature
      FROM receipts
      WHERE receipt_id = ${receiptId}
    `);
    const rows = result.rows || result;
    if (rows && (rows as Record<string, unknown>[]).length > 0) {
      return rowToReceipt((rows as Record<string, unknown>[])[0]);
    }
    return null;
  } catch (error: unknown) {
    logger.error('Failed to get receipt', { error: error instanceof Error ? error.message : 'unknown' });
    return null;
  }
}

export async function getReceiptsByTenant(suiteId: string, officeId?: string, limit?: number): Promise<Receipt[]> {
  try {
    const queryLimit = limit || 50;
    let result;
    if (officeId) {
      result = await db.execute(sql`
        SELECT receipt_id, suite_id, tenant_id, office_id, receipt_type, status, correlation_id, actor_type, actor_id, action, result, created_at, hash_alg, receipt_hash, signature
        FROM receipts
        WHERE suite_id = ${suiteId}::uuid AND office_id = ${officeId}::uuid
        ORDER BY created_at DESC
        LIMIT ${queryLimit}
      `);
    } else {
      result = await db.execute(sql`
        SELECT receipt_id, suite_id, tenant_id, office_id, receipt_type, status, correlation_id, actor_type, actor_id, action, result, created_at, hash_alg, receipt_hash, signature
        FROM receipts
        WHERE suite_id = ${suiteId}::uuid
        ORDER BY created_at DESC
        LIMIT ${queryLimit}
      `);
    }
    const rows = (result.rows || result) as Record<string, unknown>[];
    return rows.map(rowToReceipt);
  } catch (error: unknown) {
    logger.error('Failed to get receipts by tenant', { error: error instanceof Error ? error.message : 'unknown' });
    return [];
  }
}

export async function verifyReceipt(receiptId: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT receipt_hash, public.trust_compute_receipt_hash(receipt_id) AS computed_hash
      FROM receipts
      WHERE receipt_id = ${receiptId}
    `);
    const rows = result.rows || result;
    if (rows && (rows as Record<string, unknown>[]).length > 0) {
      const row = (rows as Record<string, unknown>[])[0];
      if (!row.receipt_hash) {
        logger.info(`Receipt ${receiptId} has no stored hash yet`);
        return true; // Hash not yet computed
      }
      const valid = Buffer.from(row.receipt_hash as string).equals(Buffer.from(row.computed_hash as string));
      logger.info(`Receipt ${receiptId} verification: ${valid ? 'PASS' : 'FAIL'}`);
      return valid;
    }
    logger.info(`Receipt ${receiptId} not found for verification`);
    return false;
  } catch (error: unknown) {
    logger.error('Failed to verify receipt', { error: error instanceof Error ? error.message : 'unknown' });
    return false;
  }
}
