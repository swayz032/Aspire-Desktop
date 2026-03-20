export type SmokeMode = 'public' | 'auth';

export interface SmokeContract {
  id: string;
  name: string;
  mode: SmokeMode;
  path: string;
  testId: string;
  requiredTestIds?: string[];
  expectedTexts: string[];
  forbiddenTexts?: string[];
}

const DEFAULT_FORBIDDEN_TEXTS = [
  'Something went wrong',
  'An unexpected error occurred.',
  'Global app crash',
];

export const PUBLIC_SMOKE_CONTRACTS: SmokeContract[] = [
  {
    id: 'landing-root',
    name: 'Landing shell renders',
    mode: 'public',
    path: '/',
    testId: 'smoke-landing-root',
    expectedTexts: ['Aspire'],
    forbiddenTexts: DEFAULT_FORBIDDEN_TEXTS,
  },
  {
    id: 'login-shell',
    name: 'Login shell renders',
    mode: 'public',
    path: '/login?e2eRoute=login',
    testId: 'smoke-login-root',
    requiredTestIds: ['smoke-login-submit'],
    expectedTexts: ['Aspire', 'Sign In'],
    forbiddenTexts: DEFAULT_FORBIDDEN_TEXTS,
  },
];

export const AUTH_SMOKE_CONTRACTS: SmokeContract[] = [
  {
    id: 'home-shell',
    name: 'Authenticated home shell renders',
    mode: 'auth',
    path: '/login',
    testId: 'smoke-home-root',
    requiredTestIds: ['ava-desk-panel'],
    expectedTexts: ['Interaction Mode', 'Ops Snapshot', 'Ava Desk'],
    forbiddenTexts: DEFAULT_FORBIDDEN_TEXTS,
  },
  {
    id: 'finance-hub-shell',
    name: 'Finance hub renders Finn controls',
    mode: 'auth',
    path: '/finance-hub',
    testId: 'smoke-finance-hub-root',
    expectedTexts: ['Finn', 'Video with Finn', 'Chat with Finn'],
    forbiddenTexts: DEFAULT_FORBIDDEN_TEXTS,
  },
  {
    id: 'finance-connections-shell',
    name: 'Finance connections renders provider workspace',
    mode: 'auth',
    path: '/finance-hub/connections',
    testId: 'smoke-finance-connections-root',
    expectedTexts: ['Connections', 'Service Providers', 'Data Health'],
    forbiddenTexts: DEFAULT_FORBIDDEN_TEXTS,
  },
  {
    id: 'voice-test-shell',
    name: 'Voice test renders agent controls',
    mode: 'auth',
    path: '/voice-test',
    testId: 'smoke-voice-test-root',
    requiredTestIds: ['smoke-voice-test-agent-bar'],
    expectedTexts: ['Voice Test', 'Tap the mic', 'Finn'],
    forbiddenTexts: DEFAULT_FORBIDDEN_TEXTS,
  },
];
