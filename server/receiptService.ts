import { db } from './db';
import { sql } from 'drizzle-orm';
import crypto from 'crypto';

export type ReceiptActionType = 'ingest_webhook' | 'sync_pull' | 'compute_snapshot' | 'propose_action' | 'execute_action';

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
  officeId: string;
  actionType: string;
  inputsHash: string;
  outputsHash: string;
  policyDecisionId: string | null;
  metadata: any;
  createdAt: Date;
}

function hashContent(content: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
}

function rowToReceipt(row: any): Receipt {
  return {
    receiptId: row.receipt_id,
    suiteId: row.suite_id,
    officeId: row.office_id,
    actionType: row.action_type,
    inputsHash: row.inputs_hash,
    outputsHash: row.outputs_hash,
    policyDecisionId: row.policy_decision_id || null,
    metadata: row.metadata,
    createdAt: new Date(row.created_at),
  };
}

export async function createReceipt(params: CreateReceiptParams): Promise<string> {
  try {
    const inputsHash = hashContent(params.inputs);
    const outputsHash = hashContent(params.outputs);

    const result = await db.execute(sql`
      INSERT INTO receipts (suite_id, office_id, action_type, inputs_hash, outputs_hash, policy_decision_id, metadata)
      VALUES (${params.suiteId}, ${params.officeId}, ${params.actionType}, ${inputsHash}, ${outputsHash}, ${params.policyDecisionId || null}, ${JSON.stringify(params.metadata || {})})
      RETURNING receipt_id
    `);

    const rows = result.rows || result;
    const receiptId = (rows as any)[0].receipt_id;
    console.log(`Receipt created: ${receiptId} (${params.actionType})`);
    return receiptId;
  } catch (error: any) {
    console.error('Failed to create receipt:', error.message);
    throw error;
  }
}

export async function getReceipt(receiptId: string): Promise<Receipt | null> {
  try {
    const result = await db.execute(sql`
      SELECT receipt_id, suite_id, office_id, action_type, inputs_hash, outputs_hash, policy_decision_id, metadata, created_at
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

export async function getReceiptsByTenant(suiteId: string, officeId: string, limit?: number): Promise<Receipt[]> {
  try {
    const queryLimit = limit || 50;
    const result = await db.execute(sql`
      SELECT receipt_id, suite_id, office_id, action_type, inputs_hash, outputs_hash, policy_decision_id, metadata, created_at
      FROM receipts
      WHERE suite_id = ${suiteId} AND office_id = ${officeId}
      ORDER BY created_at DESC
      LIMIT ${queryLimit}
    `);
    const rows = (result.rows || result) as any[];
    return rows.map(rowToReceipt);
  } catch (error: any) {
    console.error('Failed to get receipts by tenant:', error.message);
    return [];
  }
}

export async function verifyReceipt(receiptId: string, inputs: any, outputs: any): Promise<boolean> {
  try {
    const receipt = await getReceipt(receiptId);
    if (!receipt) {
      console.log(`Receipt ${receiptId} not found for verification`);
      return false;
    }

    const inputsHash = hashContent(inputs);
    const outputsHash = hashContent(outputs);

    const valid = receipt.inputsHash === inputsHash && receipt.outputsHash === outputsHash;
    console.log(`Receipt ${receiptId} verification: ${valid ? 'PASS' : 'FAIL'}`);
    return valid;
  } catch (error: any) {
    console.error('Failed to verify receipt:', error.message);
    return false;
  }
}
