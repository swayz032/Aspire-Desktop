import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSupabase } from '@/providers';
import { supabase } from '@/lib/supabase';

const INDUSTRIES = [
  'Construction & Trades',
  'Professional Services',
  'Healthcare',
  'Real Estate',
  'Retail & E-commerce',
  'Manufacturing',
  'Food & Hospitality',
  'Transportation & Logistics',
  'Technology',
  'Other',
];

const TEAM_SIZES = ['Just me', '2-5', '6-15', '16-50', '50+'];

const SERVICES = [
  'Invoicing & Payments',
  'Bookkeeping',
  'Payroll',
  'Email Management',
  'Scheduling & Calendar',
  'Contract Management',
  'Document Generation',
  'Client Communication',
  'Expense Tracking',
  'Tax Preparation',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { suiteId } = useSupabase();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 fields
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerTitle, setOwnerTitle] = useState('');

  // Step 2 fields
  const [servicesNeeded, setServicesNeeded] = useState<string[]>([]);
  const [currentTools, setCurrentTools] = useState('');
  const [painPoint, setPainPoint] = useState('');

  const toggleService = (service: string) => {
    setServicesNeeded((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  const canProceedStep1 = businessName.trim() && industry && teamSize && ownerName.trim();
  const canProceedStep2 = servicesNeeded.length > 0;

  const handleComplete = async () => {
    if (!suiteId) {
      setError('No suite context found. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('suite_profiles')
        .update({
          business_name: businessName.trim(),
          industry,
          team_size: teamSize,
          owner_name: ownerName.trim(),
          owner_title: ownerTitle.trim() || null,
          services_needed: servicesNeeded,
          current_tools: currentTools.trim()
            ? currentTools.split(',').map((t) => t.trim())
            : [],
          pain_point: painPoint.trim() || null,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('suite_id', suiteId);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      setError(err.message || 'Failed to save onboarding data.');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <>
      <Text style={styles.stepTitle}>Tell us about your business</Text>
      <Text style={styles.stepSubtitle}>
        This helps Ava personalize your experience
      </Text>

      <Text style={styles.label}>Business Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Your Business Name"
        placeholderTextColor="#555"
        value={businessName}
        onChangeText={setBusinessName}
      />

      <Text style={styles.label}>Industry</Text>
      <View style={styles.chipGrid}>
        {INDUSTRIES.map((ind) => (
          <TouchableOpacity
            key={ind}
            style={[styles.chip, industry === ind && styles.chipSelected]}
            onPress={() => setIndustry(ind)}
          >
            <Text style={[styles.chipText, industry === ind && styles.chipTextSelected]}>
              {ind}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Team Size</Text>
      <View style={styles.chipGrid}>
        {TEAM_SIZES.map((size) => (
          <TouchableOpacity
            key={size}
            style={[styles.chip, teamSize === size && styles.chipSelected]}
            onPress={() => setTeamSize(size)}
          >
            <Text style={[styles.chipText, teamSize === size && styles.chipTextSelected]}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Your Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#555"
        value={ownerName}
        onChangeText={setOwnerName}
      />

      <Text style={styles.label}>Your Title (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Owner, CEO, Manager"
        placeholderTextColor="#555"
        value={ownerTitle}
        onChangeText={setOwnerTitle}
      />
    </>
  );

  const renderStep2 = () => (
    <>
      <Text style={styles.stepTitle}>What do you need help with?</Text>
      <Text style={styles.stepSubtitle}>
        Select the services Ava should set up for you
      </Text>

      <Text style={styles.label}>Services Needed</Text>
      <View style={styles.chipGrid}>
        {SERVICES.map((svc) => (
          <TouchableOpacity
            key={svc}
            style={[styles.chip, servicesNeeded.includes(svc) && styles.chipSelected]}
            onPress={() => toggleService(svc)}
          >
            <Text
              style={[
                styles.chipText,
                servicesNeeded.includes(svc) && styles.chipTextSelected,
              ]}
            >
              {svc}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Current Tools (optional, comma-separated)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. QuickBooks, Google Calendar, Stripe"
        placeholderTextColor="#555"
        value={currentTools}
        onChangeText={setCurrentTools}
      />

      <Text style={styles.label}>Biggest Challenge (optional)</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        placeholder="What is your biggest operational pain point?"
        placeholderTextColor="#555"
        value={painPoint}
        onChangeText={setPainPoint}
        multiline
        numberOfLines={3}
      />
    </>
  );

  const renderStep3 = () => (
    <>
      <Text style={styles.stepTitle}>You are all set</Text>
      <Text style={styles.stepSubtitle}>
        Here is a summary of your setup
      </Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Business</Text>
          <Text style={styles.summaryValue}>{businessName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Industry</Text>
          <Text style={styles.summaryValue}>{industry}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Team Size</Text>
          <Text style={styles.summaryValue}>{teamSize}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Owner</Text>
          <Text style={styles.summaryValue}>
            {ownerName}
            {ownerTitle ? `, ${ownerTitle}` : ''}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Services</Text>
          <Text style={styles.summaryValue}>{servicesNeeded.join(', ')}</Text>
        </View>
        {currentTools.trim() && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Current Tools</Text>
            <Text style={styles.summaryValue}>{currentTools}</Text>
          </View>
        )}
        {painPoint.trim() && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Challenge</Text>
            <Text style={styles.summaryValue}>{painPoint}</Text>
          </View>
        )}
      </View>
    </>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.inner}>
        {/* Progress indicator */}
        <View style={styles.progressRow}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                s <= step && styles.progressDotActive,
                s === step && styles.progressDotCurrent,
              ]}
            />
          ))}
        </View>
        <Text style={styles.progressText}>Step {step} of 3</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        <View style={styles.buttonRow}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(step - 1)}
              disabled={loading}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 3 ? (
            <TouchableOpacity
              style={[
                styles.nextButton,
                !(step === 1 ? canProceedStep1 : canProceedStep2) && styles.buttonDisabled,
              ]}
              onPress={() => setStep(step + 1)}
              disabled={!(step === 1 ? canProceedStep1 : canProceedStep2)}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.buttonDisabled]}
              onPress={handleComplete}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.nextButtonText}>Start Using Aspire</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  contentContainer: {
    paddingBottom: 60,
  },
  inner: {
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
  },
  progressDotActive: {
    backgroundColor: '#00BCD4',
  },
  progressDotCurrent: {
    backgroundColor: '#00BCD4',
    width: 48,
  },
  progressText: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: '#888',
    marginBottom: 28,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#fff',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: 'rgba(0, 188, 212, 0.15)',
    borderColor: '#00BCD4',
  },
  chipText: {
    color: '#aaa',
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#00BCD4',
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 12,
    padding: 20,
    gap: 14,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryLabel: {
    color: '#888',
    fontSize: 14,
    width: 100,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 32,
  },
  backButton: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  backButtonText: {
    color: '#aaa',
    fontSize: 16,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: '#00BCD4',
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    alignItems: 'center',
    minWidth: 120,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#F87171',
    fontSize: 14,
  },
});
