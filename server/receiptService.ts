import { db } from './db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

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
  inputs: any;
  outputs: any;
  policyDecisionId?: string;
  metadata?: any;
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

function rowToReceipt(row: any): Receipt {
  return {
    receiptId: row.receipt_id,
    suiteId: row.suite_id,
    tenantId: row.tenant_id,
    officeId: row.office_id || null,
    receiptType: row.receipt_type,
    status: row.status,
    correlationId: row.correlation_id,
    actorType: row.actor_type,
    actorId: row.actor_id || null,
    action: row.action || {},
    result: row.result || {},
    createdAt: new Date(row.created_at),
    hashAlg: row.hash_alg,
    receiptHash: row.receipt_hash || null,
    signature: row.signature || null,
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
    const tenantRows = (tenantResult.rows || tenantResult) as any[];
    const tenantId = tenantRows[0]?.tenant_id || 'unknown';

    await db.execute(sql`
      INSERT INTO receipts (receipt_id, suite_id, tenant_id, receipt_type, status, correlation_id, actor_type, actor_id, office_id, action, result)
      VALUES (${receiptId}, ${params.suiteId}::uuid, ${tenantId}, ${params.receiptType}, ${status}, ${correlationId}, ${actorType}, ${params.actorId || null}, ${params.officeId || null}::uuid, ${JSON.stringify(params.action)}::jsonb, ${JSON.stringify(params.result)}::jsonb)
    `);

    console.log(`Receipt created: ${receiptId} (${params.receiptType}/${status})`);
    return receiptId;
  } catch (error: any) {
    console.error('Failed to create receipt:', error.message);
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
    if (rows && (rows as any[]).length > 0) {
      return rowToReceipt((rows as any[])[0]);
    }
    return null;
  } catch (error: any) {
    console.error('Failed to get receipt:', error.message);
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
    const rows = (result.rows || result) as any[];
    return rows.map(rowToReceipt);
  } catch (error: any) {
    console.error('Failed to get receipts by tenant:', error.message);
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
    if (rows && (rows as any[]).length > 0) {
      const row = (rows as any[])[0];
      if (!row.receipt_hash) {
        console.log(`Receipt ${receiptId} has no stored hash yet`);
        return true; // Hash not yet computed
      }
      const valid = Buffer.from(row.receipt_hash).equals(Buffer.from(row.computed_hash));
      console.log(`Receipt ${receiptId} verification: ${valid ? 'PASS' : 'FAIL'}`);
      return valid;
    }
    console.log(`Receipt ${receiptId} not found for verification`);
    return false;
  } catch (error: any) {
    console.error('Failed to verify receipt:', error.message);
    return false;
  }
}
