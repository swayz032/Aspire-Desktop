import { useRef, useCallback } from 'react';
import { emitCanvasEvent } from '@/lib/canvasTelemetry';

// ---------------------------------------------------------------------------
// SLO threshold map (milliseconds)
// ---------------------------------------------------------------------------

const SLO_THRESHOLDS: Record<string, number> = {
  lens_render: 200,
  preflight: 500,
  draft_creation: 3000,
  authority_submission: 800,
  receipt_display: 250,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SloViolation {
  slo: string;
  actual: number;
  threshold: number;
  timestamp: number;
}

export interface SloMetrics {
  violations: number;
  lastViolation: SloViolation | null;
  checksPerformed: number;
}

interface UseSloMonitorResult {
  /** Returns true if duration is within SLO. Emits telemetry on violation. */
  checkSlo: (slo: string, durationMs: number) => boolean;
  metrics: SloMetrics;
  resetMetrics: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useSloMonitor(): UseSloMonitorResult {
  const metricsRef = useRef<SloMetrics>({
    violations: 0,
    lastViolation: null,
    checksPerformed: 0,
  });

  const checkSlo = useCallback((slo: string, durationMs: number): boolean => {
    const threshold = SLO_THRESHOLDS[slo];
    metricsRef.current.checksPerformed += 1;

    // Unknown SLO name — pass through (fail open for monitoring only)
    if (threshold === undefined) return true;

    if (durationMs <= threshold) return true;

    // Violation
    const violation: SloViolation = {
      slo,
      actual: Math.round(durationMs),
      threshold,
      timestamp: Date.now(),
    };

    metricsRef.current.violations += 1;
    metricsRef.current.lastViolation = violation;

    emitCanvasEvent('slo_violation', {
      slo,
      actual: Math.round(durationMs),
      threshold,
    });

    return false;
  }, []);

  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      violations: 0,
      lastViolation: null,
      checksPerformed: 0,
    };
  }, []);

  return {
    checkSlo,
    metrics: metricsRef.current,
    resetMetrics,
  };
}
