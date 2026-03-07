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
import { CelebrationModal } from '@/components/CelebrationModal';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INDUSTRIES = [
  'Construction & Trades',
  'Professional Services',
  'Healthcare & Wellness',
  'Technology & Software',
  'Real Estate & Property Management',
  'Retail & E-Commerce',
  'Food & Hospitality',
  'Creative & Marketing',
  'Education & Training',
  'Transportation & Logistics',
  'Manufacturing',
  'Other',
];

// Two-level industry → specialty map (12 categories)
const INDUSTRY_SPECIALTIES: Record<string, string[]> = {
  'Construction & Trades': [
    'General Contracting', 'HVAC', 'Plumbing', 'Electrical', 'Roofing',
    'Painting', 'Landscaping', 'Flooring', 'Masonry', 'Carpentry',
    'Demolition', 'Excavation', 'Welding', 'Fencing', 'Other',
  ],
  'Professional Services': [
    'Accounting', 'Law', 'Consulting', 'Engineering', 'Architecture',
    'Real Estate Brokerage', 'Insurance', 'Marketing Agency', 'Recruiting',
    'IT Services', 'Financial Planning', 'Other',
  ],
  'Healthcare & Wellness': [
    'Medical Practice', 'Dental', 'Chiropractic', 'Physical Therapy',
    'Mental Health', 'Veterinary', 'Pharmacy', 'Home Health', 'Optometry',
    'Wellness & Spa', 'Nutrition', 'Other',
  ],
  'Technology & Software': [
    'SaaS', 'Web Development', 'Mobile App Development', 'IT Consulting',
    'Cybersecurity', 'Data Analytics', 'AI/ML', 'Cloud Services',
    'Hardware', 'Telecommunications', 'Other',
  ],
  'Real Estate & Property Management': [
    'Residential Sales', 'Commercial Sales', 'Property Management',
    'Real Estate Investment', 'Appraisal', 'Inspection', 'Title Services',
    'Mortgage Brokerage', 'Other',
  ],
  'Retail & E-Commerce': [
    'Clothing & Apparel', 'Electronics', 'Home Goods', 'Grocery & Food',
    'Health & Beauty', 'Pet Supplies', 'Sporting Goods', 'Specialty Retail',
    'Online Marketplace', 'Other',
  ],
  'Food & Hospitality': [
    'Restaurant', 'Catering', 'Food Truck', 'Bakery', 'Bar & Nightlife',
    'Coffee Shop', 'Hotel & Lodging', 'Event Venue', 'Cleaning Services',
    'Other',
  ],
  'Creative & Marketing': [
    'Graphic Design', 'Photography', 'Video Production', 'Content Writing',
    'Social Media Management', 'PR & Communications', 'Advertising',
    'Branding', 'UX/UI Design', 'Other',
  ],
  'Education & Training': [
    'Tutoring', 'Online Courses', 'Corporate Training', 'Music & Arts',
    'Language School', 'Test Prep', 'Driving School', 'Trade School',
    'Childcare & Preschool', 'Other',
  ],
  'Transportation & Logistics': [
    'Trucking', 'Courier & Delivery', 'Moving Services', 'Freight Brokerage',
    'Warehousing', 'Fleet Management', 'Auto Repair', 'Towing',
    'Rideshare & Taxi', 'Other',
  ],
  'Manufacturing': [
    'Metal Fabrication', 'Woodworking', 'Plastics', 'Textiles',
    'Food Processing', 'Electronics Assembly', 'Chemical', 'Printing',
    '3D Printing', 'Other',
  ],
  'Other': [
    'Agriculture', 'Mining', 'Nonprofit', 'Government Contracting',
    'Religious Organization', 'Entertainment', 'Sports & Recreation',
    'Personal Services', 'Other',
  ],
};

const INCOME_RANGES = [
  { value: 'under_25k', label: 'Under $25K' },
  { value: '25k_50k', label: '$25K-$50K' },
  { value: '50k_75k', label: '$50K-$75K' },
  { value: '75k_100k', label: '$75K-$100K' },
  { value: '100k_150k', label: '$100K-$150K' },
  { value: '150k_250k', label: '$150K-$250K' },
  { value: '250k_500k', label: '$250K-$500K' },
  { value: '500k_plus', label: '$500K+' },
];

const REFERRAL_SOURCES = [
  { value: 'google_search', label: 'Google Search', icon: 'search-outline' },
  { value: 'social_media', label: 'Social Media', icon: 'logo-twitter' },
  { value: 'friend_referral', label: 'Friend/Colleague', icon: 'people-outline' },
  { value: 'podcast', label: 'Podcast', icon: 'mic-outline' },
  { value: 'blog_article', label: 'Blog/Article', icon: 'newspaper-outline' },
  { value: 'conference_event', label: 'Conference/Event', icon: 'calendar-outline' },
  { value: 'advertisement', label: 'Advertisement', icon: 'megaphone-outline' },
  { value: 'app_store', label: 'App Store', icon: 'phone-portrait-outline' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
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

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

// SERVICES array removed in v3 — all services auto-included per Genesis Gate

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

const DRAFT_KEY = 'aspire_onboarding_draft_v3';

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
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
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
  // Step 1 (continued)
  industrySpecialty: string;
  // Step 3
  incomeRange: string;
  referralSource: string;
  painPoint: string;
  consentPersonalization: boolean;
  consentCommunications: boolean;
}

const initialFormState: FormState = {
  businessName: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
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
  industrySpecialty: '',
  incomeRange: '',
  referralSource: '',
  painPoint: '',
  consentPersonalization: false,
  consentCommunications: false,
};

// ---------------------------------------------------------------------------
// Draft persistence
// ---------------------------------------------------------------------------

// Fields safe to persist without consent (non-PII business context only)
const SAFE_DRAFT_FIELDS: (keyof FormState)[] = [
  'businessName', 'industry', 'industrySpecialty', 'teamSize', 'entityType', 'yearsInBusiness',
  'timezone', 'currency', 'incomeRange', 'referralSource', 'painPoint',
  'businessAddressSameAsHome', 'consentPersonalization', 'consentCommunications',
  'homeEditable', 'businessEditable',
];

function isValidDobFormat(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === value;
}

function isAdultDob(value: string): boolean {
  if (!isValidDobFormat(value)) return false;
  const today = new Date();
  const dob = new Date(value);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age >= 18;
}

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

  // Double-submission guard (Bug fix: prevents concurrent bootstrap calls)
  const submittingRef = useRef(false);

  // Celebration flow state (Wave 4)
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    businessName: string;
    suiteDisplayId: string;
    officeDisplayId: string;
  } | null>(null);

  // Premium loading screen state (Wave 4A)
  const [showLoading, setShowLoading] = useState(false);
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Form state
  const [form, setForm] = useState<FormState>(initialFormState);

  // Google Places address autocomplete
  const [homeSuggestions, setHomeSuggestions] = useState<any[]>([]);
  const [businessSuggestions, setBusinessSuggestions] = useState<any[]>([]);
  const [homeValidated, setHomeValidated] = useState(false);
  const [businessValidated, setBusinessValidated] = useState(false);
  const homeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const businessDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dropdown open states
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const [industryDropdownOpen, setIndustryDropdownOpen] = useState(false);
  const [specialtyDropdownOpen, setSpecialtyDropdownOpen] = useState(false);

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
    const fullName = meta.full_name || meta.name || '';
    if (fullName && !form.firstName) {
      const parts = fullName.trim().split(' ');
      const first = parts[0] || '';
      const last = parts.slice(1).join(' ') || '';
      updateForm({ firstName: first, lastName: last });
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore draft on mount — validate keys to prevent stale v2 drafts from breaking v3 form
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      // Filter draft to only known FormState keys, then merge with defaults
      const validKeys = new Set(Object.keys(initialFormState));
      const safeDraft: Partial<FormState> = {};
      for (const [key, value] of Object.entries(draft)) {
        if (validKeys.has(key)) {
          (safeDraft as any)[key] = value;
        }
      }
      setForm((prev) => ({ ...prev, ...safeDraft }));
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


  // Google Places REST address search helpers

  const parsePlaceDetails = (details: any): AddressFields => {
    const comps: any[] = details.addressComponents || [];
    const get = (...types: string[]) => comps.find((ac: any) => types.some(t => ac.types?.includes(t)));
    const streetNum = get('street_number')?.longText || '';
    const route = get('route')?.longText || '';
    const city = get('locality', 'postal_town', 'sublocality')?.longText || get('administrative_area_level_2')?.longText || '';
    const state = get('administrative_area_level_1')?.shortText || '';
    const zip = get('postal_code')?.longText || '';
    const country = get('country')?.shortText || 'US';
    return { line1: [streetNum, route].filter(Boolean).join(' '), line2: '', city, state, zip, country };
  };

  const searchPlaces = async (query: string, onResults: (r: any[]) => void) => {
    if (!query || query.length < 2) { onResults([]); return; }
    try {
      const res = await fetch('/api/places/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query }),
      });
      const data = await res.json();
      if (data.error) { console.error('[Places] API error:', data.error); onResults([]); return; }
      onResults(data.suggestions || []);
    } catch (e: any) { console.error('[Places] fetch failed:', e?.message); onResults([]); }
  };

  const getPlaceDetails = async (placeId: string): Promise<AddressFields | null> => {
    try {
      const res = await fetch(`/api/places/details/${encodeURIComponent(placeId)}`);
      const data = await res.json();
      if (data.error) { console.error('[Places] Details error:', data.error); return null; }
      return parsePlaceDetails(data);
    } catch (e: any) { console.error('[Places] details failed:', e?.message); return null; }
  };

  const doValidateAddress = async (address: AddressFields, onValidated: (ok: boolean) => void) => {
    if (!address.line1) { onValidated(false); return; }
    onValidated(true);
  };

  const onHomeSearchChange = (text: string) => {
    updateForm({ homeSearchText: text });
    setHomeValidated(false);
    if (homeDebounceRef.current) clearTimeout(homeDebounceRef.current);
    homeDebounceRef.current = setTimeout(() => searchPlaces(text, setHomeSuggestions), 350);
  };

  const onHomeSelect = async (suggestion: any) => {
    const placeId = suggestion.placePrediction?.placeId;
    const displayText = suggestion.placePrediction?.text?.text || '';
    setHomeSuggestions([]);
    updateForm({ homeSearchText: displayText });
    if (placeId) {
      const address = await getPlaceDetails(placeId);
      if (address) {
        const tz = (address.country === 'US' && STATE_TIMEZONES[address.state]) || COUNTRY_TIMEZONES[address.country] || '';
        const cur = COUNTRY_CURRENCY[address.country] || 'USD';
        updateForm({ homeAddress: address, timezone: tz, currency: cur, homeEditable: false });
        doValidateAddress(address, setHomeValidated);
      }
    }
  };

  const onHomeClear = () => {
    updateForm({ homeSearchText: '', homeAddress: { ...emptyAddress }, homeEditable: true });
    setHomeValidated(false);
    setHomeSuggestions([]);
  };

  const onBusinessSearchChange = (text: string) => {
    updateForm({ businessSearchText: text });
    setBusinessValidated(false);
    if (businessDebounceRef.current) clearTimeout(businessDebounceRef.current);
    businessDebounceRef.current = setTimeout(() => searchPlaces(text, setBusinessSuggestions), 350);
  };

  const onBusinessSelect = async (suggestion: any) => {
    const placeId = suggestion.placePrediction?.placeId;
    const displayText = suggestion.placePrediction?.text?.text || '';
    setBusinessSuggestions([]);
    updateForm({ businessSearchText: displayText });
    if (placeId) {
      const address = await getPlaceDetails(placeId);
      if (address) {
        updateForm({ businessAddress: address, businessEditable: false });
        doValidateAddress(address, setBusinessValidated);
      }
    }
  };

  const onBusinessClear = () => {
    updateForm({ businessSearchText: '', businessAddress: { ...emptyAddress }, businessEditable: true });
    setBusinessValidated(false);
    setBusinessSuggestions([]);
  };

    // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  const canProceedStep1 =
    form.businessName.trim() !== '' &&
    form.industry !== '' &&
    form.industrySpecialty !== '' &&
    form.teamSize !== '' &&
    form.firstName.trim() !== '' &&
    form.gender !== '' &&
    isAdultDob(form.dateOfBirth) &&
    form.entityType !== '' &&
    form.yearsInBusiness !== '' &&
    form.ownerTitle.trim() !== '';

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

  const canSubmit = form.consentPersonalization;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleComplete = async () => {
    // Double-submission guard
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setShowLoading(true);
    setError(null);
    const bootstrapStartTime = Date.now();

    try {
      const effectiveSuiteId = suiteId || bootstrappedSuiteId;
      const payload = {
        businessName: form.businessName.trim(),
        ownerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        ownerTitle: form.ownerTitle.trim() || null,
        industry: form.industry,
        teamSize: form.teamSize,
        entityType: ENTITY_TYPE_MAP[form.entityType] || form.entityType,
        yearsInBusiness: YEARS_MAP[form.yearsInBusiness] || form.yearsInBusiness,
        industrySpecialty: form.industrySpecialty || null,
        incomeRange: form.incomeRange || null,
        referralSource: form.referralSource || null,
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
          setShowLoading(false);
          setLoadingComplete(false);
          return;
        }

        // 25s timeout — prevents hanging on Railway cold starts or network issues
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 25000);

        const resp = await fetch('/api/onboarding/bootstrap', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(fetchTimeout);

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          setError(errData.message || 'Failed to set up your business account.');
          setLoading(false);
          setShowLoading(false);
          setLoadingComplete(false);
          return;
        }

        const bootstrapResult = await resp.json();
        const { suiteId: newSuiteId, suiteDisplayId, officeDisplayId, businessName: bName } = bootstrapResult;
        setBootstrappedSuiteId(newSuiteId);

        // NOTE: We intentionally DO NOT call supabase.auth.refreshSession() here.
        // Refreshing the session would update the JWT with the new suite_id, which
        // triggers useAuthGate in _layout.tsx → fetches /api/onboarding/status →
        // gets {complete: true} → router.replace('/(tabs)') → UNMOUNTS this component
        // before the celebration modal can render. The session refresh is deferred
        // to handleEnterAspire(), called when the user clicks "Enter Aspire".

        // Store celebration data — loading screen will fade, then celebration shows.
        // Ensure minimum 12s of loading so n8n intake-activation + Adam daily brief
        // have time to process, and all 4 status messages cycle at least twice.
        const elapsed = Date.now() - bootstrapStartTime;
        const MIN_LOADING_MS = 12000;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

        const celebData = {
          businessName: bName || form.businessName.trim(),
          suiteDisplayId: suiteDisplayId || '',
          officeDisplayId: officeDisplayId || '',
        };

        if (remaining > 0) {
          setTimeout(() => {
            setCelebrationData(celebData);
            setLoadingComplete(true);
          }, remaining);
        } else {
          setCelebrationData(celebData);
          setLoadingComplete(true);
        }
        clearDraft();
        return;
      }

      // Existing suite — update profile via server endpoint (sanitization + receipt)
      const token = session?.access_token;
      if (!token) {
        setError('Session expired. Please sign in again.');
        setLoading(false);
        setShowLoading(false);
        setLoadingComplete(false);
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
        setShowLoading(false);
        setLoadingComplete(false);
        return;
      }

      // Session refresh with retry polling — prevents redirect loop (same pattern as bootstrap)
      await supabase.auth.refreshSession();
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          const statusResp = await fetch('/api/onboarding/status', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const statusData = await statusResp.json();
          if (statusData.complete) break;
        } catch (_) { /* retry */ }
      }
      clearDraft();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save onboarding data.';
      setError(msg);
      setShowLoading(false);
      setLoadingComplete(false);
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  // ---------------------------------------------------------------------------
  // Premium loading screen fade-complete → show celebration
  // ---------------------------------------------------------------------------

  const handleLoadingFadeComplete = useCallback(() => {
    setShowLoading(false);
    setLoadingComplete(false);
    setShowCelebration(true);
  }, []);

  // Safety net #1: if onFadeComplete isn't called within 5s after loadingComplete,
  // auto-transition to celebration. Prevents the eternal spinner dead-end.
  useEffect(() => {
    if (loadingComplete && showLoading) {
      const timer = setTimeout(() => {
        setShowLoading(false);
        setLoadingComplete(false);
        setShowCelebration(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [loadingComplete, showLoading]);

  // Safety net #2: absolute maximum loading time (30s). If the bootstrap API call
  // hangs or never resolves, escape the loading screen and show the form with an error.
  // This prevents the infinite spinner when Railway cold-starts or the API is down.
  useEffect(() => {
    if (showLoading) {
      const maxTimer = setTimeout(() => {
        if (!loadingComplete) {
          console.warn('[Onboarding] Loading timeout — bootstrap may have hung');
          setError('Setup is taking longer than expected. Please try again.');
          setShowLoading(false);
          setLoadingComplete(false);
          submittingRef.current = false;
        }
      }, 30000);
      return () => clearTimeout(maxTimer);
    }
  }, [showLoading, loadingComplete]);

  // ---------------------------------------------------------------------------
  // Step transitions
  // ---------------------------------------------------------------------------

  const goNext = () => {
    setError(null);
    setEntityDropdownOpen(false);
    setStep((s) => Math.min(s + 1, 3));
  };

  const goBack = () => {
    setError(null);
    setEntityDropdownOpen(false);
    setStep((s) => Math.max(s - 1, 1));
  };

  // ---------------------------------------------------------------------------
  // Step 1: You & Your Business
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>You & Your Business</Text>
      <Text style={styles.stepSubtitle}>
        Tell us a bit about yourself so Ava can personalize your experience
      </Text>

      {/* Row: First Name + Last Name */}
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor="#555"
            value={form.firstName}
            onChangeText={(v) => updateForm({ firstName: v })}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Last name"
            placeholderTextColor="#555"
            value={form.lastName}
            onChangeText={(v) => updateForm({ lastName: v })}
          />
        </View>
      </View>

      {/* Date of Birth — full width */}
      <Text style={styles.label}>Date of Birth</Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={(e: any) => updateForm({ dateOfBirth: e.target.value })}
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
          style={webDateStyle}
        />
      ) : (
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#555"
          value={form.dateOfBirth}
          onChangeText={(v) => updateForm({ dateOfBirth: v.trim() })}
          autoCapitalize="none"
        />
      )}
      {form.dateOfBirth !== '' && !isAdultDob(form.dateOfBirth) && (
        <Text style={styles.helperErrorText}>Must be 18+</Text>
      )}

      {/* Row: Gender + Role */}
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Gender</Text>
          {Platform.OS === 'web' ? (
            <select
              value={form.gender}
              onChange={(e: any) => updateForm({ gender: e.target.value })}
              style={webSelectStyle}
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          ) : (
            <View style={styles.dropdown}>
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pill, form.gender === opt.value && styles.pillSelected, { marginBottom: 0 }]}
                  onPress={() => updateForm({ gender: opt.value })}
                >
                  <Text style={[styles.pillText, form.gender === opt.value && styles.pillTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Role</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Owner, CEO"
            placeholderTextColor="#555"
            value={form.ownerTitle}
            onChangeText={(v) => updateForm({ ownerTitle: v })}
          />
        </View>
      </View>

      {/* Email read-only */}
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

      {/* Industry + Specialty — linked dropdowns */}
      <View style={Platform.OS === 'web' ? ({ display: 'flex', flexDirection: 'row', gap: 12 } as any) : { gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Industry</Text>
          {Platform.OS === 'web' ? (
            <select
              value={form.industry}
              onChange={(e: any) => updateForm({ industry: e.target.value, industrySpecialty: '' })}
              style={webSelectStyle}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          ) : (
            <>
              <TouchableOpacity style={styles.dropdown} onPress={() => setIndustryDropdownOpen((v) => !v)}>
                <Text style={form.industry ? styles.dropdownValue : styles.dropdownPlaceholder}>{form.industry || 'Select industry'}</Text>
                <Ionicons name={industryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
              </TouchableOpacity>
              {industryDropdownOpen && (
                <View style={styles.dropdownList}>
                  {INDUSTRIES.map((ind) => (
                    <TouchableOpacity key={ind} style={[styles.dropdownItem, form.industry === ind && styles.dropdownItemSelected]}
                      onPress={() => { updateForm({ industry: ind, industrySpecialty: '' }); setIndustryDropdownOpen(false); }}>
                      <Text style={[styles.dropdownItemText, form.industry === ind && styles.dropdownItemTextSelected]}>{ind}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {form.industry && INDUSTRY_SPECIALTIES[form.industry] && (
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Specialty</Text>
            {Platform.OS === 'web' ? (
              <select
                value={form.industrySpecialty}
                onChange={(e: any) => updateForm({ industrySpecialty: e.target.value })}
                style={webSelectStyle}
              >
                <option value="">Select specialty</option>
                {INDUSTRY_SPECIALTIES[form.industry].map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            ) : (
              <>
                <TouchableOpacity style={styles.dropdown} onPress={() => setSpecialtyDropdownOpen((v) => !v)}>
                  <Text style={form.industrySpecialty ? styles.dropdownValue : styles.dropdownPlaceholder}>{form.industrySpecialty || 'Select specialty'}</Text>
                  <Ionicons name={specialtyDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
                </TouchableOpacity>
                {specialtyDropdownOpen && (
                  <View style={styles.dropdownList}>
                    {INDUSTRY_SPECIALTIES[form.industry].map((spec) => (
                      <TouchableOpacity key={spec} style={[styles.dropdownItem, form.industrySpecialty === spec && styles.dropdownItemSelected]}
                        onPress={() => { updateForm({ industrySpecialty: spec }); setSpecialtyDropdownOpen(false); }}>
                        <Text style={[styles.dropdownItemText, form.industrySpecialty === spec && styles.dropdownItemTextSelected]}>{spec}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* Row: Team Size + Years in Business — dropdowns */}
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Team Size</Text>
          {Platform.OS === 'web' ? (
            <select
              value={form.teamSize}
              onChange={(e: any) => updateForm({ teamSize: e.target.value })}
              style={webSelectStyle}
            >
              <option value="">Select team size</option>
              {TEAM_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          ) : (
            <View style={[styles.pillRow, { flexWrap: 'wrap' }]}>
              {TEAM_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[styles.pill, form.teamSize === size && styles.pillSelected]}
                  onPress={() => updateForm({ teamSize: size })}
                >
                  <Text style={[styles.pillText, form.teamSize === size && styles.pillTextSelected]}>{size}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Years in Business</Text>
          {Platform.OS === 'web' ? (
            <select
              value={form.yearsInBusiness}
              onChange={(e: any) => updateForm({ yearsInBusiness: e.target.value })}
              style={webSelectStyle}
            >
              <option value="">Select years</option>
              {YEARS_OPTIONS.map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          ) : (
            <View style={[styles.pillRow, { flexWrap: 'wrap' }]}>
              {YEARS_OPTIONS.map((yr) => (
                <TouchableOpacity
                  key={yr}
                  style={[styles.pill, form.yearsInBusiness === yr && styles.pillSelected]}
                  onPress={() => updateForm({ yearsInBusiness: yr })}
                >
                  <Text style={[styles.pillText, form.yearsInBusiness === yr && styles.pillTextSelected]}>{yr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Entity Type */}
      <Text style={styles.label}>Entity Type</Text>
      {Platform.OS === 'web' ? (
        <select
          value={form.entityType}
          onChange={(e: any) => updateForm({ entityType: e.target.value })}
          style={webSelectStyle}
        >
          <option value="">Select entity type</option>
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>
      ) : (
        <>
          <TouchableOpacity style={styles.dropdown} onPress={() => setEntityDropdownOpen((v) => !v)}>
            <Text style={form.entityType ? styles.dropdownValue : styles.dropdownPlaceholder}>
              {form.entityType || 'Select entity type'}
            </Text>
            <Ionicons name={entityDropdownOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#888" />
          </TouchableOpacity>
          {entityDropdownOpen && (
            <View style={styles.dropdownList}>
              {ENTITY_TYPES.map((et) => (
                <TouchableOpacity
                  key={et}
                  style={[styles.dropdownItem, form.entityType === et && styles.dropdownItemSelected]}
                  onPress={() => { updateForm({ entityType: et }); setEntityDropdownOpen(false); }}
                >
                  <Text style={[styles.dropdownItemText, form.entityType === et && styles.dropdownItemTextSelected]}>{et}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
  // ---------------------------------------------------------------------------
  // Step 2: Address & Location
  // ---------------------------------------------------------------------------

  const renderStep2 = () => {
    const isWeb = Platform.OS === 'web';

    const renderAddressField = (
      searchText: string,
      address: AddressFields,
      validated: boolean,
      suggestions: any[],
      onChangeText: (t: string) => void,
      onSelect: (s: any) => void,
      onClear: () => void,
      placeholder: string,
    ) => {
      const confirmed = !!address.line1;
      if (confirmed) {
        return (
          <View style={styles.confirmedAddressRow}>
            <Ionicons name={validated ? 'checkmark-circle' : 'location'} size={18} color={validated ? '#22C55E' : ACCENT} />
            <Text style={styles.confirmedAddressText} numberOfLines={2}>{searchText}</Text>
            {validated && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedBadgeText}>Verified</Text>
              </View>
            )}
            <TouchableOpacity onPress={onClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.changeLink}>Change</Text>
            </TouchableOpacity>
          </View>
        );
      }
      return (
        <View style={isWeb ? ({ position: 'relative', zIndex: 200 } as any) : {}}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={18} color="#888" style={styles.searchIcon} />
            {isWeb ? (
              <input
                type="text"
                placeholder={placeholder}
                value={searchText}
                onChange={(e: any) => onChangeText(e.target.value)}
                style={webInputStyle}
                autoComplete="off"
              />
            ) : (
              <TextInput
                style={{ flex: 1, color: '#fff', fontSize: 16, paddingVertical: 14, paddingRight: 16 }}
                placeholder={placeholder}
                placeholderTextColor="#555"
                value={searchText}
                onChangeText={onChangeText}
              />
            )}
            {searchText.length > 0 && (
              <TouchableOpacity onPress={onClear} style={{ paddingRight: 14 }}>
                <Ionicons name="close-circle" size={18} color="#555" />
              </TouchableOpacity>
            )}
          </View>
          {suggestions.length > 0 && (
            <View style={styles.placesDropdown}>
              {suggestions.map((s: any, i: number) => (
                <TouchableOpacity key={i} style={styles.placesItem} onPress={() => onSelect(s)}>
                  <Ionicons name="location-outline" size={14} color={ACCENT} style={{ marginRight: 10, flexShrink: 0 } as any} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.placesItemMain} numberOfLines={1}>
                      {s.placePrediction?.structuredFormat?.mainText?.text || s.placePrediction?.text?.text || ''}
                    </Text>
                    <Text style={styles.placesItemSub} numberOfLines={1}>
                      {s.placePrediction?.structuredFormat?.secondaryText?.text || ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      );
    };

    return (
      <View>
        <Text style={styles.stepTitle}>Address & Location</Text>
        <Text style={styles.stepSubtitle}>
          Your address helps configure taxes, timezone, and currency automatically
        </Text>

        <Text style={styles.label}>Home Address</Text>
        {renderAddressField(
          form.homeSearchText,
          form.homeAddress,
          homeValidated,
          homeSuggestions,
          onHomeSearchChange,
          onHomeSelect,
          onHomeClear,
          'Search your home address…',
        )}

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

        <View style={[styles.toggleRow, { marginTop: 24 }]}>
          <Text style={styles.toggleLabel}>Business address same as home?</Text>
          <Switch
            value={form.businessAddressSameAsHome}
            onValueChange={(v) => updateForm({ businessAddressSameAsHome: v })}
            trackColor={{ false: '#333', true: ACCENT_LIGHT }}
            thumbColor={form.businessAddressSameAsHome ? ACCENT : '#888'}
          />
        </View>

        {!form.businessAddressSameAsHome && (
          <View style={isWeb ? ({ zIndex: 100 } as any) : {}}>
            <Text style={[styles.label, { marginTop: 20 }]}>Business Address</Text>
            {renderAddressField(
              form.businessSearchText,
              form.businessAddress,
              businessValidated,
              businessSuggestions,
              onBusinessSearchChange,
              onBusinessSelect,
              onBusinessClear,
              'Search business address…',
            )}
          </View>
        )}
      </View>
    );
  };
  // ---------------------------------------------------------------------------
  // Step 3: Services & Go
  // ---------------------------------------------------------------------------

  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Final Details & Go</Text>
      <Text style={styles.stepSubtitle}>
        A few more details so Ava can tailor your experience perfectly.
      </Text>

      {/* Income Range */}
      <Text style={styles.label}>Annual Income Range</Text>
      {Platform.OS === 'web' ? (
        <select
          value={form.incomeRange}
          onChange={(e: any) => updateForm({ incomeRange: e.target.value })}
          style={webSelectStyle}
        >
          <option value="">Select income range</option>
          {INCOME_RANGES.map((ir) => (
            <option key={ir.value} value={ir.value}>{ir.label}</option>
          ))}
        </select>
      ) : (
        <View style={[styles.pillRow, { flexWrap: 'wrap', gap: 8 }]}>
          {INCOME_RANGES.map((ir) => (
            <TouchableOpacity
              key={ir.value}
              style={[styles.pill, form.incomeRange === ir.value && styles.pillSelected]}
              onPress={() => updateForm({ incomeRange: ir.value })}
            >
              <Text style={[styles.pillText, form.incomeRange === ir.value && styles.pillTextSelected]}>{ir.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Referral Source */}
      <Text style={[styles.label, { marginTop: 18 }]}>How did you hear about Aspire?</Text>
      <View style={styles.chipGrid}>
        {REFERRAL_SOURCES.map((rs) => (
          <TouchableOpacity
            key={rs.value}
            style={[styles.chip, form.referralSource === rs.value && styles.chipSelected]}
            onPress={() => updateForm({ referralSource: rs.value })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons
                name={rs.icon as keyof typeof Ionicons.glyphMap}
                size={14}
                color={form.referralSource === rs.value ? ACCENT : '#888'}
              />
              <Text style={[styles.chipText, form.referralSource === rs.value && styles.chipTextSelected]}>
                {rs.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
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
  // Celebration modal dismiss → navigate to home
  // ---------------------------------------------------------------------------
  const handleEnterAspire = async () => {
    // Refresh session NOW — updates the JWT with the new suite_id so the auth
    // gate in _layout.tsx sees onboarding as complete and won't redirect back.
    // We kept the celebration modal visible during this (no setShowCelebration(false))
    // to avoid a flash of the onboarding form.
    await supabase.auth.refreshSession();
    router.replace('/(tabs)');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Show premium loading screen during bootstrap API call
  // Pure CSS animations — no 3D libs, no lazy loading, guaranteed to work on all platforms.
  if (showLoading) {
    return (
      <PremiumLoadingScreen
        isComplete={loadingComplete}
        onFadeComplete={handleLoadingFadeComplete}
      />
    );
  }

  // Show celebration modal after successful bootstrap
  if (showCelebration && celebrationData) {
    return (
      <CelebrationModal
        businessName={celebrationData.businessName}
        suiteDisplayId={celebrationData.suiteDisplayId}
        officeDisplayId={celebrationData.officeDisplayId}
        onEnter={handleEnterAspire}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Logo — top-left, no border, transparent bg, matches login/landing height */}
      {Platform.OS === 'web' ? (
        <div style={{ position: 'absolute', top: 0, left: 0, zIndex: 10, pointerEvents: 'none' } as React.CSSProperties}>
          <img
            src="/aspire-logo-full.png"
            alt="Aspire"
            style={{ height: 140, objectFit: 'contain', display: 'block' } as React.CSSProperties}
          />
        </div>
      ) : (
        <View style={styles.logoWrap}>
          <View style={{ width: 32, height: 32 }}>
            <Ionicons name="trending-up" size={28} color="#3B82F6" />
          </View>
        </View>
      )}

      <View style={styles.inner}>
        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <View style={styles.stepIndicatorRow}>
          <Text style={styles.stepIndicator}>Step {step} of 3</Text>
          <Text style={styles.stepName}>
            {step === 1 ? 'You & Your Business' : step === 2 ? 'Address & Location' : 'Final Details & Go'}
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
                Platform.OS === 'web' ? ({ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)' } as any) : null,
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
                Platform.OS === 'web' ? ({ background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)' } as any) : null,
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

const ACCENT = '#3B82F6';
const ACCENT_LIGHT = 'rgba(59,130,246,0.15)';
const ACCENT_GLOW = 'rgba(59,130,246,0.35)';
const BG = '#000000';
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
const webSelectStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 10,
  padding: '14px 40px 14px 16px',
  fontSize: 16,
  color: '#fff',
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none' as any,
  WebkitAppearance: 'none' as any,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23888' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  marginTop: 6,
};
const webDateStyle: React.CSSProperties = {
  width: '100%',
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 10,
  padding: '14px 16px',
  fontSize: 16,
  color: '#fff',
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  marginTop: 6,
  colorScheme: 'dark',
  boxSizing: 'border-box' as any,
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
  logoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 10,
    padding: 16,
  },
  inner: {
    maxWidth: 640,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
    paddingTop: 52,
  },

  // Progress bar
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#1e1e1e',
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
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
  helperErrorText: {
    color: ERROR_RED,
    fontSize: 12,
    marginTop: 6,
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
  // 2-column field pairing
  fieldRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },

  // Google Places confirmed address
  confirmedAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#0d1a2e',
    borderWidth: 1,
    borderColor: '#1d3a5e',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexWrap: 'wrap' as const,
  },
  confirmedAddressText: {
    flex: 1,
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    minWidth: 0,
  },
  verifiedBadge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  verifiedBadgeText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '700',
  },
  changeLink: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },

  // Google Places suggestion dropdown
  placesDropdown: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, zIndex: 9999 } : {}),
  } as ViewStyle,
  placesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  placesItemMain: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  placesItemSub: {
    color: '#666',
    fontSize: 12,
    marginTop: 1,
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  nominatimDropdown: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, zIndex: 9999 } : {}),
  } as ViewStyle,
  nominatimItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  nominatimItemText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    lineHeight: 19,
  },
});
