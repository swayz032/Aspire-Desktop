import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FinanceHubShell } from '@/components/finance/FinanceHubShell';
import { PayrollSettings } from '@/components/finance/payroll/PayrollSettings';
import { Colors } from '@/constants/tokens';

export default function SettingsPage() {
  const [gustoCompany, setGustoCompany] = useState<any>(null);
  const [gustoEmployees, setGustoEmployees] = useState<any[]>([]);
  const [gustoLoading, setGustoLoading] = useState(true);
  const [gustoError, setGustoError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchGustoData() {
      try {
        setGustoLoading(true);
        const [companyRes, employeesRes] = await Promise.all([
          fetch('/api/gusto/company'),
          fetch('/api/gusto/employees'),
        ]);
        if (companyRes.ok) {
          const company = await companyRes.json();
          setGustoCompany(company);
        }
        if (employeesRes.ok) {
          const emps = await employeesRes.json();
          setGustoEmployees(Array.isArray(emps) ? emps : []);
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

  return (
    <FinanceHubShell>
      <View style={styles.pageHeader}>
        <Ionicons name="settings-outline" size={22} color="#3B82F6" />
        <Text style={styles.pageTitle}>Settings</Text>
      </View>
      {gustoLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      ) : (
        <PayrollSettings
          gustoCompany={gustoCompany}
          gustoEmployees={gustoEmployees}
          gustoConnected={gustoConnected}
        />
      )}
    </FinanceHubShell>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  pageTitle: {
    color: Colors.text.primary,
    fontSize: 22,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: Colors.text.muted,
    fontSize: 14,
    marginTop: 12,
  },
});
