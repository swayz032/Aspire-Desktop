/**
 * Canvas Mode State Management
 *
 * Pattern: Listener-based (NOT Zustand) — follows immersionStore.ts pattern
 * Scope: Canvas mode, activity events, persona state, agent routing
 * Persistence: Mode persists to localStorage (Wave 8)
 */

export type CanvasMode = 'chat' | 'canvas';
export type PersonaState = 'idle' | 'listening' | 'thinking' | 'speaking';
export type AgentName = 'ava' | 'finn' | 'eli';

export interface AgentActivityEvent {
  type: 'thinking' | 'tool_call' | 'step' | 'done' | 'error';
  message: string;
  icon: string;
  timestamp: number;
  agent?: AgentName;
}

interface ChatCanvasState {
  mode: CanvasMode;
  activityEvents: AgentActivityEvent[];
  personaState: PersonaState;
  activeAgent: AgentName;
}

type Listener = (state: ChatCanvasState) => void;

// Wave 8: Load mode from localStorage on startup
const STORAGE_KEY = 'canvas_mode_preference';
function loadModeFromStorage(): CanvasMode {
  if (typeof window === 'undefined') return 'chat';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'chat' || stored === 'canvas') return stored;
  } catch {
    // localStorage access failed (private browsing, etc.)
  }
  return 'chat';
}

// State
let state: ChatCanvasState = {
  mode: loadModeFromStorage(),
  activityEvents: [],
  personaState: 'idle',
  activeAgent: 'ava',
};

// Listeners
const listeners = new Set<Listener>();

// Subscribe
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Notify
function notify() {
  listeners.forEach((listener) => listener(state));
}

// Getters
export function getState(): ChatCanvasState {
  return state;
}

export function getMode(): CanvasMode {
  return state.mode;
}

export function getActivityEvents(): AgentActivityEvent[] {
  return state.activityEvents;
}

export function getPersonaState(): PersonaState {
  return state.personaState;
}

export function getActiveAgent(): AgentName {
  return state.activeAgent;
}

// Actions
export function setMode(mode: CanvasMode) {
  state = { ...state, mode };
  // Wave 8: Persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage write failed (quota, private browsing, etc.)
    }
  }
  notify();
}

export function addActivityEvent(event: Omit<AgentActivityEvent, 'timestamp'>) {
  const fullEvent: AgentActivityEvent = {
    ...event,
    timestamp: Date.now(),
  };
  state = {
    ...state,
    activityEvents: [...state.activityEvents, fullEvent],
  };
  notify();
}

export function clearActivityEvents() {
  state = { ...state, activityEvents: [] };
  notify();
}

export function setPersonaState(personaState: PersonaState) {
  state = { ...state, personaState };
  notify();
}

export function setActiveAgent(agent: AgentName) {
  state = { ...state, activeAgent: agent };
  notify();
}

// Reset (for testing)
export function resetState() {
  state = {
    mode: 'chat',
    activityEvents: [],
    personaState: 'idle',
    activeAgent: 'ava',
  };
  notify();
}
