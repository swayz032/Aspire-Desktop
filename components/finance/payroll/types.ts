export interface GustoCompensation {
  uuid?: string;
  version?: string;
  rate?: string | number;
  payment_unit?: string;
  flsa_status?: string;
}

export interface GustoJob {
  uuid?: string;
  title?: string;
  rate?: string;
  payment_unit?: string;
  hire_date?: string;
  location_id?: string;
  compensations?: GustoCompensation[];
}

export interface GustoPTO {
  name: string;
  accrued_hours?: number;
  used_hours?: number;
}

export interface GustoEmployee {
  uuid?: string;
  id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  department?: string;
  current_employment_status?: string;
  onboarding_status?: string;
  terminated?: boolean;
  date_of_birth?: string;
  payment_method?: string;
  jobs?: GustoJob[];
  garnishments?: Array<{ description: string; amount: number }>;
  custom_fields?: Array<{ name: string; value: string }>;
  eligible_paid_time_off?: GustoPTO[];
  contractors?: unknown[];
  employees?: unknown[];
}

export interface GustoCompany {
  name?: string;
  trade_name?: string;
  ein?: string;
  entity_type?: string;
}

export interface GustoPayPeriod {
  start_date?: string;
  end_date?: string;
}

export interface GustoPayrollTotals {
  gross_pay?: string;
  net_pay?: string;
  [key: string]: string | undefined;
}

export interface GustoPayroll {
  payroll_uuid?: string;
  uuid?: string;
  id?: string;
  pay_period?: GustoPayPeriod;
  check_date?: string;
  processed?: boolean;
  processed_date?: string;
  payroll_deadline?: string;
  totals?: GustoPayrollTotals;
  employee_compensations?: Array<{
    employee_uuid: string;
    gross_pay: string;
    net_pay: string;
    taxes: Array<{ name: string; amount: string }>;
  }>;
}

export interface GustoTimeOffPolicy {
  uuid?: string;
  id?: string;
  name?: string;
  policy_type?: string;
  accrual_method?: string;
  accrual_rate?: string | number;
  accrual_period?: string;
  max_accrual_hours_per_year?: string | number;
  max_hours?: string | number;
  employees?: Array<{ uuid: string; balance: string }>;
}

export interface GustoTimeOffRequest {
  uuid?: string;
  id?: string;
  employee_uuid?: string;
  employee_name?: string;
  policy_name?: string;
  status?: string;
  request_type?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
}

export interface GustoPaySchedule {
  uuid?: string;
  name?: string;
  frequency?: string;
  active?: boolean;
  auto_pilot?: boolean;
  anchor_pay_date?: string;
  anchor_end_of_pay_period?: string;
  day_1?: string | number;
  day_2?: string | number;
}

export interface GustoDepartment {
  uuid?: string;
  title?: string;
  name?: string;
  employees?: unknown[];
  contractors?: unknown[];
}

export interface GustoLocation {
  uuid?: string;
  street_1?: string;
  street_2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  active?: boolean;
  filing_address?: boolean;
  mailing_address?: boolean;
}

export interface GustoBankAccount {
  uuid?: string;
  name?: string;
  bank_name?: string;
  hidden_account_number?: string;
  account_number?: string;
  routing_number?: string;
  account_type?: string;
  verification_status?: string;
}

export interface GustoFederalTaxDetails {
  legal_name?: string;
  ein?: string;
  ein_verified?: boolean;
  filing_form?: string;
  deposit_schedule?: string;
  tax_payer_type?: string;
  taxable_as_scorp?: boolean;
  version?: string | number;
}

export interface PayrollSubTabProps {
  gustoCompany: GustoCompany | null;
  gustoEmployees: GustoEmployee[];
  gustoConnected: boolean;
}

export interface EditScheduleData {
  frequency: string;
  day_1: string;
  day_2: string;
}

export interface EditLocationData {
  street_1: string;
  street_2: string;
  city: string;
  state: string;
  zip: string;
}
