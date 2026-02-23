import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Switch,
  Animated,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSupabase } from '@/providers';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

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
  'Legal',
  'Financial Services',
  'Home Services',
  'Other',
];

const TEAM_SIZES = ['Just me', '2-5', '6-15', '16-50', '50+'];

const ENTITY_TYPES = [
  'Sole Proprietorship',
  'LLC',
  'S-Corp',
  'C-Corp',
  'Partnership',
  'Nonprofit',
  'Other',
];

// Map display values → DB enum values (matches server validateEnum + CHECK constraints)
const ENTITY_TYPE_MAP: Record<string, string> = {
  'Sole Proprietorship': 'sole_proprietorship',
  'LLC': 'llc',
  'S-Corp': 's_corp',
  'C-Corp': 'c_corp',
  'Partnership': 'partnership',
  'Nonprofit': 'nonprofit',
  'Other': 'other',
};

const YEARS_OPTIONS = ['<1', '1-3', '3-5', '5-10', '10+'];

const YEARS_MAP: Record<string, string> = {
  '<1': 'less_than_1',
  '1-3': '1_to_3',
  '3-5': '3_to_5',
  '5-10': '5_to_10',
  '10+': '10_plus',
};

const SERVICES: { id: string; icon: string; title: string; desc: string }[] = [
  { id: 'Invoicing & Payments', icon: 'card-outline', title: 'Invoicing & Payments', desc: 'Create, send, and track invoices' },
  { id: 'Bookkeeping', icon: 'calculator-outline', title: 'Bookkeeping', desc: 'Automated expense categorization' },
  { id: 'Payroll', icon: 'people-outline', title: 'Payroll', desc: 'Run payroll and manage benefits' },
  { id: 'Email Management', icon: 'mail-outline', title: 'Email Management', desc: 'Triage, draft, and send emails' },
  { id: 'Scheduling & Calendar', icon: 'calendar-outline', title: 'Scheduling & Calendar', desc: 'Book meetings and manage events' },
  { id: 'Contract Management', icon: 'document-text-outline', title: 'Contract Management', desc: 'Create and e-sign contracts' },
  { id: 'Document Generation', icon: 'documents-outline', title: 'Document Generation', desc: 'Generate PDFs and proposals' },
  { id: 'Client Communication', icon: 'chatbubbles-outline', title: 'Client Communication', desc: 'Manage client conversations' },
  { id: 'Expense Tracking', icon: 'receipt-outline', title: 'Expense Tracking', desc: 'Track and categorize expenses' },
  { id: 'Tax Preparation', icon: 'folder-outline', title: 'Tax Preparation', desc: 'Organize docs for tax season' },
  { id: 'Front Desk & Calls', icon: 'call-outline', title: 'Front Desk & Calls', desc: 'Answer and route business calls' },
  { id: 'Research & Intelligence', icon: 'search-outline', title: 'Research & Intelligence', desc: 'Vendor search and market data' },
];

const COUNTRY_CURRENCY: Record<string, string> = {
  US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD',
  DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  JP: 'JPY', IN: 'INR', MX: 'MXN', BR: 'BRL',
};

const STATE_TIMEZONES: Record<string, string> = {
  HI: 'Pacific/Honolulu', AK: 'America/Anchorage',
  WA: 'America/Los_Angeles', OR: 'America/Los_Angeles', CA: 'America/Los_Angeles', NV: 'America/Los_Angeles',
  MT: 'America/Denver', ID: 'America/Boise', WY: 'America/Denver', UT: 'America/Denver',
  CO: 'America/Denver', AZ: 'America/Phoenix', NM: 'America/Denver',
  ND: 'America/Chicago', SD: 'America/Chicago', NE: 'America/Chicago', KS: 'America/Chicago',
  MN: 'America/Chicago', IA: 'America/Chicago', MO: 'America/Chicago', WI: 'America/Chicago',
  IL: 'America/Chicago', TX: 'America/Chicago', OK: 'America/Chicago', AR: 'America/Chicago',
  LA: 'America/Chicago', MS: 'America/Chicago', AL: 'America/Chicago',
  MI: 'America/Detroit', IN: 'America/Indiana/Indianapolis', OH: 'America/New_York',
  TN: 'America/Chicago', KY: 'America/New_York',
  NY: 'America/New_York', PA: 'America/New_York', NJ: 'America/New_York',
  CT: 'America/New_York', MA: 'America/New_York', RI: 'America/New_York',
  VT: 'America/New_York', NH: 'America/New_York', ME: 'America/New_York',
  VA: 'America/New_York', WV: 'America/New_York', NC: 'America/New_York',
  SC: 'America/New_York', GA: 'America/New_York', FL: 'America/New_York',
  MD: 'America/New_York', DE: 'America/New_York', DC: 'America/New_York',
};

const COUNTRY_TIMEZONES: Record<string, string> = {
  US: 'America/New_York', CA: 'America/Toronto', GB: 'Europe/London',
  AU: 'Australia/Sydney', NZ: 'Pacific/Auckland', DE: 'Europe/Berlin',
  FR: 'Europe/Paris', JP: 'Asia/Tokyo', IN: 'Asia/Kolkata',
};

const DRAFT_KEY = 'aspire_onboarding_draft_v2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddressFields {
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const emptyAddress: AddressFields = {
  line1: '', line2: '', city: '', state: '', zip: '', country: '',
};

interface FormState {
  // Step 1
  businessName: string;
  ownerName: string;
  ownerTitle: string;
  industry: string;
  teamSize: string;
  entityType: string;
  yearsInBusiness: string;
  // Step 2
  homeAddress: AddressFields;
  businessAddressSameAsHome: boolean;
  businessAddress: AddressFields;
  homeSearchText: string;
  businessSearchText: string;
  timezone: string;
  currency: string;
  homeEditable: boolean;
  businessEditable: boolean;
  // Step 3
  servicesNeeded: string[];
  painPoint: string;
  currentTools: string;
  consentPersonalization: boolean;
  consentCommunications: boolean;
}

const initialFormState: FormState = {
  businessName: '',
  ownerName: '',
  ownerTitle: '',
  industry: '',
  teamSize: '',
  entityType: '',
  yearsInBusiness: '',
  homeAddress: { ...emptyAddress },
  businessAddressSameAsHome: true,
  businessAddress: { ...emptyAddress },
  homeSearchText: '',
  businessSearchText: '',
  timezone: '',
  currency: 'USD',
  homeEditable: false,
  businessEditable: false,
  servicesNeeded: [],
  painPoint: '',
  currentTools: '',
  consentPersonalization: false,
  consentCommunications: false,
};

// ---------------------------------------------------------------------------
// Google Places helpers (web only)
// ---------------------------------------------------------------------------

function parseGooglePlace(place: google.maps.places.PlaceResult): {
  address: AddressFields;
  timezone: string;
  currency: string;
} {
  const address: AddressFields = { ...emptyAddress };
  let stateCode = '';
  let countryCode = '';

  for (const comp of place.address_components ?? []) {
    const types = comp.types;
    if (types.includes('street_number')) {
      address.line1 = comp.long_name + (address.line1 ? ' ' + address.line1 : '');
    } else if (types.includes('route')) {
      address.line1 = (address.line1 ? address.line1 + ' ' : '') + comp.long_name;
    } else if (types.includes('locality') || types.includes('sublocality_level_1')) {
      address.city = comp.long_name;
    } else if (types.includes('administrative_area_level_1')) {
      address.state = comp.short_name;
      stateCode = comp.short_name;
    } else if (types.includes('postal_code')) {
      address.zip = comp.long_name;
    } else if (types.includes('country')) {
      address.country = comp.short_name;
      countryCode = comp.short_name;
    }
  }

  const tz =
    (countryCode === 'US' && STATE_TIMEZONES[stateCode]) ||
    COUNTRY_TIMEZONES[countryCode] ||
    '';
  const cur = COUNTRY_CURRENCY[countryCode] || 'USD';

  return { address, timezone: tz, currency: cur };
}

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

// Fields safe to persist without consent (non-PII business context only)
const SAFE_DRAFT_FIELDS: (keyof FormState)[] = [
  'businessName', 'industry', 'teamSize', 'entityType', 'yearsInBusiness',
  'timezone', 'currency', 'servicesNeeded', 'painPoint', 'currentTools',
  'businessAddressSameAsHome', 'consentPersonalization', 'consentCommunications',
  'homeEditable', 'businessEditable',
];

function saveDraft(form: FormState): void {
  if (Platform.OS !== 'web') return;
  try {
    // PII-safe draft: until consent is granted, only persist non-PII fields (GDPR/CCPA)
    if (form.consentPersonalization) {
      // Consent granted — persist full form (addresses were already captured with consent)
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } else {
      // No consent yet — allowlist approach: only safe non-PII fields
      const safeDraft: Partial<FormState> = {};
      for (const key of SAFE_DRAFT_FIELDS) {
        (safeDraft as any)[key] = form[key];
      }
      localStorage.setItem(DRAFT_KEY, JSON.stringify(safeDraft));
    }
  } catch (_e) {
    // silent — quota or private mode
  }
}

function loadDraft(): Partial<FormState> | null {
  if (Platform.OS !== 'web') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<FormState>;
  } catch (_e) {
    return null;
  }
}

function clearDraft(): void {
  if (Platform.OS !== 'web') return;
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch (_e) {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OnboardingScreen() {
  const router = useRouter();
  const { suiteId, session } = useSupabase();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrappedSuiteId, setBootstrappedSuiteId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<FormState>(initialFormState);

  // Google Places
  const [placesReady, setPlacesReady] = useState(false);
  const homeInputRef = useRef<HTMLInputElement | null>(null);
  const businessInputRef = useRef<HTMLInputElement | null>(null);
  const homeAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const businessAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Entity type dropdown open
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);

  // Progress animation
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Convenience updater
  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  // Pre-fill owner name and email from session
  useEffect(() => {
    if (!session?.user) return;
    const meta = session.user.user_metadata ?? {};
    const name = meta.full_name || meta.name || '';
    if (name && !form.ownerName) {
      updateForm({ ownerName: name });
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setForm((prev) => ({ ...prev, ...draft }));
    }
  }, []);

  // Progress bar animation
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  // Load Google Places API (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const key = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
    if (!key) return;

    // Check if already loaded
    if (typeof google !== 'undefined' && google.maps?.places) {
      setPlacesReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.onload = () => setPlacesReady(true);
    document.head.appendChild(script);

    return () => {
      // Don't remove — other parts of app may use it
    };
  }, []);

  // Attach home autocomplete
  useEffect(() => {
    if (!placesReady || !homeInputRef.current || homeAutocompleteRef.current) return;
    const ac = new google.maps.places.Autocomplete(homeInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: ['us', 'ca', 'gb', 'au'] },
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      const { address, timezone, currency } = parseGooglePlace(place);
      updateForm({
        homeAddress: address,
        homeSearchText: place.formatted_address ?? '',
        timezone,
        currency,
        homeEditable: false,
      });
    });
    homeAutocompleteRef.current = ac;
  }, [placesReady, step, updateForm]);

  // Attach business autocomplete
  useEffect(() => {
    if (!placesReady || !businessInputRef.current || businessAutocompleteRef.current) return;
    if (form.businessAddressSameAsHome) return;
    const ac = new google.maps.places.Autocomplete(businessInputRef.current, {
      types: ['address'],
      componentRestrictions: { country: ['us', 'ca', 'gb', 'au'] },
    });
    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place.address_components) return;
      const { address } = parseGooglePlace(place);
      updateForm({
        businessAddress: address,
        businessSearchText: place.formatted_address ?? '',
        businessEditable: false,
      });
    });
    businessAutocompleteRef.current = ac;
  }, [placesReady, step, form.businessAddressSameAsHome, updateForm]);

  // Reset business autocomplete ref when toggling same-as-home
  useEffect(() => {
    if (form.businessAddressSameAsHome) {
      businessAutocompleteRef.current = null;
    }
  }, [form.businessAddressSameAsHome]);

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canProceedStep1 =
    form.businessName.trim() !== '' &&
    form.industry !== '' &&
    form.teamSize !== '' &&
    form.ownerName.trim() !== '' &&
    form.entityType !== '' &&
    form.yearsInBusiness !== '';

  const hasHomeAddress =
    form.homeAddress.line1.trim() !== '' &&
    form.homeAddress.city.trim() !== '' &&
    form.homeAddress.state.trim() !== '' &&
    form.homeAddress.zip.trim() !== '';

  const hasBusinessAddress =
    form.businessAddressSameAsHome ||
    (form.businessAddress.line1.trim() !== '' &&
      form.businessAddress.city.trim() !== '' &&
      form.businessAddress.state.trim() !== '' &&
      form.businessAddress.zip.trim() !== '');

  const canProceedStep2 = hasHomeAddress && hasBusinessAddress;

  const canSubmit =
    form.servicesNeeded.length > 0 && form.consentPersonalization;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      const effectiveSuiteId = suiteId || bootstrappedSuiteId;
      const payload = {
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        ownerTitle: form.ownerTitle.trim() || null,
        industry: form.industry,
        teamSize: form.teamSize,
        entityType: ENTITY_TYPE_MAP[form.entityType] || form.entityType,
        yearsInBusiness: YEARS_MAP[form.yearsInBusiness] || form.yearsInBusiness,
        servicesNeeded: form.servicesNeeded,
        currentTools: form.currentTools.trim() || null,
        painPoint: form.painPoint.trim() || null,
        homeAddressLine1: form.homeAddress.line1,
        homeAddressLine2: form.homeAddress.line2 || null,
        homeCity: form.homeAddress.city,
        homeState: form.homeAddress.state,
        homeZip: form.homeAddress.zip,
        homeCountry: form.homeAddress.country || 'US',
        businessAddressSameAsHome: form.businessAddressSameAsHome,
        businessAddressLine1: form.businessAddressSameAsHome ? form.homeAddress.line1 : form.businessAddress.line1,
        businessAddressLine2: form.businessAddressSameAsHome
          ? (form.homeAddress.line2 || null)
          : (form.businessAddress.line2 || null),
        businessCity: form.businessAddressSameAsHome ? form.homeAddress.city : form.businessAddress.city,
        businessState: form.businessAddressSameAsHome ? form.homeAddress.state : form.businessAddress.state,
        businessZip: form.businessAddressSameAsHome ? form.homeAddress.zip : form.businessAddress.zip,
        businessCountry: form.businessAddressSameAsHome
          ? (form.homeAddress.country || 'US')
          : (form.businessAddress.country || 'US'),
        timezone: form.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        currency: form.currency || 'USD',
        consentPersonalization: form.consentPersonalization,
        consentCommunications: form.consentCommunications,
      };

      if (!effectiveSuiteId) {
        const token = session?.access_token;
        if (!token) {
          setError('Session expired. Please sign in again.');
          setLoading(false);
          return;
        }

        const resp = await fetch('/api/onboarding/bootstrap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          setError(errData.message || 'Failed to set up your business account.');
          setLoading(false);
          return;
        }

        const { suiteId: newSuiteId } = await resp.json();
        setBootstrappedSuiteId(newSuiteId);
        // Wait for session refresh to complete — ensures user_metadata has new suite_id
        // before auth gate re-evaluates (prevents redirect loop back to onboarding)
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.warn('Session refresh failed after bootstrap:', refreshError.message);
        }
        // Small delay to allow SupabaseProvider onAuthStateChange to propagate
        await new Promise(resolve => setTimeout(resolve, 500));
        clearDraft();
        router.replace('/(tabs)');
        return;
      }

      // Existing suite — update profile via server endpoint (sanitization + receipt)
      const token = session?.access_token;
      if (!token) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      const updateResp = await fetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!updateResp.ok) {
        const errData = await updateResp.json().catch(() => ({}));
        setError(errData.message || 'Failed to update profile.');
        return;
      }

      clearDraft();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save onboarding data.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step transitions
  // ---------------------------------------------------------------------------

  const goNext = () => {
    setError(null);
    setStep((s) => Math.min(s + 1, 3));
  };

  const goBack = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  };

  // ---------------------------------------------------------------------------
  // Toggle service
  // ---------------------------------------------------------------------------

  const toggleService = (id: string) => {
    updateForm({
      servicesNeeded: form.servicesNeeded.includes(id)
        ? form.servicesNeeded.filter((s) => s !== id)
        : [...form.servicesNeeded, id],
    });
  };

  // ---------------------------------------------------------------------------
  // Render: Address fields (manual fallback or editable parsed)
  // ---------------------------------------------------------------------------

  const renderAddressFields = (
    addr: AddressFields,
    editable: boolean,
    onToggleEdit: () => void,
    onChange: (patch: Partial<AddressFields>) => void,
  ) => {
    if (!addr.line1 && !addr.city) return null;
    return (
      <View style={styles.parsedAddressBox}>
        <View style={styles.parsedHeaderRow}>
          <Ionicons name="location-outline" size={16} color={ACCENT} />
          <Text style={styles.parsedLabel}>Parsed Address</Text>
          <TouchableOpacity onPress={onToggleEdit} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.editLink}>{editable ? 'Lock' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        {editable ? (
          <View style={styles.parsedFieldsGrid}>
            <TextInput
              style={[styles.input, styles.addressField]}
              value={addr.line1}
              onChangeText={(v) => onChange({ line1: v })}
              placeholder="Street address"
              placeholderTextColor="#555"
            />
            <TextInput
              style={[styles.input, styles.addressField]}
              value={addr.line2}
              onChangeText={(v) => onChange({ line2: v })}
              placeholder="Apt, suite (optional)"
              placeholderTextColor="#555"
            />
            <View style={styles.addressRow}>
              <TextInput
                style={[styles.input, styles.addressField, { flex: 2 }]}
                value={addr.city}
                onChangeText={(v) => onChange({ city: v })}
                placeholder="City"
                placeholderTextColor="#555"
              />
              <TextInput
                style={[styles.input, styles.addressField, { flex: 1 }]}
                value={addr.state}
                onChangeText={(v) => onChange({ state: v })}
                placeholder="State"
                placeholderTextColor="#555"
              />
              <TextInput
                style={[styles.input, styles.addressField, { flex: 1 }]}
                value={addr.zip}
                onChangeText={(v) => onChange({ zip: v })}
                placeholder="ZIP"
                placeholderTextColor="#555"
              />
            </View>
          </View>
        ) : (
          <Text style={styles.parsedAddressText}>
            {addr.line1}
            {addr.line2 ? `, ${addr.line2}` : ''}
            {'\n'}
            {addr.city}, {addr.state} {addr.zip}
            {addr.country ? ` ${addr.country}` : ''}
          </Text>
        )}
      </View>
    );
  };

  // Manual address input (non-web fallback)
  const renderManualAddress = (
    addr: AddressFields,
    onChange: (patch: Partial<AddressFields>) => void,
    label: string,
  ) => (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={addr.line1}
        onChangeText={(v) => onChange({ line1: v })}
        placeholder="Street address"
        placeholderTextColor="#555"
      />
      <TextInput
        style={[styles.input, { marginTop: 8 }]}
        value={addr.line2}
        onChangeText={(v) => onChange({ line2: v })}
        placeholder="Apt, suite, unit (optional)"
        placeholderTextColor="#555"
      />
      <View style={[styles.addressRow, { marginTop: 8 }]}>
        <TextInput
          style={[styles.input, { flex: 2 }]}
          value={addr.city}
          onChangeText={(v) => onChange({ city: v })}
          placeholder="City"
          placeholderTextColor="#555"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={addr.state}
          onChangeText={(v) => onChange({ state: v })}
          placeholder="State"
          placeholderTextColor="#555"
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={addr.zip}
          onChangeText={(v) => onChange({ zip: v })}
          placeholder="ZIP"
          placeholderTextColor="#555"
        />
      </View>
      <TextInput
        style={[styles.input, { marginTop: 8 }]}
        value={addr.country}
        onChangeText={(v) => onChange({ country: v })}
        placeholder="Country code (US, CA, GB...)"
        placeholderTextColor="#555"
      />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 1: You & Your Business
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>You & Your Business</Text>
      <Text style={styles.stepSubtitle}>
        Tell us a bit about yourself so Ava can personalize your experience
      </Text>

      {/* Owner Name (pre-filled from auth) */}
      <Text style={styles.label}>Your Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Full name"
        placeholderTextColor="#555"
        value={form.ownerName}
        onChangeText={(v) => updateForm({ ownerName: v })}
      />

      {/* Email (read-only from session) */}
      {session?.user?.email && (
        <>
          <Text style={styles.label}>Email</Text>
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>{session.user.email}</Text>
            <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
          </View>
        </>
      )}

      {/* Business Name */}
      <Text style={styles.label}>Business Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Apex Plumbing LLC"
        placeholderTextColor="#555"
        value={form.businessName}
        onChangeText={(v) => updateForm({ businessName: v })}
      />

      {/* Industry */}
      <Text style={styles.label}>Industry</Text>
      <View style={styles.chipGrid}>
        {INDUSTRIES.map((ind) => (
          <TouchableOpacity
            key={ind}
            style={[styles.chip, form.industry === ind && styles.chipSelected]}
            onPress={() => updateForm({ industry: ind })}
          >
            <Text style={[styles.chipText, form.industry === ind && styles.chipTextSelected]}>
              {ind}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Team Size */}
      <Text style={styles.label}>Team Size</Text>
      <View style={styles.pillRow}>
        {TEAM_SIZES.map((size) => (
          <TouchableOpacity
            key={size}
            style={[styles.pill, form.teamSize === size && styles.pillSelected]}
            onPress={() => updateForm({ teamSize: size })}
          >
            <Text style={[styles.pillText, form.teamSize === size && styles.pillTextSelected]}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Entity Type */}
      <Text style={styles.label}>Entity Type</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setEntityDropdownOpen((v) => !v)}
      >
        <Text style={form.entityType ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {form.entityType || 'Select entity type'}
        </Text>
        <Ionicons
          name={entityDropdownOpen ? 'chevron-up' : 'chevron-down'}
          size={18}
          color="#888"
        />
      </TouchableOpacity>
      {entityDropdownOpen && (
        <View style={styles.dropdownList}>
          {ENTITY_TYPES.map((et) => (
            <TouchableOpacity
              key={et}
              style={[styles.dropdownItem, form.entityType === et && styles.dropdownItemSelected]}
              onPress={() => {
                updateForm({ entityType: et });
                setEntityDropdownOpen(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  form.entityType === et && styles.dropdownItemTextSelected,
                ]}
              >
                {et}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Years in Business */}
      <Text style={styles.label}>Years in Business</Text>
      <View style={styles.pillRow}>
        {YEARS_OPTIONS.map((yr) => (
          <TouchableOpacity
            key={yr}
            style={[styles.pill, form.yearsInBusiness === yr && styles.pillSelected]}
            onPress={() => updateForm({ yearsInBusiness: yr })}
          >
            <Text style={[styles.pillText, form.yearsInBusiness === yr && styles.pillTextSelected]}>
              {yr}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Owner Title (optional) */}
      <Text style={styles.label}>Your Title (optional)</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Owner, CEO, Manager"
        placeholderTextColor="#555"
        value={form.ownerTitle}
        onChangeText={(v) => updateForm({ ownerTitle: v })}
      />
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 2: Address & Location
  // ---------------------------------------------------------------------------

  const renderStep2 = () => {
    const isWeb = Platform.OS === 'web';
    const showPlaces = isWeb && placesReady;

    return (
      <View>
        <Text style={styles.stepTitle}>Address & Location</Text>
        <Text style={styles.stepSubtitle}>
          Your address helps configure taxes, timezone, and currency automatically
        </Text>

        {/* Home Address */}
        <Text style={styles.label}>Home Address</Text>
        {showPlaces ? (
          <View>
            <View style={styles.searchInputWrap}>
              <Ionicons name="search-outline" size={18} color="#888" style={styles.searchIcon} />
              {/* Web-only: raw HTML input for Google Places */}
              <input
                ref={homeInputRef as React.RefObject<HTMLInputElement>}
                type="text"
                placeholder="Start typing to search address..."
                value={form.homeSearchText}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateForm({ homeSearchText: e.target.value })}
                style={webInputStyle}
              />
            </View>
            {renderAddressFields(
              form.homeAddress,
              form.homeEditable,
              () => updateForm({ homeEditable: !form.homeEditable }),
              (patch) =>
                updateForm({
                  homeAddress: { ...form.homeAddress, ...patch },
                }),
            )}
          </View>
        ) : (
          renderManualAddress(
            form.homeAddress,
            (patch) => {
              const next = { ...form.homeAddress, ...patch };
              const tz =
                (next.country === 'US' && STATE_TIMEZONES[next.state]) ||
                COUNTRY_TIMEZONES[next.country] ||
                '';
              const cur = COUNTRY_CURRENCY[next.country] || 'USD';
              updateForm({ homeAddress: next, timezone: tz, currency: cur });
            },
            'Home Address',
          )
        )}

        {/* Timezone + Currency (auto-detected, shown read-only) */}
        {(form.timezone || form.currency) && (
          <View style={styles.autoDetectedRow}>
            {form.timezone ? (
              <View style={styles.autoTag}>
                <Ionicons name="time-outline" size={14} color={ACCENT} />
                <Text style={styles.autoTagText}>{form.timezone}</Text>
              </View>
            ) : null}
            {form.currency ? (
              <View style={styles.autoTag}>
                <Ionicons name="cash-outline" size={14} color={ACCENT} />
                <Text style={styles.autoTagText}>{form.currency}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* Same as home toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Business address same as home?</Text>
          <Switch
            value={form.businessAddressSameAsHome}
            onValueChange={(v) => updateForm({ businessAddressSameAsHome: v })}
            trackColor={{ false: '#333', true: ACCENT_LIGHT }}
            thumbColor={form.businessAddressSameAsHome ? ACCENT : '#888'}
          />
        </View>

        {/* Business Address (if different) */}
        {!form.businessAddressSameAsHome && (
          <>
            <Text style={styles.label}>Business Address</Text>
            {showPlaces ? (
              <View>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search-outline" size={18} color="#888" style={styles.searchIcon} />
                  <input
                    ref={businessInputRef as React.RefObject<HTMLInputElement>}
                    type="text"
                    placeholder="Search business address..."
                    value={form.businessSearchText}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      updateForm({ businessSearchText: e.target.value })
                    }
                    style={webInputStyle}
                  />
                </View>
                {renderAddressFields(
                  form.businessAddress,
                  form.businessEditable,
                  () => updateForm({ businessEditable: !form.businessEditable }),
                  (patch) =>
                    updateForm({
                      businessAddress: { ...form.businessAddress, ...patch },
                    }),
                )}
              </View>
            ) : (
              renderManualAddress(
                form.businessAddress,
                (patch) =>
                  updateForm({
                    businessAddress: { ...form.businessAddress, ...patch },
                  }),
                'Business Address',
              )
            )}
          </>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Step 3: Services & Go
  // ---------------------------------------------------------------------------

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Services & Go</Text>
      <Text style={styles.stepSubtitle}>
        Choose what Ava should set up for you. You can always add more later.
      </Text>

      {/* Service Cards */}
      <View style={styles.serviceGrid}>
        {SERVICES.map((svc) => {
          const selected = form.servicesNeeded.includes(svc.id);
          return (
            <TouchableOpacity
              key={svc.id}
              style={[styles.serviceCard, selected && styles.serviceCardSelected]}
              onPress={() => toggleService(svc.id)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={svc.icon as keyof typeof Ionicons.glyphMap}
                size={22}
                color={selected ? ACCENT : '#888'}
              />
              <Text style={[styles.serviceTitle, selected && styles.serviceTitleSelected]}>
                {svc.title}
              </Text>
              <Text style={styles.serviceDesc}>{svc.desc}</Text>
              {selected && (
                <View style={styles.serviceCheck}>
                  <Ionicons name="checkmark-circle" size={18} color={ACCENT} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Biggest Challenge (optional) */}
      <Text style={[styles.label, { marginTop: 24 }]}>Biggest Challenge (optional)</Text>
      <TextInput
        style={[styles.input, styles.multilineInput]}
        placeholder="What's your #1 operational headache?"
        placeholderTextColor="#555"
        value={form.painPoint}
        onChangeText={(v) => updateForm({ painPoint: v })}
        multiline
        numberOfLines={3}
      />

      {/* Consent checkboxes */}
      <View style={styles.consentSection}>
        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => updateForm({ consentPersonalization: !form.consentPersonalization })}
        >
          <View
            style={[
              styles.checkbox,
              form.consentPersonalization && styles.checkboxChecked,
            ]}
          >
            {form.consentPersonalization && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
          <Text style={styles.consentText}>
            I agree to a personalized experience powered by my business data{' '}
            <Text style={styles.requiredStar}>*</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.consentRow}
          onPress={() => updateForm({ consentCommunications: !form.consentCommunications })}
        >
          <View
            style={[
              styles.checkbox,
              form.consentCommunications && styles.checkboxChecked,
            ]}
          >
            {form.consentCommunications && (
              <Ionicons name="checkmark" size={14} color="#fff" />
            )}
          </View>
          <Text style={styles.consentText}>
            I would like to receive product updates and tips (optional)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Progress Bar
  // ---------------------------------------------------------------------------

  const progressWidth = progressAnim.interpolate({
    inputRange: [1, 2, 3],
    outputRange: ['33.33%', '66.66%', '100%'],
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.inner}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.stepIndicatorRow}>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
          <Text style={styles.stepName}>
            {step === 1 ? 'You & Your Business' : step === 2 ? 'Address & Location' : 'Services & Go'}
          </Text>
        </View>

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={18} color="#F87171" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Step Content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Navigation */}
        <View style={styles.buttonRow}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBack}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={18} color="#aaa" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }} />

          {step < 3 ? (
            <TouchableOpacity
              style={[
                styles.nextButton,
                !(step === 1 ? canProceedStep1 : canProceedStep2) && styles.buttonDisabled,
              ]}
              onPress={goNext}
              disabled={!(step === 1 ? canProceedStep1 : canProceedStep2)}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.launchButton,
                (!canSubmit || loading) && styles.buttonDisabled,
              ]}
              onPress={handleComplete}
              disabled={!canSubmit || loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="rocket-outline" size={20} color="#fff" />
                  <Text style={styles.launchButtonText}>Launch Aspire</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Color constants (local to file — avoids long token references in styles)
// ---------------------------------------------------------------------------

const ACCENT = '#00BCD4';
const ACCENT_LIGHT = 'rgba(0, 188, 212, 0.2)';
const ACCENT_GLOW = 'rgba(0, 188, 212, 0.35)';
const BG = '#0a0a0a';
const SURFACE = '#1a1a1a';
const BORDER = '#333';
const BORDER_STRONG = '#444';
const TEXT_PRIMARY = '#fff';
const TEXT_SECONDARY = '#ccc';
const TEXT_MUTED = '#888';
const TEXT_DIM = '#555';
const ERROR_RED = '#F87171';

// Web-only inline style for the HTML <input> used by Google Places
const webInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: TEXT_PRIMARY,
  fontSize: 16,
  padding: '14px 16px 14px 0',
  fontFamily: 'inherit',
  width: '100%',
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  contentContainer: {
    paddingBottom: 80,
  },
  inner: {
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 36,
    paddingTop: 48,
  },

  // Progress bar
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#222',
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  stepIndicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  stepIndicator: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '500',
  },
  stepName: {
    color: TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '600',
  },

  // Step header
  stepTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    color: TEXT_MUTED,
    marginBottom: 28,
    lineHeight: 22,
  },

  // Labels
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#aaa',
    marginBottom: 6,
    marginTop: 18,
  },

  // Inputs
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: TEXT_PRIMARY,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Read-only field (email)
  readOnlyField: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readOnlyText: {
    color: TEXT_SECONDARY,
    fontSize: 16,
  },

  // Chip grid (industry)
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: ACCENT_LIGHT,
    borderColor: ACCENT,
  },
  chipText: {
    color: '#aaa',
    fontSize: 14,
  },
  chipTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },

  // Pill row (team size, years)
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  pillSelected: {
    backgroundColor: ACCENT_LIGHT,
    borderColor: ACCENT,
  },
  pillText: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: ACCENT,
    fontWeight: '700',
  },

  // Dropdown (entity type)
  dropdown: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownValue: {
    color: TEXT_PRIMARY,
    fontSize: 16,
  },
  dropdownPlaceholder: {
    color: TEXT_DIM,
    fontSize: 16,
  },
  dropdownList: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: BORDER_STRONG,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemSelected: {
    backgroundColor: ACCENT_LIGHT,
  },
  dropdownItemText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },
  dropdownItemTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },

  // Step 2: Address search
  searchInputWrap: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    overflow: 'hidden' as const,
  },
  searchIcon: {
    marginRight: 4,
  },

  // Parsed address display
  parsedAddressBox: {
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 10,
    padding: 14,
    marginTop: 10,
  },
  parsedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  parsedLabel: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  editLink: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '600',
  },
  parsedAddressText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
  },
  parsedFieldsGrid: {
    gap: 8,
  },
  addressField: {
    paddingVertical: 10,
    fontSize: 14,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },

  // Auto-detected badges
  autoDetectedRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  autoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  autoTagText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },

  // Toggle row (same address)
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  toggleLabel: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '500',
  },

  // Step 3: Service cards
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 16,
    width: '48%' as unknown as number,
    minHeight: 110,
    position: 'relative',
  } as ViewStyle,
  serviceCardSelected: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(0, 188, 212, 0.08)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 12px ${ACCENT_GLOW}` } as unknown as ViewStyle)
      : {}),
  } as ViewStyle,
  serviceTitle: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
  serviceTitleSelected: {
    color: ACCENT,
  },
  serviceDesc: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  serviceCheck: {
    position: 'absolute',
    top: 12,
    right: 12,
  },

  // Consent
  consentSection: {
    marginTop: 28,
    gap: 14,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: BORDER_STRONG,
    backgroundColor: SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  consentText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  requiredStar: {
    color: ERROR_RED,
    fontWeight: '700',
  },

  // Error
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: ERROR_RED,
    fontSize: 14,
    flex: 1,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 36,
    gap: 12,
  },
  backButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backButtonText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nextButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '700',
  },
  launchButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 20px ${ACCENT_GLOW}` } as unknown as ViewStyle)
      : {}),
  } as ViewStyle,
  launchButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
});
