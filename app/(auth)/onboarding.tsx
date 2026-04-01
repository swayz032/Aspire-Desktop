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
  Pressable,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useSupabase } from '@/providers';
import { supabase } from '@/lib/supabase';
import { CelebrationModal } from '@/components/CelebrationModal';
import { PremiumLoadingScreen } from '@/components/PremiumLoadingScreen';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';
import { devError } from '@/lib/devLog';
import { Colors, Spacing, BorderRadius, Typography } from '@/constants/tokens';

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
  { value: 'prefer_not', label: 'Prefer not to say' },
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
// Step configuration
// ---------------------------------------------------------------------------

const STEP_COUNT = 4;
const STEP_LABELS = ['About You', 'Business', 'Addresses', 'Review'];

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.9,
};

// ---------------------------------------------------------------------------
// Modal design tokens (local)
// ---------------------------------------------------------------------------

const MODAL_WIDTH = 760;
const MODAL_SURFACE = '#111113';
const MODAL_RADIUS = 20;
const MODAL_BORDER_START = 'rgba(59,130,246,0.25)';
const MODAL_BORDER_END = 'rgba(255,255,255,0.06)';
const OVERLAY_BG = 'rgba(0,0,0,0.85)';

const ACCENT = Colors.accent.cyan;
const ACCENT_LIGHT = Colors.accent.cyanLight;
const ACCENT_GLOW = 'rgba(59,130,246,0.35)';
const SUCCESS_GREEN = Colors.semantic.success;
const TEXT_PRIMARY = Colors.text.primary;
const TEXT_SECONDARY = Colors.text.secondary;
const TEXT_MUTED = Colors.text.muted;
const TEXT_DIM = Colors.text.disabled;
const ERROR_RED = Colors.semantic.error;
const SURFACE = Colors.surface.card;
const BORDER = Colors.border.default;
const BORDER_STRONG = Colors.border.strong;

// ---------------------------------------------------------------------------
// Web-only styles for native HTML inputs
// ---------------------------------------------------------------------------

const webInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  color: TEXT_PRIMARY,
  fontSize: 15,
  padding: '12px 14px 12px 0',
  fontFamily: 'inherit',
  width: '100%',
};

const webSelectStyle: React.CSSProperties = {
  width: '100%',
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: '12px 36px 12px 14px',
  fontSize: 15,
  color: TEXT_PRIMARY,
  cursor: 'pointer',
  outline: 'none',
  appearance: 'none' as any,
  WebkitAppearance: 'none' as any,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236e6e73' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  marginTop: 4,
};

const webDateStyle: React.CSSProperties = {
  width: '100%',
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: '12px 14px',
  fontSize: 15,
  color: TEXT_PRIMARY,
  cursor: 'pointer',
  outline: 'none',
  fontFamily: 'inherit',
  marginTop: 4,
  colorScheme: 'dark',
  boxSizing: 'border-box' as any,
};

// ---------------------------------------------------------------------------
// Step Indicator Component
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  completedSteps,
}: {
  currentStep: number;
  completedSteps: Set<number>;
}) {
  return (
    <View style={si.container}>
      <View style={si.dotsRow}>
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const isActive = stepNum === currentStep;
          const isComplete = completedSteps.has(stepNum);
          const isPast = stepNum < currentStep;

          return (
            <React.Fragment key={label}>
              {/* Connector line before dot (skip first) */}
              {i > 0 && (
                <View
                  style={[
                    si.connector,
                    (isPast || isComplete) && si.connectorActive,
                  ]}
                />
              )}
              <View style={si.stepColumn}>
                <View
                  style={[
                    si.dot,
                    isActive && si.dotActive,
                    isComplete && si.dotComplete,
                    isPast && !isComplete && si.dotPast,
                  ]}
                  accessibilityRole="text"
                  accessibilityLabel={`Step ${stepNum}: ${label}${isActive ? ', current' : ''}${isComplete ? ', completed' : ''}`}
                >
                  {isComplete ? (
                    <Ionicons name="checkmark" size={12} color={TEXT_PRIMARY} />
                  ) : (
                    <Text
                      style={[
                        si.dotText,
                        isActive && si.dotTextActive,
                        isPast && si.dotTextPast,
                      ]}
                    >
                      {stepNum}
                    </Text>
                  )}
                </View>
                <Text
                  style={[
                    si.label,
                    isActive && si.labelActive,
                    (isComplete || isPast) && si.labelPast,
                  ]}
                >
                  {label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}

const si = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepColumn: {
    alignItems: 'center',
    gap: Spacing.sm,
    width: 72,
  },
  connector: {
    height: 2,
    flex: 1,
    backgroundColor: Colors.border.subtle,
    marginTop: 14, // vertically center with dot (28/2)
    maxWidth: 64,
  },
  connectorActive: {
    backgroundColor: SUCCESS_GREEN,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border.default,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(59,130,246,0.12)',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 12px rgba(59,130,246,0.4)` } as unknown as ViewStyle)
      : {}),
  },
  dotComplete: {
    borderColor: SUCCESS_GREEN,
    backgroundColor: SUCCESS_GREEN,
  },
  dotPast: {
    borderColor: Colors.border.strong,
    backgroundColor: Colors.border.subtle,
  },
  dotText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  dotTextActive: {
    color: ACCENT,
  },
  dotTextPast: {
    color: Colors.text.tertiary,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  labelActive: {
    color: TEXT_PRIMARY,
    fontWeight: '600',
  },
  labelPast: {
    color: Colors.text.tertiary,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function OnboardingContent() {
  const router = useRouter();
  const { suiteId, session } = useSupabase();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bootstrappedSuiteId, setBootstrappedSuiteId] = useState<string | null>(null);

  // Double-submission guard (Bug fix: prevents concurrent bootstrap calls)
  const submittingRef = useRef(false);
  // Tracks when loading screen appeared (for min 12s enforcement)
  const loadingStartRef = useRef(Date.now());

  // Celebration flow state (Wave 4)
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    businessName: string;
    suiteDisplayId: string;
    officeDisplayId: string;
    ownerName: string;
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

  // Step animation (reanimated)
  const slideOffset = useSharedValue(0);
  const slideOpacity = useSharedValue(1);

  // Track completed steps for indicator
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Convenience updater
  const updateForm = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      saveDraft(next);
      return next;
    });
  }, []);

  // Cleanup debounce timers on unmount (prevents memory leak)
  useEffect(() => {
    return () => {
      if (homeDebounceRef.current) clearTimeout(homeDebounceRef.current);
      if (businessDebounceRef.current) clearTimeout(businessDebounceRef.current);
    };
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

  // Keyboard: Enter to advance
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        // Only advance if current step is valid
        if (step === 1 && canProceedStep1) goNext();
        else if (step === 2 && canProceedStep2) goNext();
        else if (step === 3) goNext(); // Step 3 always allows advance to review
        else if (step === 4 && canSubmit && !loading) handleComplete();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

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
      if (data.error) { devError('[Places] API error:', data.error); onResults([]); return; }
      onResults(data.suggestions || []);
    } catch (e: any) { devError('[Places] fetch failed:', e?.message); onResults([]); }
  };

  const getPlaceDetails = async (placeId: string): Promise<AddressFields | null> => {
    try {
      const res = await fetch(`/api/places/details/${encodeURIComponent(placeId)}`);
      const data = await res.json();
      if (data.error) { devError('[Places] Details error:', data.error); return null; }
      return parsePlaceDetails(data);
    } catch (e: any) { devError('[Places] details failed:', e?.message); return null; }
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
      } else {
        setError('Could not load address details. Please try a different address.');
        updateForm({ homeSearchText: '' });
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
      } else {
        setError('Could not load address details. Please try a different address.');
        updateForm({ businessSearchText: '' });
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
    form.firstName.trim() !== '' &&
    form.gender !== '' &&
    isAdultDob(form.dateOfBirth);

  const canProceedStep2 =
    form.businessName.trim() !== '' &&
    form.industry !== '' &&
    form.industrySpecialty !== '' &&
    form.teamSize !== '' &&
    form.entityType !== '';

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

  const canProceedStep3 = hasHomeAddress && hasBusinessAddress;

  const canSubmit = form.consentPersonalization;

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleComplete = async () => {
    // Double-submission guard
    if (submittingRef.current) return;

    // Client-side validation before submit (catches trim-to-empty edge case)
    if (!form.businessName.trim()) { setError('Business name is required.'); return; }
    if (!form.firstName.trim()) { setError('First name is required.'); return; }
    if (!form.industry) { setError('Please select your industry.'); return; }
    if (!form.teamSize) { setError('Please select your team size.'); return; }

    submittingRef.current = true;
    setLoading(true);
    setShowLoading(true);
    setError(null);
    loadingStartRef.current = Date.now();

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
          setShowLoading(false);
          setLoadingComplete(false);
          return;
        }

        const bootstrapResult = await resp.json();
        const { suiteId: newSuiteId, suiteDisplayId, officeDisplayId, businessName: bName } = bootstrapResult;
        setBootstrappedSuiteId(newSuiteId);

        // NOTE: DO NOT call supabase.auth.refreshSession() here.
        // Refreshing the session updates the JWT with the new suite_id, which
        // triggers useAuthGate in _layout.tsx → router.replace('/(tabs)') →
        // UNMOUNTS this component before the celebration modal renders.
        // Session refresh is deferred to handleEnterAspire().

        // Store celebration data — loading screen will fade, then celebration shows.
        // Enforce minimum 12s loading so n8n intake-activation webhook and Adam
        // daily brief have time to populate the Founder Hub before the user lands.
        const elapsed = Date.now() - loadingStartRef.current;
        const MIN_LOADING_MS = 12000;
        const remaining = Math.max(0, MIN_LOADING_MS - elapsed);

        const celebData = {
          businessName: bName || form.businessName.trim(),
          suiteDisplayId: suiteDisplayId || '',
          officeDisplayId: officeDisplayId || '',
          ownerName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
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

  // Safety net: if onFadeComplete doesn't fire within 3s after loadingComplete,
  // auto-transition to celebration. Prevents permanent loading screen if the
  // reanimated fade callback fails (known issue on Expo web with runOnJS).
  useEffect(() => {
    if (loadingComplete && showLoading) {
      const timer = setTimeout(() => {
        console.warn('[Onboarding] Safety net: auto-transitioning to celebration');
        setShowLoading(false);
        setLoadingComplete(false);
        setShowCelebration(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [loadingComplete, showLoading]);

  // ---------------------------------------------------------------------------
  // Step transitions (animated)
  // ---------------------------------------------------------------------------

  const animateToStep = useCallback((targetStep: number) => {
    const direction = targetStep > step ? 1 : -1;
    // Slide out current step
    slideOpacity.value = withTiming(0, { duration: 120, easing: Easing.in(Easing.ease) });
    slideOffset.value = withTiming(direction * -40, { duration: 120, easing: Easing.in(Easing.ease) }, () => {
      // After slide-out, snap to entry position and slide in
      runOnJS(setStep)(targetStep);
      slideOffset.value = direction * 40;
      slideOpacity.value = 0;
      slideOffset.value = withSpring(0, SPRING_CONFIG);
      slideOpacity.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.ease) });
    });
  }, [step, slideOffset, slideOpacity]);

  const goNext = useCallback(() => {
    setError(null);
    setEntityDropdownOpen(false);
    setIndustryDropdownOpen(false);
    setSpecialtyDropdownOpen(false);
    // Mark current step as complete
    setCompletedSteps((prev) => new Set(prev).add(step));
    const nextStep = Math.min(step + 1, STEP_COUNT);
    animateToStep(nextStep);
  }, [step, animateToStep]);

  const goBack = useCallback(() => {
    setError(null);
    setEntityDropdownOpen(false);
    setIndustryDropdownOpen(false);
    setSpecialtyDropdownOpen(false);
    const prevStep = Math.max(step - 1, 1);
    animateToStep(prevStep);
  }, [step, animateToStep]);

  const goToStep = useCallback((targetStep: number) => {
    if (targetStep === step) return;
    setError(null);
    animateToStep(targetStep);
  }, [step, animateToStep]);

  const stepAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideOffset.value }],
    opacity: slideOpacity.value,
  }));

  // ---------------------------------------------------------------------------
  // Step 1: About You
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <View>
      <Text style={s.stepTitle} accessibilityRole="header">About You</Text>
      <Text style={s.stepSubtitle}>
        Tell us about yourself so Ava can personalize your experience
      </Text>

      {/* Row: First Name + Last Name */}
      <View style={s.fieldRow}>
        <View style={s.fieldRowItem}>
          <Text style={s.label}>First Name <Text style={s.requiredStar}>*</Text></Text>
          <TextInput
            style={s.input}
            placeholder="First name"
            placeholderTextColor={TEXT_DIM}
            value={form.firstName}
            onChangeText={(v) => updateForm({ firstName: v })}
            accessibilityLabel="First name"
          />
        </View>
        <View style={s.fieldRowItem}>
          <Text style={s.label}>Last Name</Text>
          <TextInput
            style={s.input}
            placeholder="Last name"
            placeholderTextColor={TEXT_DIM}
            value={form.lastName}
            onChangeText={(v) => updateForm({ lastName: v })}
            accessibilityLabel="Last name"
          />
        </View>
      </View>

      {/* Date of Birth */}
      <Text style={s.label}>Date of Birth <Text style={s.requiredStar}>*</Text></Text>
      {Platform.OS === 'web' ? (
        <input
          type="date"
          value={form.dateOfBirth}
          onChange={(e: any) => updateForm({ dateOfBirth: e.target.value })}
          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
          style={webDateStyle}
          aria-label="Date of birth"
        />
      ) : (
        <TextInput
          style={s.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={TEXT_DIM}
          value={form.dateOfBirth}
          onChangeText={(v) => updateForm({ dateOfBirth: v.trim() })}
          autoCapitalize="none"
          accessibilityLabel="Date of birth"
        />
      )}
      {form.dateOfBirth !== '' && !isAdultDob(form.dateOfBirth) && (
        <Text style={s.helperErrorText} accessibilityRole="alert">Must be 18 or older</Text>
      )}

      {/* Gender */}
      <Text style={s.label}>Gender <Text style={s.requiredStar}>*</Text></Text>
      <View style={s.pillRow} accessibilityRole="radiogroup" accessibilityLabel="Gender selection">
        {GENDER_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value}
            style={[s.pill, form.gender === opt.value && s.pillSelected]}
            onPress={() => updateForm({ gender: opt.value })}
            accessibilityRole="radio"
            accessibilityState={{ checked: form.gender === opt.value }}
            accessibilityLabel={opt.label}
          >
            <Text style={[s.pillText, form.gender === opt.value && s.pillTextSelected]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Title/Role */}
      <Text style={s.label}>Title / Role</Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Owner, CEO"
        placeholderTextColor={TEXT_DIM}
        value={form.ownerTitle}
        onChangeText={(v) => updateForm({ ownerTitle: v })}
        accessibilityLabel="Title or role"
      />

      {/* Email read-only */}
      {session?.user?.email && (
        <>
          <Text style={s.label}>Email</Text>
          <View style={s.readOnlyField}>
            <Text style={s.readOnlyText} selectable>{session.user.email}</Text>
            <Ionicons name="checkmark-circle" size={16} color={SUCCESS_GREEN} />
          </View>
        </>
      )}
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 2: Your Business
  // ---------------------------------------------------------------------------

  const renderStep2 = () => (
    <View>
      <Text style={s.stepTitle} accessibilityRole="header">Your Business</Text>
      <Text style={s.stepSubtitle}>
        Help us understand your business to configure Aspire perfectly
      </Text>

      {/* Business Name */}
      <Text style={s.label}>Business Name <Text style={s.requiredStar}>*</Text></Text>
      <TextInput
        style={s.input}
        placeholder="e.g. Apex Plumbing LLC"
        placeholderTextColor={TEXT_DIM}
        value={form.businessName}
        onChangeText={(v) => updateForm({ businessName: v })}
        accessibilityLabel="Business name"
      />

      {/* Industry + Specialty — linked dropdowns */}
      <View style={s.fieldRow}>
        <View style={s.fieldRowItem}>
          <Text style={s.label}>Industry <Text style={s.requiredStar}>*</Text></Text>
          {Platform.OS === 'web' ? (
            <select
              value={form.industry}
              onChange={(e: any) => updateForm({ industry: e.target.value, industrySpecialty: '' })}
              style={webSelectStyle}
              aria-label="Industry"
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          ) : (
            <>
              <TouchableOpacity
                style={s.dropdown}
                onPress={() => setIndustryDropdownOpen((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={`Industry: ${form.industry || 'Select industry'}`}
              >
                <Text style={form.industry ? s.dropdownValue : s.dropdownPlaceholder}>
                  {form.industry || 'Select industry'}
                </Text>
                <Ionicons name={industryDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={TEXT_MUTED} />
              </TouchableOpacity>
              {industryDropdownOpen && (
                <View style={s.dropdownList}>
                  {INDUSTRIES.map((ind) => (
                    <TouchableOpacity
                      key={ind}
                      style={[s.dropdownItem, form.industry === ind && s.dropdownItemSelected]}
                      onPress={() => { updateForm({ industry: ind, industrySpecialty: '' }); setIndustryDropdownOpen(false); }}
                    >
                      <Text style={[s.dropdownItemText, form.industry === ind && s.dropdownItemTextSelected]}>{ind}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {form.industry && INDUSTRY_SPECIALTIES[form.industry] && (
          <View style={s.fieldRowItem}>
            <Text style={s.label}>Specialty <Text style={s.requiredStar}>*</Text></Text>
            {Platform.OS === 'web' ? (
              <select
                value={form.industrySpecialty}
                onChange={(e: any) => updateForm({ industrySpecialty: e.target.value })}
                style={webSelectStyle}
                aria-label="Industry specialty"
              >
                <option value="">Select specialty</option>
                {INDUSTRY_SPECIALTIES[form.industry].map((spec) => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            ) : (
              <>
                <TouchableOpacity
                  style={s.dropdown}
                  onPress={() => setSpecialtyDropdownOpen((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={`Specialty: ${form.industrySpecialty || 'Select specialty'}`}
                >
                  <Text style={form.industrySpecialty ? s.dropdownValue : s.dropdownPlaceholder}>
                    {form.industrySpecialty || 'Select specialty'}
                  </Text>
                  <Ionicons name={specialtyDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={TEXT_MUTED} />
                </TouchableOpacity>
                {specialtyDropdownOpen && (
                  <View style={s.dropdownList}>
                    {INDUSTRY_SPECIALTIES[form.industry].map((spec) => (
                      <TouchableOpacity
                        key={spec}
                        style={[s.dropdownItem, form.industrySpecialty === spec && s.dropdownItemSelected]}
                        onPress={() => { updateForm({ industrySpecialty: spec }); setSpecialtyDropdownOpen(false); }}
                      >
                        <Text style={[s.dropdownItemText, form.industrySpecialty === spec && s.dropdownItemTextSelected]}>{spec}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>

      {/* Team Size */}
      <Text style={s.label}>Team Size <Text style={s.requiredStar}>*</Text></Text>
      <View style={s.pillRow} accessibilityRole="radiogroup" accessibilityLabel="Team size">
        {TEAM_SIZES.map((size) => (
          <Pressable
            key={size}
            style={[s.pill, form.teamSize === size && s.pillSelected]}
            onPress={() => updateForm({ teamSize: size })}
            accessibilityRole="radio"
            accessibilityState={{ checked: form.teamSize === size }}
            accessibilityLabel={size}
          >
            <Text style={[s.pillText, form.teamSize === size && s.pillTextSelected]}>{size}</Text>
          </Pressable>
        ))}
      </View>

      {/* Entity Type */}
      <Text style={s.label}>Entity Type <Text style={s.requiredStar}>*</Text></Text>
      {Platform.OS === 'web' ? (
        <select
          value={form.entityType}
          onChange={(e: any) => updateForm({ entityType: e.target.value })}
          style={webSelectStyle}
          aria-label="Entity type"
        >
          <option value="">Select entity type</option>
          {ENTITY_TYPES.map((et) => (
            <option key={et} value={et}>{et}</option>
          ))}
        </select>
      ) : (
        <>
          <TouchableOpacity
            style={s.dropdown}
            onPress={() => setEntityDropdownOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={`Entity type: ${form.entityType || 'Select entity type'}`}
          >
            <Text style={form.entityType ? s.dropdownValue : s.dropdownPlaceholder}>
              {form.entityType || 'Select entity type'}
            </Text>
            <Ionicons name={entityDropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={TEXT_MUTED} />
          </TouchableOpacity>
          {entityDropdownOpen && (
            <View style={s.dropdownList}>
              {ENTITY_TYPES.map((et) => (
                <TouchableOpacity
                  key={et}
                  style={[s.dropdownItem, form.entityType === et && s.dropdownItemSelected]}
                  onPress={() => { updateForm({ entityType: et }); setEntityDropdownOpen(false); }}
                >
                  <Text style={[s.dropdownItemText, form.entityType === et && s.dropdownItemTextSelected]}>{et}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Years in Business */}
      <Text style={s.label}>Years in Business</Text>
      <View style={s.pillRow} accessibilityRole="radiogroup" accessibilityLabel="Years in business">
        {YEARS_OPTIONS.map((yr) => (
          <Pressable
            key={yr}
            style={[s.pill, form.yearsInBusiness === yr && s.pillSelected]}
            onPress={() => updateForm({ yearsInBusiness: yr })}
            accessibilityRole="radio"
            accessibilityState={{ checked: form.yearsInBusiness === yr }}
            accessibilityLabel={`${yr} years`}
          >
            <Text style={[s.pillText, form.yearsInBusiness === yr && s.pillTextSelected]}>{yr}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Step 3: Addresses
  // ---------------------------------------------------------------------------

  const renderStep3 = () => {
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
          <View style={s.confirmedAddressRow}>
            <Ionicons name={validated ? 'checkmark-circle' : 'location'} size={18} color={validated ? SUCCESS_GREEN : ACCENT} />
            <Text style={s.confirmedAddressText} numberOfLines={2}>{searchText}</Text>
            {validated && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedBadgeText}>Verified</Text>
              </View>
            )}
            <Pressable
              onPress={onClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={s.changeLinkWrap}
              accessibilityRole="button"
              accessibilityLabel="Change address"
            >
              <Text style={s.changeLink}>Change</Text>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={isWeb ? ({ position: 'relative', zIndex: 200 } as any) : {}}>
          <View style={s.searchInputWrap}>
            <Ionicons name="search-outline" size={16} color={TEXT_MUTED} style={s.searchIcon} />
            {isWeb ? (
              <input
                type="text"
                placeholder={placeholder}
                value={searchText}
                onChange={(e: any) => onChangeText(e.target.value)}
                style={webInputStyle}
                autoComplete="off"
                aria-label={placeholder}
              />
            ) : (
              <TextInput
                style={{ flex: 1, color: TEXT_PRIMARY, fontSize: 15, paddingVertical: 12, paddingRight: 14 }}
                placeholder={placeholder}
                placeholderTextColor={TEXT_DIM}
                value={searchText}
                onChangeText={onChangeText}
                accessibilityLabel={placeholder}
              />
            )}
            {searchText.length > 0 && (
              <Pressable
                onPress={onClear}
                style={{ paddingRight: 12, minHeight: 44, justifyContent: 'center' }}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={16} color={TEXT_MUTED} />
              </Pressable>
            )}
          </View>
          {suggestions.length > 0 && (
            <View style={s.placesDropdown}>
              {suggestions.map((sg: any, i: number) => (
                <Pressable
                  key={i}
                  style={s.placesItem}
                  onPress={() => onSelect(sg)}
                  accessibilityRole="button"
                  accessibilityLabel={sg.placePrediction?.text?.text || 'Address suggestion'}
                >
                  <Ionicons name="location-outline" size={14} color={ACCENT} style={{ marginRight: 10, flexShrink: 0 } as any} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.placesItemMain} numberOfLines={1}>
                      {sg.placePrediction?.structuredFormat?.mainText?.text || sg.placePrediction?.text?.text || ''}
                    </Text>
                    <Text style={s.placesItemSub} numberOfLines={1}>
                      {sg.placePrediction?.structuredFormat?.secondaryText?.text || ''}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      );
    };

    return (
      <View>
        <Text style={s.stepTitle} accessibilityRole="header">Addresses</Text>
        <Text style={s.stepSubtitle}>
          Your address configures taxes, timezone, and currency automatically
        </Text>

        <Text style={s.label}>Home Address <Text style={s.requiredStar}>*</Text></Text>
        {renderAddressField(
          form.homeSearchText,
          form.homeAddress,
          homeValidated,
          homeSuggestions,
          onHomeSearchChange,
          onHomeSelect,
          onHomeClear,
          'Search your home address...',
        )}

        {(form.timezone || form.currency) && (
          <View style={s.autoDetectedRow}>
            {form.timezone ? (
              <View style={s.autoTag}>
                <Ionicons name="time-outline" size={14} color={ACCENT} />
                <Text style={s.autoTagText}>{form.timezone}</Text>
              </View>
            ) : null}
            {form.currency ? (
              <View style={s.autoTag}>
                <Ionicons name="cash-outline" size={14} color={ACCENT} />
                <Text style={s.autoTagText}>{form.currency}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={s.toggleRow}>
          <Text style={s.toggleLabel}>Business address same as home</Text>
          <Switch
            value={form.businessAddressSameAsHome}
            onValueChange={(v) => updateForm({ businessAddressSameAsHome: v })}
            trackColor={{ false: Colors.border.default, true: ACCENT_LIGHT }}
            thumbColor={form.businessAddressSameAsHome ? ACCENT : TEXT_MUTED}
            accessibilityLabel="Business address same as home"
          />
        </View>

        {!form.businessAddressSameAsHome && (
          <View style={Platform.OS === 'web' ? ({ zIndex: 100 } as any) : {}}>
            <Text style={[s.label, { marginTop: Spacing.xl }]}>Business Address <Text style={s.requiredStar}>*</Text></Text>
            {renderAddressField(
              form.businessSearchText,
              form.businessAddress,
              businessValidated,
              businessSuggestions,
              onBusinessSearchChange,
              onBusinessSelect,
              onBusinessClear,
              'Search business address...',
            )}
          </View>
        )}
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Step 4: Review & Launch
  // ---------------------------------------------------------------------------

  const renderStep4 = () => {
    const formatAddress = (addr: AddressFields): string => {
      if (!addr.line1) return 'Not provided';
      const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.zip].filter(Boolean);
      return parts.join(', ');
    };

    const ReviewSection = ({
      title,
      targetStep,
      children,
    }: {
      title: string;
      targetStep: number;
      children: React.ReactNode;
    }) => (
      <View style={s.reviewSection}>
        <View style={s.reviewSectionHeader}>
          <Text style={s.reviewSectionTitle}>{title}</Text>
          <Pressable
            onPress={() => goToStep(targetStep)}
            style={s.editButton}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${title}`}
          >
            <Ionicons name="pencil-outline" size={14} color={ACCENT} />
            <Text style={s.editButtonText}>Edit</Text>
          </Pressable>
        </View>
        {children}
      </View>
    );

    const ReviewRow = ({ label, value }: { label: string; value: string }) => (
      <View style={s.reviewRow}>
        <Text style={s.reviewLabel}>{label}</Text>
        <Text style={s.reviewValue} selectable>{value || '--'}</Text>
      </View>
    );

    return (
      <View>
        <Text style={s.stepTitle} accessibilityRole="header">Review & Launch</Text>
        <Text style={s.stepSubtitle}>
          Confirm your details before launching Aspire
        </Text>

        <ReviewSection title="About You" targetStep={1}>
          <ReviewRow label="Name" value={`${form.firstName} ${form.lastName}`.trim()} />
          <ReviewRow label="Date of Birth" value={form.dateOfBirth} />
          <ReviewRow
            label="Gender"
            value={GENDER_OPTIONS.find((g) => g.value === form.gender)?.label || form.gender}
          />
          <ReviewRow label="Role" value={form.ownerTitle} />
        </ReviewSection>

        <ReviewSection title="Your Business" targetStep={2}>
          <ReviewRow label="Business Name" value={form.businessName} />
          <ReviewRow label="Industry" value={form.industry} />
          <ReviewRow label="Specialty" value={form.industrySpecialty} />
          <ReviewRow label="Team Size" value={form.teamSize} />
          <ReviewRow label="Entity Type" value={form.entityType} />
          <ReviewRow label="Years" value={form.yearsInBusiness} />
        </ReviewSection>

        <ReviewSection title="Addresses" targetStep={3}>
          <ReviewRow label="Home" value={formatAddress(form.homeAddress)} />
          <ReviewRow
            label="Business"
            value={
              form.businessAddressSameAsHome
                ? 'Same as home'
                : formatAddress(form.businessAddress)
            }
          />
          <ReviewRow label="Timezone" value={form.timezone || 'Auto-detect'} />
          <ReviewRow label="Currency" value={form.currency} />
        </ReviewSection>

        {/* Consent checkboxes */}
        <View style={s.consentSection}>
          <Pressable
            style={s.consentRow}
            onPress={() => updateForm({ consentPersonalization: !form.consentPersonalization })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.consentPersonalization }}
            accessibilityLabel="I agree to a personalized experience powered by my business data"
          >
            <View style={[s.checkbox, form.consentPersonalization && s.checkboxChecked]}>
              {form.consentPersonalization && <Ionicons name="checkmark" size={14} color={TEXT_PRIMARY} />}
            </View>
            <Text style={s.consentText}>
              I agree to a personalized experience powered by my business data{' '}
              <Text style={s.requiredStar}>*</Text>
            </Text>
          </Pressable>

          <Pressable
            style={s.consentRow}
            onPress={() => updateForm({ consentCommunications: !form.consentCommunications })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.consentCommunications }}
            accessibilityLabel="Receive product updates and tips"
          >
            <View style={[s.checkbox, form.consentCommunications && s.checkboxChecked]}>
              {form.consentCommunications && <Ionicons name="checkmark" size={14} color={TEXT_PRIMARY} />}
            </View>
            <Text style={s.consentText}>
              I would like to receive product updates and tips (optional)
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // ---------------------------------------------------------------------------
  // Celebration modal dismiss → navigate to home
  // ---------------------------------------------------------------------------
  const handleEnterAspire = async () => {
    // Refresh session NOW so the auth gate sees the new suite_id
    // and won't redirect back to onboarding after we navigate.
    await supabase.auth.refreshSession();
    router.replace('/(tabs)');
  };

  // ---------------------------------------------------------------------------
  // Validation for current step
  // ---------------------------------------------------------------------------

  const isCurrentStepValid = (): boolean => {
    switch (step) {
      case 1: return canProceedStep1;
      case 2: return canProceedStep2;
      case 3: return canProceedStep3;
      case 4: return canSubmit;
      default: return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  // Show premium loading screen during bootstrap API call
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
        ownerName={celebrationData.ownerName}
        onEnter={handleEnterAspire}
      />
    );
  }

  return (
    <View style={s.fullScreen}>
      {/* Overlay backdrop with blur */}
      <View
        style={s.overlay}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {/* Modal */}
      <View style={s.modalOuter}>
        {/* Gradient border wrapper */}
        <LinearGradient
          colors={[MODAL_BORDER_START, MODAL_BORDER_END]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.modalGradientBorder}
        >
          <View style={s.modalInner}>
            {/* Step Indicator */}
            <StepIndicator currentStep={step} completedSteps={completedSteps} />

            {/* Error banner */}
            {error && (
              <View style={s.errorBox} accessibilityRole="alert">
                <Ionicons name="alert-circle-outline" size={16} color={ERROR_RED} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Scrollable step content */}
            <ScrollView
              style={s.stepScrollView}
              contentContainerStyle={s.stepScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View style={stepAnimStyle}>
                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
              </Animated.View>
            </ScrollView>

            {/* Footer */}
            <View style={s.footer}>
              <View style={s.footerInner}>
                {/* Back button */}
                {step > 1 ? (
                  <Pressable
                    style={s.backButton}
                    onPress={goBack}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel="Go back"
                  >
                    <Ionicons name="arrow-back" size={16} color={Colors.text.tertiary} />
                    <Text style={s.backButtonText}>Back</Text>
                  </Pressable>
                ) : (
                  <View style={{ width: 80 }} />
                )}

                {/* Next / Launch button */}
                {step < STEP_COUNT ? (
                  <Pressable
                    style={({ pressed }) => [
                      s.nextButton,
                      !isCurrentStepValid() && s.buttonDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={goNext}
                    disabled={!isCurrentStepValid()}
                    accessibilityRole="button"
                    accessibilityLabel={`Continue to ${STEP_LABELS[step] || 'next step'}`}
                  >
                    {Platform.OS === 'web' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)',
                          zIndex: 0,
                        } as React.CSSProperties}
                      />
                    )}
                    <Text style={s.nextButtonText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={16} color={TEXT_PRIMARY} />
                  </Pressable>
                ) : (
                  <Pressable
                    style={({ pressed }) => [
                      s.launchButton,
                      (!canSubmit || loading) && s.buttonDisabled,
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={handleComplete}
                    disabled={!canSubmit || loading}
                    accessibilityRole="button"
                    accessibilityLabel="Launch Aspire"
                  >
                    {Platform.OS === 'web' && (
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #3B82F6 0%, #60A5FA 40%, #06B6D4 100%)',
                          zIndex: 0,
                        } as React.CSSProperties}
                      />
                    )}
                    {loading ? (
                      <ActivityIndicator color={TEXT_PRIMARY} size="small" />
                    ) : (
                      <>
                        <Ionicons name="rocket-outline" size={18} color={TEXT_PRIMARY} />
                        <Text style={s.launchButtonText}>Launch Aspire</Text>
                      </>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  // Full-screen container
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Dark overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: OVERLAY_BG,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as unknown as ViewStyle)
      : {}),
  },

  // Modal positioning
  modalOuter: {
    width: MODAL_WIDTH,
    maxWidth: '94%',
    maxHeight: '92%',
    zIndex: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 32px 80px -16px rgba(0,0,0,0.9)' } as unknown as ViewStyle)
      : {}),
  },

  // Gradient border (1px via padding)
  modalGradientBorder: {
    borderRadius: MODAL_RADIUS,
    padding: 1,
  },

  // Modal content area
  modalInner: {
    backgroundColor: MODAL_SURFACE,
    borderRadius: MODAL_RADIUS - 1,
    overflow: 'hidden',
    maxHeight: '100%',
    ...(Platform.OS === 'web'
      ? ({ display: 'flex', flexDirection: 'column' } as unknown as ViewStyle)
      : {}),
  },

  // Step content scroll area
  stepScrollView: {
    flex: 1,
    ...(Platform.OS === 'web'
      ? ({ maxHeight: 'calc(92vh - 180px)' } as unknown as ViewStyle)
      : {}),
  },
  stepScrollContent: {
    paddingHorizontal: Spacing.xxxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },

  // Footer
  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.border.subtle,
    backgroundColor: MODAL_SURFACE,
  },
  footerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.xl,
  },

  // Step header
  stepTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  stepSubtitle: {
    fontSize: 15,
    color: TEXT_MUTED,
    marginBottom: Spacing.xxl,
    lineHeight: 22,
  },

  // Labels
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.lg,
  },
  helperErrorText: {
    color: ERROR_RED,
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  requiredStar: {
    color: ERROR_RED,
    fontWeight: '700',
  },

  // Inputs
  input: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: TEXT_PRIMARY,
  },

  // Read-only field (email)
  readOnlyField: {
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readOnlyText: {
    color: TEXT_SECONDARY,
    fontSize: 15,
  },

  // Pill row
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pill: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  pillSelected: {
    backgroundColor: ACCENT_LIGHT,
    borderColor: ACCENT,
  },
  pillText: {
    color: Colors.text.tertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: ACCENT,
    fontWeight: '700',
  },

  // Dropdown
  dropdown: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  dropdownValue: {
    color: TEXT_PRIMARY,
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: TEXT_DIM,
    fontSize: 15,
  },
  dropdownList: {
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: BORDER_STRONG,
    borderRadius: 10,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownItemSelected: {
    backgroundColor: ACCENT_LIGHT,
  },
  dropdownItemText: {
    color: TEXT_SECONDARY,
    fontSize: 14,
  },
  dropdownItemTextSelected: {
    color: ACCENT,
    fontWeight: '600',
  },

  // Field row (side by side)
  fieldRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  fieldRowItem: {
    flex: 1,
  },

  // Address search
  searchInputWrap: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    overflow: 'hidden' as const,
    minHeight: 44,
  },
  searchIcon: {
    marginRight: Spacing.xs,
  },

  // Confirmed address
  confirmedAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.15)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexWrap: 'wrap' as const,
  },
  confirmedAddressText: {
    flex: 1,
    color: Colors.text.bright,
    fontSize: 14,
    lineHeight: 20,
    minWidth: 0,
  },
  verifiedBadge: {
    backgroundColor: Colors.semantic.successLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  verifiedBadgeText: {
    color: SUCCESS_GREEN,
    fontSize: 11,
    fontWeight: '700',
  },
  changeLinkWrap: {
    minHeight: 44,
    justifyContent: 'center',
  },
  changeLink: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },

  // Auto-detected timezone/currency pills
  autoDetectedRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: Spacing.md,
  },
  autoTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: ACCENT_LIGHT,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: Spacing.sm,
  },
  autoTagText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xxl,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: SURFACE,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 44,
  },
  toggleLabel: {
    color: TEXT_SECONDARY,
    fontSize: 15,
    fontWeight: '500',
  },

  // Places dropdown
  placesDropdown: {
    backgroundColor: Colors.background.elevated,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 10,
    marginTop: Spacing.xs,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? { position: 'absolute' as any, top: '100%' as any, left: 0, right: 0, zIndex: 9999 } : {}),
  } as ViewStyle,
  placesItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
    minHeight: 44,
  },
  placesItemMain: {
    color: Colors.text.bright,
    fontSize: 14,
    fontWeight: '500',
  },
  placesItemSub: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 1,
  },

  // Review step
  reviewSection: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.subtle,
  },
  reviewSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  editButtonText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
  },
  reviewLabel: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '500',
    flex: 0.4,
  },
  reviewValue: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '500',
    flex: 0.6,
    textAlign: 'right',
  },

  // Consent
  consentSection: {
    marginTop: Spacing.xxl,
    gap: Spacing.lg,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    minHeight: 44,
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

  // Error
  errorBox: {
    backgroundColor: Colors.semantic.errorLight,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.25)',
    borderRadius: 10,
    padding: 12,
    marginHorizontal: Spacing.xxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    color: ERROR_RED,
    fontSize: 14,
    flex: 1,
  },

  // Buttons
  backButton: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
  },
  backButtonText: {
    color: Colors.text.tertiary,
    fontSize: 15,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: 44,
    overflow: 'hidden',
  },
  nextButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    zIndex: 1,
  },
  launchButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 48,
    overflow: 'hidden',
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 24px ${ACCENT_GLOW}` } as unknown as ViewStyle)
      : {}),
  } as ViewStyle,
  launchButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
    zIndex: 1,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
});

export default function OnboardingScreen() {
  return (
    <PageErrorBoundary pageName="onboarding">
      <OnboardingContent />
    </PageErrorBoundary>
  );
}
