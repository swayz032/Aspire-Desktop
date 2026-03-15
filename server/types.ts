/**
 * Server Type Definitions — Aspire Desktop
 *
 * Uses Express declaration merging to add authenticated context properties
 * to the Request type, eliminating `(req as any).authenticatedSuiteId` casts.
 */

import { Request } from 'express';

// Augment Express Request with auth context (set by RLS middleware in index.ts)
declare global {
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
      authenticatedSuiteId?: string;
      authenticatedOfficeId?: string;
      authenticatedUserName?: string;
      correlationId?: string;
      traceId?: string;
    }
  }
}

/**
 * Request with authenticated user context (guaranteed by auth middleware).
 * Use for routes behind auth — properties are always present.
 */
export interface AuthenticatedRequest extends Request {
  authenticatedUserId: string;
  authenticatedSuiteId: string;
}

/**
 * Alias for routes that may or may not have auth context.
 */
export type MaybeAuthenticatedRequest = Request;

/**
 * Request with raw body buffer (for webhook signature verification).
 */
export interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

/**
 * Risk tier classification for governance tagging.
 */
export type RiskTier = 'GREEN' | 'YELLOW' | 'RED';

/**
 * Action origin — distinguishes UI-direct actions from orchestrator-routed ones.
 * Used in receipts to track governance path.
 */
export type ActionOrigin = 'ui_direct' | 'orchestrator' | 'n8n_service' | 'webhook';

/**
 * Gusto API response types for common endpoints.
 */
export interface GustoCompany {
  uuid: string;
  name: string;
  trade_name?: string;
  ein?: string;
  entity_type?: string;
  company_status?: string;
  primary_signatory?: { first_name: string; last_name: string; email: string };
  primary_payroll_admin?: { first_name: string; last_name: string; email: string };
  locations?: GustoLocation[];
}

export interface GustoEmployee {
  uuid: string;
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  ssn?: string;
  department?: string;
  terminated?: boolean;
  current_employment_status?: string;
  jobs?: Array<{ title: string; rate: string; payment_unit: string }>;
}

export interface GustoLocation {
  uuid: string;
  street_1: string;
  street_2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  active: boolean;
}

export interface GustoPayroll {
  uuid: string;
  payroll_deadline: string;
  check_date: string;
  processed: boolean;
  calculated_at?: string;
  pay_period: { start_date: string; end_date: string };
  totals?: Record<string, string>;
  employee_compensations?: unknown[];
}

/**
 * QuickBooks Online types for common entities.
 */
export interface QboQueryResponse<T = unknown> {
  QueryResponse: Record<string, T[] | number | undefined> & {
    startPosition?: number;
    maxResults?: number;
    totalCount?: number;
  };
}

export interface QboInvoice {
  Id: string;
  DocNumber?: string;
  TxnDate: string;
  DueDate?: string;
  TotalAmt: number;
  Balance: number;
  CustomerRef: { value: string; name: string };
  Line: Array<{
    DetailType: string;
    Amount: number;
    Description?: string;
    SalesItemLineDetail?: { UnitPrice: number; Qty: number };
  }>;
}

export interface QboCustomer {
  Id: string;
  DisplayName: string;
  CompanyName?: string;
  PrimaryEmailAddr?: { Address: string };
  PrimaryPhone?: { FreeFormNumber: string };
  Balance: number;
  Active: boolean;
}

export interface QboAccount {
  Id: string;
  Name: string;
  AccountType: string;
  AccountSubType?: string;
  CurrentBalance: number;
  Active: boolean;
}

/**
 * Plaid types.
 */
export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name?: string;
  type: string;
  subtype?: string;
  balances: {
    available?: number;
    current?: number;
    limit?: number;
    iso_currency_code?: string;
  };
  mask?: string;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  name: string;
  merchant_name?: string;
  category?: string[];
  pending: boolean;
  iso_currency_code?: string;
}
