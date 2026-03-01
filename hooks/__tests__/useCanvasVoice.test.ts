/**
 * useCanvasVoice.test.ts -- Unit tests for Canvas voice routing hook
 */

import { renderHook, act } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks (must be before imports)
// ---------------------------------------------------------------------------

const mockStartSession = jest.fn().mockResolvedValue(undefined);
const mockEndSession = jest.fn();
const mockSetActiveAgent = jest.fn();
const mockSetPersonaState = jest.fn();

let mockStatus = 'idle';
let mockOnStatusChange: ((status: string) => void) | undefined;
let mockOnError: ((err: Error) => void) | undefined;

jest.mock('@/hooks/useAgentVoice', () => ({
  useAgentVoice: (options: {
    agent: string;
    onStatusChange?: (status: string) => void;
    onError?: (err: Error) => void;
  }) => {
    mockOnStatusChange = options.onStatusChange;
    mockOnError = options.onError;
    return {
      status: mockStatus,
      startSession: mockStartSession,
      endSession: mockEndSession,
    };
  },
}));

jest.mock('@/lib/chatCanvasStore', () => ({
  setActiveAgent: (...args: unknown[]) => mockSetActiveAgent(...args),
  setPersonaState: (...args: unknown[]) => mockSetPersonaState(...args),
}));

jest.mock('@/providers', () => ({
  useSupabase: () => ({
    session: { access_token: 'test-token' },
    suiteId: 'suite-123',
  }),
}));

import { useCanvasVoice } from '../useCanvasVoice';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCanvasVoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus = 'idle';
  });

  it('returns initial idle state', () => {
    const { result } = renderHook(() => useCanvasVoice('ava'));

    expect(result.current.status).toBe('idle');
    expect(result.current.isListening).toBe(false);
    expect(result.current.isProcessing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('starts voice session and sets active agent', async () => {
    const { result } = renderHook(() => useCanvasVoice('finn'));

    await act(async () => {
      await result.current.startSession();
    });

    expect(mockStartSession).toHaveBeenCalled();
    expect(mockSetActiveAgent).toHaveBeenCalledWith('finn');
    expect(mockSetPersonaState).toHaveBeenCalledWith('listening');
  });

  it('ends voice session and resets persona state', () => {
    const { result } = renderHook(() => useCanvasVoice('eli'));

    act(() => {
      result.current.endSession();
    });

    expect(mockEndSession).toHaveBeenCalled();
    expect(mockSetPersonaState).toHaveBeenCalledWith('idle');
  });

  it('maps status changes to persona state', () => {
    renderHook(() => useCanvasVoice('ava'));

    // Simulate status changes via the callback
    act(() => {
      mockOnStatusChange?.('listening');
    });
    expect(mockSetPersonaState).toHaveBeenCalledWith('listening');

    act(() => {
      mockOnStatusChange?.('thinking');
    });
    expect(mockSetPersonaState).toHaveBeenCalledWith('thinking');

    act(() => {
      mockOnStatusChange?.('speaking');
    });
    expect(mockSetPersonaState).toHaveBeenCalledWith('speaking');

    act(() => {
      mockOnStatusChange?.('idle');
    });
    expect(mockSetPersonaState).toHaveBeenCalledWith('idle');
  });

  it('maps error status to idle persona', () => {
    renderHook(() => useCanvasVoice('ava'));

    act(() => {
      mockOnStatusChange?.('error');
    });
    expect(mockSetPersonaState).toHaveBeenCalledWith('idle');
  });

  it('sets active agent on every status change', () => {
    renderHook(() => useCanvasVoice('finn'));

    act(() => {
      mockOnStatusChange?.('listening');
    });
    expect(mockSetActiveAgent).toHaveBeenCalledWith('finn');
  });

  it('handles errors from voice pipeline', () => {
    renderHook(() => useCanvasVoice('ava'));

    act(() => {
      mockOnError?.(new Error('Mic access denied'));
    });

    expect(mockSetPersonaState).toHaveBeenCalledWith('idle');
  });

  it('clears error on new session start', async () => {
    const { result } = renderHook(() => useCanvasVoice('ava'));

    // Trigger error
    act(() => {
      mockOnError?.(new Error('test error'));
    });

    // Start new session should clear error
    await act(async () => {
      await result.current.startSession();
    });

    expect(result.current.error).toBeNull();
  });

  it('returns isListening true when status is listening', () => {
    mockStatus = 'listening';
    const { result } = renderHook(() => useCanvasVoice('ava'));

    expect(result.current.isListening).toBe(true);
  });

  it('returns isProcessing true when status is thinking', () => {
    mockStatus = 'thinking';
    const { result } = renderHook(() => useCanvasVoice('ava'));

    expect(result.current.isProcessing).toBe(true);
  });
});
