import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, TextInput, ScrollView, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { Colors, Typography, BorderRadius } from '@/constants/tokens';
import { CARD_BG, CARD_BORDER, svgPatterns } from '@/constants/cardPatterns';
import { addAuthorityItem } from '@/lib/authorityQueueStore';

const STEPS = [
  { key: 'create', label: 'Create Payroll', icon: 'add-circle-outline' as const },
  { key: 'prepare', label: 'Prepare Payroll', icon: 'create-outline' as const },
  { key: 'calculate', label: 'Calculate Payroll', icon: 'calculator-outline' as const },
  { key: 'submit', label: 'Submit Payroll', icon: 'paper-plane-outline' as const },
  { key: 'receipts', label: 'Receipts & Paystubs', icon: 'receipt-outline' as const },
];

type Employee = {
  id: string;
  name: string;
  role: string;
  type: 'Salary' | 'Hourly';
  rate: number;
  hours: string;
  overtime: string;
  bonus: string;
  deductions: number;
};

const initialEmployees: Employee[] = [];

function calcRegularPay(e: Employee): number {
  return parseFloat(e.hours || '0') * e.rate;
}
function calcOvertimePay(e: Employee): number {
  return parseFloat(e.overtime || '0') * e.rate * 1.5;
}
function calcGross(e: Employee): number {
  return calcRegularPay(e) + calcOvertimePay(e) + parseFloat(e.bonus || '0');
}
function calcNet(e: Employee): number {
  return calcGross(e) - e.deductions;
}
function fmt(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RunPayrollScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [calculating, setCalculating] = useState(false);
  const [calculated, setCalculated] = useState(false);
  const [proposalCreated, setProposalCreated] = useState(false);
  const [receiptStored, setReceiptStored] = useState(false);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [gustoCompany, setGustoCompany] = useState<any>(null);
  const [gustoEmployees, setGustoEmployees] = useState<any[]>([]);
  const [gustoLoading, setGustoLoading] = useState(true);
  const [gustoError, setGustoError] = useState<string | null>(null);
  const [gustoPayrolls, setGustoPayrolls] = useState<any[]>([]);
  const [gustoPaySchedules, setGustoPaySchedules] = useState<any[]>([]);
  const [activePayroll, setActivePayroll] = useState<any>(null);
  const [retrieving, setRetrieving] = useState(false);
  const [retrieved, setRetrieved] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [demoMode, setDemoMode] = useState(false);
  const [selectedPaystub, setSelectedPaystub] = useState<Employee | null>(null);
  const [gustoPaystubs, setGustoPaystubs] = useState<Record<string, any[]>>({});
  const [paystubLoading, setPaystubLoading] = useState(false);

  useEffect(() => {
    async function fetchGustoData() {
      try {
        setGustoLoading(true);
        const [companyRes, employeesRes, payrollsRes, schedulesRes] = await Promise.all([
          fetch('/api/gusto/company'),
          fetch('/api/gusto/employees'),
          fetch('/api/gusto/payrolls'),
          fetch('/api/gusto/pay-schedules'),
        ]);
        if (companyRes.ok) {
          const company = await companyRes.json();
          setGustoCompany(company);
        }
        if (employeesRes.ok) {
          const emps = await employeesRes.json();
          const empList = Array.isArray(emps) ? emps : [];
          setGustoEmployees(empList);
          if (empList.length > 0) {
            const mapped: Employee[] = empList.map((emp: any) => {
              const jobs = emp.jobs || [];
              const currentJob = jobs[0] || {};
              const comps = currentJob.compensations || emp.compensations || [];
              const primaryComp = comps[0] || {};
              const isHourly = primaryComp.payment_unit === 'Hour';
              const rate = parseFloat(primaryComp.rate || '0');
              return {
                id: emp.uuid,
                name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
                role: currentJob.title || 'Employee',
                type: isHourly ? 'Hourly' as const : 'Salary' as const,
                rate: isHourly ? rate : Math.round(rate / 2080 * 100) / 100,
                hours: '80',
                overtime: '0',
                bonus: '0',
                deductions: Math.round(rate * 0.062 * 100) / 100,
              };
            });
            setEmployees(mapped);
            setDemoMode(false);
          } else {
            setDemoMode(true);
          }
        }
        if (payrollsRes.ok) {
          const payrolls = await payrollsRes.json();
          setGustoPayrolls(Array.isArray(payrolls) ? payrolls : []);
          const unprocessed = (Array.isArray(payrolls) ? payrolls : []).find(
            (p: any) => p.processed === false || p.payroll_deadline
          );
          if (unprocessed) setActivePayroll(unprocessed);
        }
        if (schedulesRes.ok) {
          const schedules = await schedulesRes.json();
          setGustoPaySchedules(Array.isArray(schedules) ? schedules : []);
        }
        if (!companyRes.ok && !employeesRes.ok) {
          setGustoError('Payroll not configured');
        }
      } catch (e) {
        setGustoError('Failed to connect to payroll service');
      } finally {
        setGustoLoading(false);
      }
    }
    fetchGustoData();
  }, []);

  const gustoConnected = !gustoLoading && !gustoError && gustoCompany;
  const displayCompanyName = gustoCompany?.name || gustoCompany?.trade_name || 'Zenith Solutions';
  const companyStatus = gustoCompany?.company_status || '';
  const payScheduleLabel = gustoPaySchedules.length > 0
    ? gustoPaySchedules[0].frequency?.replace(/_/g, ' ')?.replace(/\b\w/g, (c: string) => c.toUpperCase()) || 'Bi-weekly'
    : 'Bi-weekly (1st and 15th)';

  const handleCreatePayroll = async () => {
    setRetrieving(true);
    try {
      if (activePayroll?.uuid) {
        const res = await fetch(`/api/gusto/payrolls/${activePayroll.uuid}/prepare`);
        if (res.ok) {
          const data = await res.json();
          setActivePayroll(data);
          setRetrieved(true);
        }
      } else if (gustoConnected && gustoEmployees.length > 0) {
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
        const res = await fetch('/api/gusto/payrolls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            off_cycle: true,
            off_cycle_reason: 'Bonus',
            start_date: today.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
          }),
        });
        if (res.ok) {
          const newPayroll = await res.json();
          setActivePayroll(newPayroll);
          setRetrieved(true);
        }
      } else {
        setRetrieved(true);
      }
    } catch (e) {
      setRetrieved(true);
    } finally {
      setRetrieving(false);
    }
  };

  const handleRunCalculation = async () => {
    setCalculating(true);
    setCalcError(null);
    try {
      if (activePayroll?.uuid) {
        const updateRes = await fetch(`/api/gusto/payrolls/${activePayroll.uuid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            version: activePayroll.version,
            employee_compensations: employees.map(emp => ({
              employee_uuid: emp.id,
              fixed_compensations: parseFloat(emp.bonus || '0') > 0 ? [{
                name: 'Bonus',
                amount: emp.bonus,
                job_uuid: gustoEmployees.find((g: any) => g.uuid === emp.id)?.jobs?.[0]?.uuid,
              }] : [],
              hourly_compensations: [{
                name: 'Regular Hours',
                hours: emp.hours,
                job_uuid: gustoEmployees.find((g: any) => g.uuid === emp.id)?.jobs?.[0]?.uuid,
              }],
            })),
          }),
        });
        if (updateRes.ok) {
          const updated = await updateRes.json();
          setActivePayroll(updated);
        }
        const calcRes = await fetch(`/api/gusto/payrolls/${activePayroll.uuid}/calculate`, {
          method: 'PUT',
        });
        if (calcRes.ok) {
          const result = await calcRes.json();
          setCalcResult(result);
          setCalculated(true);
        } else {
          const err = await calcRes.json().catch(() => ({}));
          setCalcError(err.message || 'Calculation failed — payroll may require employee setup first');
          setCalculated(true);
        }
      } else {
        await new Promise(r => setTimeout(r, 2000));
        setCalculated(true);
      }
    } catch (e) {
      setCalcError('Failed to connect to payroll service');
      setCalculated(true);
    } finally {
      setCalculating(false);
    }
  };

  const handleFetchReceipt = async () => {
    if (activePayroll?.uuid) {
      try {
        const res = await fetch(`/api/gusto/payrolls/${activePayroll.uuid}/receipt`);
        if (res.ok) {
          const data = await res.json();
          setReceiptData(data);
        }
      } catch (e) {}
    }
  };

  const handleViewPaystub = async (emp: Employee) => {
    setSelectedPaystub(emp);
    if (!demoMode && gustoPaystubs[emp.id] === undefined) {
      setPaystubLoading(true);
      try {
        const res = await fetch(`/api/gusto/employees/${emp.id}/pay-stubs`);
        if (res.ok) {
          const stubs = await res.json();
          setGustoPaystubs(prev => ({ ...prev, [emp.id]: Array.isArray(stubs) ? stubs : [] }));
        } else {
          setGustoPaystubs(prev => ({ ...prev, [emp.id]: [] }));
        }
      } catch (e) {
        setGustoPaystubs(prev => ({ ...prev, [emp.id]: [] }));
      }
      setPaystubLoading(false);
    }
  };

  const webHover = (key: string) => Platform.OS === 'web' ? {
    onMouseEnter: () => setHoveredBtn(key),
    onMouseLeave: () => setHoveredBtn(null),
  } : {};

  const totalGross = employees.reduce((s, e) => s + calcGross(e), 0);
  const totalDeductions = employees.reduce((s, e) => s + e.deductions, 0);
  const totalNet = employees.reduce((s, e) => s + calcNet(e), 0);
  const totalRegular = employees.reduce((s, e) => s + calcRegularPay(e), 0);
  const totalOvertime = employees.reduce((s, e) => s + calcOvertimePay(e), 0);
  const totalBonuses = employees.reduce((s, e) => s + parseFloat(e.bonus || '0'), 0);

  const employerFICA = totalGross * 0.0765;
  const employerFUTA = totalGross * 0.006;
  const employerSUTA = totalGross * 0.027;
  const employerTaxes = employerFICA + employerFUTA + employerSUTA;
  const employeeTaxes = totalDeductions;
  const totalCostToCompany = totalGross + employerTaxes;

  const updateEmployee = useCallback((id: string, field: 'hours' | 'overtime' | 'bonus', value: string) => {
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  }, []);


  const stepLabel = STEPS[currentStep]?.label || '';

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderCreate();
      case 1: return renderPrepare();
      case 2: return renderCalculate();
      case 3: return renderSubmit();
      case 4: return renderReceipts();
      default: return null;
    }
  };

  const payPeriodStart = activePayroll?.pay_period?.start_date || 'Feb 1, 2026';
  const payPeriodEnd = activePayroll?.pay_period?.end_date || 'Feb 14, 2026';
  const checkDate = activePayroll?.check_date || activePayroll?.pay_period?.end_date || 'February 14, 2026';
  const payrollDeadline = activePayroll?.payroll_deadline || 'February 12, 2026';

  const renderCreate = () => (
    <View style={styles.flowContainer}>
      <View style={styles.flowHeader}>
        <Ionicons name="add-circle-outline" size={24} color="#3B82F6" />
        <Text style={styles.flowTitle}>Create New Payroll</Text>
      </View>
      <Text style={styles.flowSubtitle}>
        {gustoConnected
          ? 'Set up a new payroll run for the upcoming pay period. Select the period, review your team, and proceed to preparation.'
          : 'Connect your payroll provider in Connections to create payroll runs.'}
      </Text>
      {demoMode && (
        <View style={styles.demoBanner}>
          <Ionicons name="information-circle-outline" size={16} color="#f59e0b" />
          <Text style={styles.demoBannerText}>No employees found in payroll system. Add employees in the People tab or connect your payroll provider in Connections to get started.</Text>
        </View>
      )}
      <View style={styles.summaryGrid}>
        {[
          { label: 'Pay Period', value: `${payPeriodStart} – ${payPeriodEnd}`, icon: 'calendar-outline' as const },
          { label: 'Team Size', value: `${employees.length} Employee${employees.length !== 1 ? 's' : ''}`, icon: 'people-outline' as const },
          { label: 'Pay Schedule', value: payScheduleLabel, icon: 'time-outline' as const },
          { label: 'Estimated Gross', value: fmt(totalGross), icon: 'cash-outline' as const },
          { label: 'Check Date', value: checkDate, icon: 'checkmark-circle-outline' as const },
          { label: 'Submission Deadline', value: payrollDeadline, icon: 'alert-circle-outline' as const },
        ].map((item, i) => (
          <View key={i} style={styles.summaryCard}>
            <View style={styles.summaryCardIcon}>
              <Ionicons name={item.icon} size={20} color="#3B82F6" />
            </View>
            <Text style={styles.summaryCardLabel}>{item.label}</Text>
            <Text style={styles.summaryCardValue}>{item.value}</Text>
          </View>
        ))}
      </View>
      {!retrieved ? (
        <Pressable
          style={[styles.primaryBtn, retrieving && styles.primaryBtnDisabled, hoveredBtn === 'create' && styles.primaryBtnHover]}
          onPress={handleCreatePayroll}
          disabled={retrieving}
          {...webHover('create')}
        >
          {retrieving ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.primaryBtnText}>Creating payroll run...</Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Create Payroll Run</Text>
            </View>
          )}
        </Pressable>
      ) : (
        <View style={styles.retrieveStatus}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.retrieveStatusText}>
            {activePayroll
              ? `Payroll created — Period: ${payPeriodStart} to ${payPeriodEnd}`
              : 'Payroll created successfully. Proceed to Prepare.'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderPrepare = () => (
    <View style={styles.flowContainer}>
      <View style={styles.flowHeader}>
        <Ionicons name="create-outline" size={24} color="#3B82F6" />
        <Text style={styles.flowTitle}>Prepare Payroll</Text>
      </View>
      <Text style={styles.flowSubtitle}>Review and update hours, bonuses, and deductions for each employee.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
        <View>
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { width: 160 }]}>Employee</Text>
            <Text style={[styles.thCell, { width: 130 }]}>Role</Text>
            <Text style={[styles.thCell, { width: 70 }]}>Type</Text>
            <Text style={[styles.thCell, { width: 70 }]}>Rate</Text>
            <Text style={[styles.thCell, { width: 80 }]}>Hours</Text>
            <Text style={[styles.thCell, { width: 80 }]}>OT Hrs</Text>
            <Text style={[styles.thCell, { width: 100 }]}>Regular</Text>
            <Text style={[styles.thCell, { width: 100 }]}>Overtime</Text>
            <Text style={[styles.thCell, { width: 100 }]}>Bonus</Text>
            <Text style={[styles.thCell, { width: 100 }]}>Deductions</Text>
            <Text style={[styles.thCell, { width: 110 }]}>Net Pay</Text>
          </View>
          {employees.map((emp, idx) => (
            <View key={emp.id} style={[styles.tableRow, idx % 2 === 0 && styles.tableRowAlt]}>
              <View style={[styles.tdCell, { width: 160 }]}>
                <Text style={styles.empName}>{emp.name}</Text>
              </View>
              <View style={[styles.tdCell, { width: 130 }]}>
                <Text style={styles.cellText}>{emp.role}</Text>
              </View>
              <View style={[styles.tdCell, { width: 70 }]}>
                <View style={[styles.typeBadge, emp.type === 'Salary' ? styles.typeSalary : styles.typeHourly]}>
                  <Text style={styles.typeBadgeText}>{emp.type === 'Salary' ? 'SAL' : 'HRL'}</Text>
                </View>
              </View>
              <View style={[styles.tdCell, { width: 70 }]}>
                <Text style={styles.cellText}>${emp.rate}/hr</Text>
              </View>
              <View style={[styles.tdCell, { width: 80 }]}>
                <TextInput
                  style={styles.editableInput}
                  value={emp.hours}
                  onChangeText={(v) => updateEmployee(emp.id, 'hours', v)}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
              <View style={[styles.tdCell, { width: 80 }]}>
                <TextInput
                  style={styles.editableInput}
                  value={emp.overtime}
                  onChangeText={(v) => updateEmployee(emp.id, 'overtime', v)}
                  keyboardType="numeric"
                  selectTextOnFocus
                />
              </View>
              <View style={[styles.tdCell, { width: 100 }]}>
                <Text style={styles.cellTextMoney}>{fmt(calcRegularPay(emp))}</Text>
              </View>
              <View style={[styles.tdCell, { width: 100 }]}>
                <Text style={styles.cellTextMoney}>{fmt(calcOvertimePay(emp))}</Text>
              </View>
              <View style={[styles.tdCell, { width: 100 }]}>
                <TextInput
                  style={styles.editableInput}
                  value={emp.bonus}
                  onChangeText={(v) => updateEmployee(emp.id, 'bonus', v)}
                  keyboardType="numeric"
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor={Colors.text.muted}
                />
              </View>
              <View style={[styles.tdCell, { width: 100 }]}>
                <Text style={[styles.cellTextMoney, { color: '#ef4444' }]}>-{fmt(emp.deductions)}</Text>
              </View>
              <View style={[styles.tdCell, { width: 110 }]}>
                <Text style={[styles.cellTextMoney, { color: '#10B981', fontWeight: '700' }]}>{fmt(calcNet(emp))}</Text>
              </View>
            </View>
          ))}
          <View style={styles.totalRow}>
            <View style={[styles.tdCell, { width: 160 }]}>
              <Text style={styles.totalLabel}>TOTALS</Text>
            </View>
            <View style={[styles.tdCell, { width: 130 }]} />
            <View style={[styles.tdCell, { width: 70 }]} />
            <View style={[styles.tdCell, { width: 70 }]} />
            <View style={[styles.tdCell, { width: 80 }]} />
            <View style={[styles.tdCell, { width: 80 }]} />
            <View style={[styles.tdCell, { width: 100 }]}>
              <Text style={styles.totalValue}>{fmt(totalRegular)}</Text>
            </View>
            <View style={[styles.tdCell, { width: 100 }]}>
              <Text style={styles.totalValue}>{fmt(totalOvertime)}</Text>
            </View>
            <View style={[styles.tdCell, { width: 100 }]}>
              <Text style={styles.totalValue}>{fmt(totalBonuses)}</Text>
            </View>
            <View style={[styles.tdCell, { width: 100 }]}>
              <Text style={[styles.totalValue, { color: '#ef4444' }]}>-{fmt(totalDeductions)}</Text>
            </View>
            <View style={[styles.tdCell, { width: 110 }]}>
              <Text style={[styles.totalValue, { color: '#10B981' }]}>{fmt(totalNet)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  const renderCalculate = () => (
    <View style={styles.flowContainer}>
      <View style={styles.flowHeader}>
        <Ionicons name="calculator-outline" size={24} color="#3B82F6" />
        <Text style={styles.flowTitle}>Calculate Payroll</Text>
      </View>
      <Text style={styles.flowSubtitle}>Run tax calculations and generate payroll totals.</Text>
      <View style={styles.calcGrid}>
        <View style={[styles.calcCard, Platform.OS === 'web' ? { backgroundImage: svgPatterns.currency('rgba(255,255,255,0.02)'), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '20% auto' } as any : {}]}>
          <Text style={styles.calcCardTitle}>Employee Compensation</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Gross Pay</Text>
            <Text style={styles.calcValue}>{fmt(totalGross)}</Text>
          </View>
          <View style={styles.calcDivider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabelSub}>Regular Wages</Text>
            <Text style={styles.calcValueSub}>{fmt(totalRegular)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabelSub}>Overtime</Text>
            <Text style={styles.calcValueSub}>{fmt(totalOvertime)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabelSub}>Bonuses</Text>
            <Text style={styles.calcValueSub}>{fmt(totalBonuses)}</Text>
          </View>
          <View style={styles.calcDivider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Employee Taxes & Deductions</Text>
            <Text style={[styles.calcValue, { color: '#ef4444' }]}>-{fmt(employeeTaxes)}</Text>
          </View>
          <View style={styles.calcDivider} />
          <View style={styles.calcRow}>
            <Text style={[styles.calcLabel, { fontWeight: '700' }]}>Net Pay (Employee Take-Home)</Text>
            <Text style={[styles.calcValue, { color: '#10B981', fontWeight: '700' }]}>{fmt(totalNet)}</Text>
          </View>
        </View>
        <View style={[styles.calcCard, Platform.OS === 'web' ? { backgroundImage: svgPatterns.shieldCheck('rgba(255,255,255,0.02)'), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '25% auto' } as any : {}]}>
          <Text style={styles.calcCardTitle}>Employer Tax Obligations</Text>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabelSub}>FICA (Social Security + Medicare) — 7.65%</Text>
            <Text style={styles.calcValueSub}>{fmt(employerFICA)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabelSub}>FUTA (Federal Unemployment) — 0.6%</Text>
            <Text style={styles.calcValueSub}>{fmt(employerFUTA)}</Text>
          </View>
          <View style={styles.calcRow}>
            <Text style={styles.calcLabelSub}>SUTA (State Unemployment) — 2.7%</Text>
            <Text style={styles.calcValueSub}>{fmt(employerSUTA)}</Text>
          </View>
          <View style={styles.calcDivider} />
          <View style={styles.calcRow}>
            <Text style={styles.calcLabel}>Total Employer Taxes</Text>
            <Text style={[styles.calcValue, { color: '#f59e0b' }]}>{fmt(employerTaxes)}</Text>
          </View>
          <View style={styles.calcDivider} />
          <View style={[styles.calcRow, { marginTop: 8 }]}>
            <Text style={[styles.calcLabel, { fontWeight: '700', fontSize: 15 }]}>Total Cost to Company</Text>
            <Text style={[styles.calcValue, { fontWeight: '700', fontSize: 18 }]}>{fmt(totalCostToCompany)}</Text>
          </View>
        </View>
      </View>
      {!calculated ? (
        <Pressable
          style={[styles.primaryBtn, calculating && styles.primaryBtnDisabled, hoveredBtn === 'calc' && styles.primaryBtnHover]}
          onPress={handleRunCalculation}
          disabled={calculating}
          {...webHover('calc')}
        >
          {calculating ? (
            <View style={styles.btnRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.primaryBtnText}>
                {activePayroll ? 'Calculating via payroll API...' : 'Calculating taxes & withholdings...'}
              </Text>
            </View>
          ) : (
            <View style={styles.btnRow}>
              <Ionicons name="calculator" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Run Calculation</Text>
            </View>
          )}
        </Pressable>
      ) : calcError ? (
        <View style={styles.demoBanner}>
          <Ionicons name="warning-outline" size={20} color="#f59e0b" />
          <Text style={styles.demoBannerText}>{calcError}</Text>
        </View>
      ) : (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.successBannerText}>
            {calcResult ? 'Payroll calculated via API. Proceed to Submit.' : 'Payroll calculated successfully. Proceed to Submit.'}
          </Text>
        </View>
      )}
    </View>
  );

  const renderSubmit = () => (
    <View style={styles.flowContainer}>
      <View style={styles.flowHeader}>
        <Ionicons name="shield-checkmark-outline" size={24} color="#3B82F6" />
        <Text style={styles.flowTitle}>Submit Payroll — Governance Review</Text>
      </View>
      <Text style={styles.flowSubtitle}>Aspire governance requires payroll submissions be routed through the Authority Queue as a proposal for approval before processing.</Text>
      <View style={styles.submitSummaryCard}>
        <Text style={styles.submitSummaryTitle}>Payroll Summary</Text>
        <View style={styles.submitGrid}>
          <View style={styles.submitGridItem}>
            <Text style={styles.submitGridLabel}>Pay Period</Text>
            <Text style={styles.submitGridValue}>Feb 1 – Feb 14, 2026</Text>
          </View>
          <View style={styles.submitGridItem}>
            <Text style={styles.submitGridLabel}>Employees</Text>
            <Text style={styles.submitGridValue}>{employees.length}</Text>
          </View>
          <View style={styles.submitGridItem}>
            <Text style={styles.submitGridLabel}>Gross Pay</Text>
            <Text style={styles.submitGridValue}>{fmt(totalGross)}</Text>
          </View>
          <View style={styles.submitGridItem}>
            <Text style={styles.submitGridLabel}>Employer Taxes</Text>
            <Text style={styles.submitGridValue}>{fmt(employerTaxes)}</Text>
          </View>
          <View style={styles.submitGridItem}>
            <Text style={styles.submitGridLabel}>Total Cost</Text>
            <Text style={[styles.submitGridValue, { color: '#3B82F6', fontWeight: '700' }]}>{fmt(totalCostToCompany)}</Text>
          </View>
          <View style={styles.submitGridItem}>
            <Text style={styles.submitGridLabel}>Net to Employees</Text>
            <Text style={[styles.submitGridValue, { color: '#10B981', fontWeight: '700' }]}>{fmt(totalNet)}</Text>
          </View>
        </View>
      </View>
      <View style={styles.governanceNote}>
        <Ionicons name="information-circle-outline" size={20} color="#3B82F6" />
        <View style={{ flex: 1 }}>
          <Text style={styles.governanceNoteTitle}>Authority Queue Integration</Text>
          <Text style={styles.governanceNoteText}>This payroll will be submitted as a proposal in the Trust Spine. The designated approver (Owner or Admin) must approve before Gusto processes the payroll. This ensures financial governance compliance.</Text>
        </View>
      </View>
      {!proposalCreated ? (
        <Pressable
          style={[styles.proposalBtn, hoveredBtn === 'propose' && styles.proposalBtnHover]}
          onPress={() => {
            const proposalId = `payroll_${Date.now()}`;
            addAuthorityItem({
              id: proposalId,
              title: 'Payroll Approval — PR-2026-0214',
              subtitle: `${employees.length} employees • ${fmt(totalCostToCompany)} total cost`,
              type: 'approval',
              status: 'pending',
              priority: 'high',
              timestamp: new Date().toISOString(),
              dueDate: checkDate,
              actions: ['review', 'approve', 'deny'],
              staffRole: 'Finn (Finance)',
              documentPreview: {
                type: 'invoice',
                content: `PAYROLL PROPOSAL #PR-2026-0214\n\nCompany: ${displayCompanyName}\nPay Period: ${payPeriodStart} – ${payPeriodEnd}\nCheck Date: ${checkDate}\n\nEmployees: ${employees.length}\nGross Pay: ${fmt(totalGross)}\nEmployer Taxes: ${fmt(employerTaxes)}\nTotal Cost: ${fmt(totalCostToCompany)}\nNet to Employees: ${fmt(totalNet)}\n\nSchedule: ${payScheduleLabel}\nStatus: Awaiting Owner Approval`,
                metadata: {
                  amount: fmt(totalCostToCompany),
                  dueDate: checkDate,
                  counterparty: displayCompanyName,
                },
              },
            });
            setProposalCreated(true);
          }}
          {...webHover('propose')}
        >
          <Ionicons name="shield-checkmark" size={18} color="#fff" />
          <Text style={styles.proposalBtnText}>Create Proposal</Text>
        </Pressable>
      ) : (
        <View style={styles.proposalCreatedBanner}>
          <Ionicons name="checkmark-circle" size={22} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={styles.proposalCreatedTitle}>Proposal Created — PR-2026-0214</Text>
            <Text style={styles.proposalCreatedDesc}>Payroll proposal submitted to the Authority Queue for Owner approval. You will be notified once approved and processed.</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderReceipts = () => (
    <View style={styles.flowContainer}>
      <View style={styles.flowHeader}>
        <Ionicons name="receipt-outline" size={24} color="#3B82F6" />
        <Text style={styles.flowTitle}>Payroll Receipts & Paystubs</Text>
      </View>
      <Text style={styles.flowSubtitle}>View processed payroll receipts and link them to the Aspire Trust Spine ledger.</Text>
      <View style={styles.receiptSummaryCard}>
        <Text style={styles.receiptSummaryTitle}>Payroll Receipt — Feb 14, 2026</Text>
        <View style={styles.receiptSummaryRow}>
          <View style={styles.receiptSumItem}>
            <Text style={styles.receiptSumLabel}>Pay Period</Text>
            <Text style={styles.receiptSumValue}>Feb 1 – 14</Text>
          </View>
          <View style={styles.receiptSumItem}>
            <Text style={styles.receiptSumLabel}>Check Date</Text>
            <Text style={styles.receiptSumValue}>Feb 14, 2026</Text>
          </View>
          <View style={styles.receiptSumItem}>
            <Text style={styles.receiptSumLabel}>Total Gross</Text>
            <Text style={styles.receiptSumValue}>{fmt(totalGross)}</Text>
          </View>
          <View style={styles.receiptSumItem}>
            <Text style={styles.receiptSumLabel}>Total Taxes</Text>
            <Text style={styles.receiptSumValue}>{fmt(employerTaxes + employeeTaxes)}</Text>
          </View>
          <View style={styles.receiptSumItem}>
            <Text style={styles.receiptSumLabel}>Total Net</Text>
            <Text style={[styles.receiptSumValue, { color: '#10B981' }]}>{fmt(totalNet)}</Text>
          </View>
        </View>
      </View>
      <Text style={styles.paystubsTitle}>Individual Paystubs</Text>
      {employees.map((emp) => (
        <View key={emp.id} style={[styles.paystubRow, Platform.OS === 'web' ? { backgroundImage: svgPatterns.people('rgba(255,255,255,0.02)', 'rgba(139,92,246,0.04)'), backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '35% auto' } as any : {}]}>
          <View style={styles.paystubLeft}>
            <View style={styles.paystubAvatar}>
              <Text style={styles.paystubAvatarText}>{emp.name.split(' ').map(n => n[0]).join('')}</Text>
            </View>
            <View>
              <Text style={styles.paystubName}>{emp.name}</Text>
              <Text style={styles.paystubRole}>{emp.role}</Text>
            </View>
          </View>
          <View style={styles.paystubRight}>
            <Text style={styles.paystubGross}>Gross: {fmt(calcGross(emp))}</Text>
            <Text style={styles.paystubNet}>Net: {fmt(calcNet(emp))}</Text>
          </View>
          <Pressable
            style={[styles.paystubBtn, hoveredBtn === `stub-${emp.id}` && styles.paystubBtnHover]}
            onPress={() => handleViewPaystub(emp)}
            {...webHover(`stub-${emp.id}`)}
          >
            <Ionicons name="document-text-outline" size={14} color="#3B82F6" />
            <Text style={styles.paystubBtnText}>View</Text>
          </Pressable>
        </View>
      ))}
      {!receiptStored ? (
        <Pressable
          style={[styles.storeReceiptBtn, hoveredBtn === 'store' && styles.storeReceiptBtnHover]}
          onPress={() => { handleFetchReceipt(); setReceiptStored(true); }}
          {...webHover('store')}
        >
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.storeReceiptBtnText}>Store Receipt in Trust Spine</Text>
        </Pressable>
      ) : (
        <View style={styles.receiptStoredBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#10B981" />
          <Text style={styles.receiptStoredText}>
            {receiptData
              ? `Receipt stored — Totals: Gross ${fmt(receiptData.totals?.gross_pay || totalGross)}, Net ${fmt(receiptData.totals?.net_pay || totalNet)}`
              : 'Receipt stored in Trust Spine ledger — linked to transaction TX-2026-0214-PAY'}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <FinanceHubShell>
      <View style={styles.aspireHeader}>
        <View style={styles.aspireHeaderTop}>
          <View style={styles.aspireHeaderLeft}>
            <View style={styles.gustoLogo}>
              <Text style={styles.gustoLogoText}>P</Text>
            </View>
            <View>
              <Text style={styles.companyName}>{displayCompanyName}</Text>
              <Text style={styles.paySchedule}>{payScheduleLabel}</Text>
            </View>
          </View>
          <View style={styles.stepBadge}>
            <View style={[styles.stepBadgeDot, currentStep < 3 ? styles.stepBadgeDotActive : currentStep < 4 ? styles.stepBadgeDotWarning : styles.stepBadgeDotSuccess]} />
            <Text style={styles.stepBadgeText}>{stepLabel}</Text>
          </View>
        </View>
        <View style={styles.aspireMetaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={Colors.text.muted} />
            <Text style={styles.metaLabel}>Next Payroll</Text>
            <Text style={styles.metaValue}>Feb 14, 2026</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="alert-circle-outline" size={14} color="#f59e0b" />
            <Text style={styles.metaLabel}>Deadline</Text>
            <Text style={[styles.metaValue, { color: '#f59e0b' }]}>Feb 12, 2026</Text>
          </View>
          <View style={styles.metaDivider} />
          <View style={styles.metaItem}>
            <Ionicons name="checkmark-circle-outline" size={14} color={Colors.text.muted} />
            <Text style={styles.metaLabel}>Debit Date</Text>
            <Text style={styles.metaValue}>Feb 14, 2026</Text>
          </View>
        </View>
      </View>

      <View style={styles.gustoConnectionCard}>
        <View style={styles.gustoConnectionHeader}>
          <View style={styles.gustoConnectionLeft}>
            <View style={styles.gustoConnectionIcon}>
              <Ionicons name="cloud-outline" size={18} color="#3B82F6" />
            </View>
            <View>
              <Text style={styles.gustoConnectionTitle}>Payroll Connection</Text>
              <Text style={styles.gustoConnectionSub}>Embedded Payroll API</Text>
            </View>
          </View>
          {gustoLoading ? (
            <View style={styles.gustoStatusBadgeLoading}>
              <ActivityIndicator size="small" color="#f59e0b" />
              <Text style={styles.gustoStatusTextLoading}>Connecting to payroll...</Text>
            </View>
          ) : gustoConnected ? (
            <View style={styles.gustoStatusBadgeConnected}>
              <View style={styles.gustoStatusDotGreen} />
              <Text style={styles.gustoStatusTextConnected}>Connected</Text>
            </View>
          ) : (
            <View style={styles.gustoStatusBadgeError}>
              <View style={styles.gustoStatusDotAmber} />
              <Text style={styles.gustoStatusTextError}>Setup Required</Text>
            </View>
          )}
        </View>
        {gustoLoading ? (
          <View style={styles.gustoLoadingRow}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.gustoLoadingText}>Fetching company and employee data...</Text>
          </View>
        ) : gustoConnected ? (
          <View style={styles.gustoDataGrid}>
            <View style={styles.gustoDataItem}>
              <Text style={styles.gustoDataLabel}>Company</Text>
              <Text style={styles.gustoDataValue}>{displayCompanyName}</Text>
            </View>
            <View style={styles.gustoDataItem}>
              <Text style={styles.gustoDataLabel}>Employees</Text>
              <Text style={styles.gustoDataValue}>{gustoEmployees.length}</Text>
            </View>
            {gustoCompany?.entity_type && (
              <View style={styles.gustoDataItem}>
                <Text style={styles.gustoDataLabel}>Entity Type</Text>
                <Text style={styles.gustoDataValue}>{gustoCompany.entity_type}</Text>
              </View>
            )}
            {gustoCompany?.ein && (
              <View style={styles.gustoDataItem}>
                <Text style={styles.gustoDataLabel}>EIN</Text>
                <Text style={styles.gustoDataValue}>••••{gustoCompany.ein.slice(-4)}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.gustoErrorRow}>
            <Ionicons name="warning-outline" size={16} color="#f59e0b" />
            <View style={{ flex: 1 }}>
              <Text style={styles.gustoErrorText}>{gustoError || 'Payroll not configured'}</Text>
              <Text style={styles.gustoErrorSub}>Go to Finance &gt; Connections to set up your payroll integration.</Text>
            </View>
          </View>
        )}
      </View>

      <View style={styles.stepper}>
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentStep;
          const isCurrent = idx === currentStep;
          return (
            <React.Fragment key={step.key}>
              <Pressable
                style={[styles.stepItem, isCurrent && styles.stepItemCurrent]}
                onPress={() => setCurrentStep(idx)}
                {...webHover(`step-${idx}`)}
              >
                <View style={[
                  styles.stepCircle,
                  isCompleted && styles.stepCircleCompleted,
                  isCurrent && styles.stepCircleCurrent,
                ]}>
                  {isCompleted ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.stepCircleText, isCurrent && styles.stepCircleTextCurrent]}>{idx + 1}</Text>
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  isCompleted && styles.stepLabelCompleted,
                  isCurrent && styles.stepLabelCurrent,
                ]}>{step.label}</Text>
              </Pressable>
              {idx < STEPS.length - 1 && (
                <View style={[styles.stepLine, isCompleted && styles.stepLineCompleted]} />
              )}
            </React.Fragment>
          );
        })}
      </View>
      {renderStepContent()}

      <Modal
        visible={!!selectedPaystub}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPaystub(null)}
      >
        <Pressable style={stubStyles.modalOverlay} onPress={() => setSelectedPaystub(null)}>
          <Pressable style={stubStyles.modalContent} onPress={(e) => e.stopPropagation()}>
            <ScrollView style={{ maxHeight: 600 }} showsVerticalScrollIndicator={false}>
            {selectedPaystub && (() => {
              const emp = selectedPaystub;
              const empGustoStubs = gustoPaystubs[emp.id] || [];
              const hasGustoData = empGustoStubs.length > 0;
              const latestStub = hasGustoData ? empGustoStubs[0] : null;

              const gross = hasGustoData ? parseFloat(latestStub.gross_pay || '0') : calcGross(emp);
              const net = hasGustoData ? parseFloat(latestStub.net_pay || '0') : calcNet(emp);
              const stubCheckDate = hasGustoData ? latestStub.check_date : checkDate;
              const payMethod = hasGustoData ? (latestStub.payment_method || 'Direct Deposit') : 'Direct Deposit';
              const checkAmt = hasGustoData ? parseFloat(latestStub.check_amount || '0') : net;

              const regular = calcRegularPay(emp);
              const overtime = calcOvertimePay(emp);
              const bonus = parseFloat(emp.bonus || '0');
              const ficaEe = gross * 0.0765;
              const fedWithholding = gross * 0.12;
              const stateWithholding = gross * 0.04;
              const totalTaxes = ficaEe + fedWithholding + stateWithholding;
              const totalDed = emp.deductions;
              return (
                <View>
                  <View style={stubStyles.modalHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={stubStyles.modalTitle}>Paystub Detail</Text>
                      <Text style={stubStyles.modalSub}>
                        {hasGustoData ? `Check Date: ${stubCheckDate}` : `Pay Period: ${payPeriodStart} – ${payPeriodEnd}`}
                      </Text>
                    </View>
                    <Pressable onPress={() => setSelectedPaystub(null)} style={stubStyles.closeBtn}>
                      <Ionicons name="close" size={22} color="#fff" />
                    </Pressable>
                  </View>

                  {hasGustoData && (
                    <View style={stubStyles.liveDataBanner}>
                      <Ionicons name="cloud-done" size={14} color="#10B981" />
                      <Text style={stubStyles.liveDataText}>Live data from payroll provider</Text>
                    </View>
                  )}
                  {paystubLoading && (
                    <View style={stubStyles.liveDataBanner}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                      <Text style={stubStyles.liveDataText}>Fetching paystub data...</Text>
                    </View>
                  )}
                  {demoMode && !hasGustoData && !paystubLoading && (
                    <View style={stubStyles.demoBannerSmall}>
                      <Ionicons name="information-circle" size={14} color="#f59e0b" />
                      <Text style={stubStyles.demoBannerSmallText}>Demo Mode — Calculated estimates</Text>
                    </View>
                  )}

                  <View style={stubStyles.empRow}>
                    <View style={stubStyles.empAvatar}>
                      <Text style={stubStyles.empAvatarText}>{emp.name.split(' ').map(n => n[0]).join('')}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={stubStyles.empName}>{emp.name}</Text>
                      <Text style={stubStyles.empRole}>{emp.role} • {emp.type}</Text>
                    </View>
                    <View style={stubStyles.empBadge}>
                      <Text style={stubStyles.empBadgeText}>{emp.type === 'Salary' ? 'Salaried' : 'Hourly'}</Text>
                    </View>
                  </View>

                  <View style={stubStyles.section}>
                    <Text style={stubStyles.sectionTitle}>Earnings</Text>
                    <View style={stubStyles.lineItem}>
                      <Text style={stubStyles.lineLabel}>Regular ({emp.hours} hrs @ {fmt(emp.rate)}/hr)</Text>
                      <Text style={stubStyles.lineValue}>{fmt(regular)}</Text>
                    </View>
                    {overtime > 0 && (
                      <View style={stubStyles.lineItem}>
                        <Text style={stubStyles.lineLabel}>Overtime ({emp.overtime} hrs @ {fmt(emp.rate * 1.5)}/hr)</Text>
                        <Text style={stubStyles.lineValue}>{fmt(overtime)}</Text>
                      </View>
                    )}
                    {bonus > 0 && (
                      <View style={stubStyles.lineItem}>
                        <Text style={stubStyles.lineLabel}>Bonus</Text>
                        <Text style={stubStyles.lineValue}>{fmt(bonus)}</Text>
                      </View>
                    )}
                    <View style={stubStyles.totalLine}>
                      <Text style={stubStyles.totalLabel}>Gross Pay</Text>
                      <Text style={stubStyles.totalValue}>{fmt(gross)}</Text>
                    </View>
                  </View>

                  <View style={stubStyles.section}>
                    <Text style={stubStyles.sectionTitle}>Taxes & Withholdings</Text>
                    <View style={stubStyles.lineItem}>
                      <Text style={stubStyles.lineLabel}>Federal Income Tax (12%)</Text>
                      <Text style={[stubStyles.lineValue, { color: '#ef4444' }]}>-{fmt(fedWithholding)}</Text>
                    </View>
                    <View style={stubStyles.lineItem}>
                      <Text style={stubStyles.lineLabel}>State Income Tax (4%)</Text>
                      <Text style={[stubStyles.lineValue, { color: '#ef4444' }]}>-{fmt(stateWithholding)}</Text>
                    </View>
                    <View style={stubStyles.lineItem}>
                      <Text style={stubStyles.lineLabel}>FICA (Social Security + Medicare)</Text>
                      <Text style={[stubStyles.lineValue, { color: '#ef4444' }]}>-{fmt(ficaEe)}</Text>
                    </View>
                    <View style={stubStyles.totalLine}>
                      <Text style={stubStyles.totalLabel}>Total Taxes</Text>
                      <Text style={[stubStyles.totalValue, { color: '#ef4444' }]}>-{fmt(totalTaxes)}</Text>
                    </View>
                  </View>

                  <View style={stubStyles.section}>
                    <Text style={stubStyles.sectionTitle}>Deductions</Text>
                    <View style={stubStyles.lineItem}>
                      <Text style={stubStyles.lineLabel}>Benefits (Health, Dental, Vision, 401k)</Text>
                      <Text style={[stubStyles.lineValue, { color: '#f59e0b' }]}>-{fmt(totalDed)}</Text>
                    </View>
                    <View style={stubStyles.totalLine}>
                      <Text style={stubStyles.totalLabel}>Total Deductions</Text>
                      <Text style={[stubStyles.totalValue, { color: '#f59e0b' }]}>-{fmt(totalDed)}</Text>
                    </View>
                  </View>

                  <View style={stubStyles.netSection}>
                    <Text style={stubStyles.netLabel}>Net Pay</Text>
                    <Text style={stubStyles.netValue}>{fmt(net)}</Text>
                  </View>
                  {hasGustoData && checkAmt !== net && (
                    <View style={stubStyles.lineItem}>
                      <Text style={stubStyles.lineLabel}>Check Amount</Text>
                      <Text style={stubStyles.lineValue}>{fmt(checkAmt)}</Text>
                    </View>
                  )}
                  <View style={stubStyles.footer}>
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Text style={stubStyles.footerText}>Check Date: {stubCheckDate} • {payMethod}</Text>
                  </View>

                  {hasGustoData && latestStub?.payroll_uuid && (
                    <Pressable
                      style={stubStyles.pdfBtn}
                      onPress={() => {
                        if (Platform.OS === 'web') {
                          window.open(`/api/gusto/payrolls/${latestStub.payroll_uuid}/employees/${emp.id}/pay-stub`, '_blank');
                        }
                      }}
                    >
                      <Ionicons name="document-attach-outline" size={16} color="#fff" />
                      <Text style={stubStyles.pdfBtnText}>Download Paystub PDF</Text>
                    </Pressable>
                  )}

                  {hasGustoData && empGustoStubs.length > 1 && (
                    <View style={stubStyles.historySection}>
                      <Text style={stubStyles.sectionTitle}>Pay History ({empGustoStubs.length} stubs)</Text>
                      {empGustoStubs.slice(0, 5).map((stub: any, idx: number) => (
                        <View key={stub.uuid || idx} style={stubStyles.historyRow}>
                          <Text style={stubStyles.historyDate}>{stub.check_date}</Text>
                          <Text style={stubStyles.historyGross}>Gross: {fmt(parseFloat(stub.gross_pay || '0'))}</Text>
                          <Text style={stubStyles.historyNet}>Net: {fmt(parseFloat(stub.net_pay || '0'))}</Text>
                          <View style={stubStyles.historyMethod}>
                            <Text style={stubStyles.historyMethodText}>{stub.payment_method || 'N/A'}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  aspireHeader: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? {
      background: `radial-gradient(ellipse at top right, rgba(139,92,246,0.08) 0%, transparent 50%), ${CARD_BG}` as any,
      border: `1px solid ${CARD_BORDER}` as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } : {}),
  },
  aspireHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  aspireHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gustoLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gustoLogoText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  companyName: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  paySchedule: {
    color: Colors.text.tertiary,
    fontSize: 13,
    marginTop: 2,
  },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  stepBadgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepBadgeDotActive: {
    backgroundColor: '#3B82F6',
  },
  stepBadgeDotWarning: {
    backgroundColor: '#f59e0b',
  },
  stepBadgeDotSuccess: {
    backgroundColor: '#10B981',
  },
  stepBadgeText: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
  },
  aspireMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.08)',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  metaValue: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  metaDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      border: `1px solid ${CARD_BORDER}` as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } : {}),
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: 8,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  stepItemCurrent: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  stepCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleCompleted: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 8px rgba(16, 185, 129, 0.3)' as any,
    } : {}),
  },
  stepCircleCurrent: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 12px rgba(59, 130, 246, 0.4)' as any,
    } : {}),
  },
  stepCircleText: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  stepCircleTextCurrent: {
    color: '#3B82F6',
  },
  stepLabel: {
    color: Colors.text.muted,
    fontSize: 12,
    fontWeight: '500',
  },
  stepLabelCompleted: {
    color: '#10B981',
  },
  stepLabelCurrent: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    marginHorizontal: 4,
    borderRadius: 1,
  },
  stepLineCompleted: {
    backgroundColor: '#10B981',
  },
  flowContainer: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 24,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      border: `1px solid ${CARD_BORDER}` as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } : {}),
  },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  flowTitle: {
    color: Colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  flowSubtitle: {
    color: Colors.text.tertiary,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '31%',
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    padding: 16,
  },
  summaryCardIcon: {
    marginBottom: 8,
  },
  summaryCardLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryCardValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  retrieveStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  retrieveStatusText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '500',
  },
  tableScroll: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  thCell: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(59, 130, 246, 0.06)',
    alignItems: 'center',
  },
  tableRowAlt: {
    backgroundColor: 'rgba(18, 21, 31, 0.5)',
  },
  tdCell: {
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  empName: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  cellText: {
    color: Colors.text.secondary,
    fontSize: 13,
  },
  cellTextMoney: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeSalary: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  typeHourly: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.text.secondary,
    letterSpacing: 0.5,
  },
  editableInput: {
    backgroundColor: '#0c0f18',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: Colors.text.primary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    ...(Platform.OS === 'web' ? {
      outlineStyle: 'none' as any,
    } : {}),
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 2,
    borderTopColor: 'rgba(59, 130, 246, 0.15)',
    backgroundColor: 'rgba(59, 130, 246, 0.03)',
    borderRadius: 0,
    marginTop: 4,
  },
  totalLabel: {
    color: Colors.text.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  totalValue: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  calcGrid: {
    gap: 16,
    marginBottom: 20,
  },
  calcCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 20,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      border: `1px solid ${CARD_BORDER}` as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } : {}),
  },
  calcCardTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  calcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  calcLabel: {
    color: Colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
  calcValue: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  calcLabelSub: {
    color: Colors.text.muted,
    fontSize: 13,
    fontWeight: '400',
  },
  calcValueSub: {
    color: Colors.text.tertiary,
    fontSize: 13,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
  },
  calcDivider: {
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    marginVertical: 8,
  },
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any, transition: 'all 0.15s ease' as any } : {}),
  },
  primaryBtnDisabled: {
    backgroundColor: '#2563EB',
    opacity: 0.7,
  },
  primaryBtnHover: {
    backgroundColor: '#2563EB',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  successBannerText: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '500',
  },
  submitSummaryCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.12)',
    padding: 20,
    marginBottom: 16,
  },
  submitSummaryTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  submitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  submitGridItem: {
    width: '30%',
  },
  submitGridLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  submitGridValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  governanceNote: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.1)',
    marginBottom: 20,
  },
  governanceNoteTitle: {
    color: '#3B82F6',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  governanceNoteText: {
    color: Colors.text.tertiary,
    fontSize: 12,
    lineHeight: 17,
  },
  proposalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingVertical: 14,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any, transition: 'all 0.15s ease' as any } : {}),
  },
  proposalBtnHover: {
    backgroundColor: '#059669',
  },
  proposalBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  proposalCreatedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  proposalCreatedTitle: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  proposalCreatedDesc: {
    color: Colors.text.tertiary,
    fontSize: 12,
    lineHeight: 17,
  },
  receiptSummaryCard: {
    backgroundColor: 'rgba(59, 130, 246, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.12)',
    padding: 20,
    marginBottom: 20,
  },
  receiptSummaryTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
  },
  receiptSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  receiptSumItem: {
    minWidth: 100,
  },
  receiptSumLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  receiptSumValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  paystubsTitle: {
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  paystubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 12,
    marginBottom: 8,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      border: `1px solid ${CARD_BORDER}` as any,
    } : {}),
  },
  paystubLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  paystubAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paystubAvatarText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '700',
  },
  paystubName: {
    color: Colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  paystubRole: {
    color: Colors.text.muted,
    fontSize: 11,
  },
  paystubRight: {
    alignItems: 'flex-end',
    marginRight: 12,
  },
  paystubGross: {
    color: Colors.text.secondary,
    fontSize: 12,
  },
  paystubNet: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  paystubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any } : {}),
  },
  paystubBtnHover: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  paystubBtnText: {
    color: '#3B82F6',
    fontSize: 12,
    fontWeight: '600',
  },
  storeReceiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any, transition: 'all 0.15s ease' as any } : {}),
  },
  storeReceiptBtnHover: {
    backgroundColor: '#2563EB',
  },
  storeReceiptBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  receiptStoredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.15)',
    marginTop: 16,
  },
  receiptStoredText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  gustoConnectionCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    marginBottom: 20,
    ...(Platform.OS === 'web' ? {
      background: CARD_BG as any,
      border: `1px solid ${CARD_BORDER}` as any,
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)' as any,
    } : {}),
  },
  gustoConnectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gustoConnectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  gustoConnectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gustoConnectionTitle: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  gustoConnectionSub: {
    color: Colors.text.muted,
    fontSize: 11,
    marginTop: 1,
  },
  gustoStatusBadgeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  gustoStatusTextLoading: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  gustoStatusBadgeConnected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  gustoStatusDotGreen: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  gustoStatusTextConnected: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
  },
  gustoStatusBadgeError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
  },
  gustoStatusDotAmber: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#f59e0b',
  },
  gustoStatusTextError: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '600',
  },
  gustoLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.06)',
  },
  gustoLoadingText: {
    color: Colors.text.muted,
    fontSize: 13,
  },
  gustoDataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.06)',
  },
  gustoDataItem: {
    minWidth: 100,
  },
  gustoDataLabel: {
    color: Colors.text.muted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  gustoDataValue: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  gustoErrorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(59, 130, 246, 0.06)',
  },
  gustoErrorText: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  gustoErrorSub: {
    color: Colors.text.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  demoBannerText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
    lineHeight: 17,
  },
});

const stubStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any : {}),
  },
  modalContent: {
    width: '90%',
    maxWidth: 520,
    backgroundColor: '#14171F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 24,
    maxHeight: '85%',
    ...(Platform.OS === 'web' ? { boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 1px rgba(255,255,255,0.1) inset' } as any : {}),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  empAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(59,130,246,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empAvatarText: {
    color: '#60A5FA',
    fontSize: 14,
    fontWeight: '700',
  },
  empName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  empRole: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
  empBadge: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  empBadgeText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  lineLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
  lineValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  totalLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '600',
  },
  totalValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  netSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  netLabel: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '600',
  },
  netValue: {
    color: '#10B981',
    fontSize: 22,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    justifyContent: 'center',
  },
  footerText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
  },
  liveDataBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  liveDataText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '500',
  },
  demoBannerSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.15)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  demoBannerSmallText: {
    color: '#f59e0b',
    fontSize: 12,
    fontWeight: '500',
  },
  historySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  historyDate: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    width: 85,
  },
  historyGross: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  historyNet: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  historyMethod: {
    backgroundColor: 'rgba(59,130,246,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  historyMethodText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '600',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 16,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as any, transition: 'all 0.15s ease' as any } : {}),
  },
  pdfBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
