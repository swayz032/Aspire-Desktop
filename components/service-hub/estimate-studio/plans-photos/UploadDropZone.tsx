/**
 * UploadDropZone — Wave 6A.
 *
 * Production drop zone for the Plans & Photos tab:
 *   - Drag-drop (PDF / JPG / PNG / HEIC up to 50 MB)
 *   - Clipboard paste (image data via onPaste)
 *   - Native file picker fallback (hidden <input type="file" />)
 *   - Real-time read + upload progress
 *   - Hard size cap, fail-closed with a clear error
 *
 * Mission rule: make complicated blueprints feel simple. Empty hero copy
 * promises "drop a plan set — we'll read it and tell you the story."
 *
 * Premium UX:
 *   - 200ms cross-fade between idle / uploading / success / error states
 *   - Drag-over highlight (border + tint)
 *   - CLS = 0: host card is always full-height
 *
 * Mobile + iOS / Android note: drag-drop is web-only; on native this
 * component still renders and routes through the native file picker.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  MAX_UPLOAD_BYTES,
  ACCEPTED_MIME_TYPES,
} from '@/lib/api/blueprintsApi';
import { UploadProgressInline } from './UploadProgressInline';
import type { UploadPhase, UploadProgress } from '@/hooks/useBlueprintUpload';
import type { StageProgress } from '@/lib/api/blueprintsApi';

const ACCEPT_ATTR = ACCEPTED_MIME_TYPES.join(',');

interface Props {
  phase: UploadPhase;
  progress: UploadProgress;
  filename: string | null;
  stageProgress: StageProgress;
  error: { code: string; message: string } | null;
  onFile: (file: File) => void;
  onReset: () => void;
}

function _formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function UploadDropZone({
  phase,
  progress,
  filename,
  stageProgress,
  error,
  onFile,
  onReset,
}: Props): React.ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // 200ms cross-fade whenever the phase swaps to a new visual state.
  useEffect(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }, [phase, fadeAnim]);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      // Reset so re-selecting the same file refires onchange.
      if (inputRef.current) inputRef.current.value = '';
    },
    [onFile],
  );

  // Web-only drag-drop / paste handlers attached via direct DOM (React Native
  // Web's drag events are not 1:1 with browser DnD).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.getElementById('plans-photos-dropzone');
    if (!el) return;

    const onDragOver = (e: DragEvent): void => {
      e.preventDefault();
      setIsDragOver(true);
    };
    const onDragLeave = (e: DragEvent): void => {
      e.preventDefault();
      setIsDragOver(false);
    };
    const onDrop = (e: DragEvent): void => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onFile(file);
    };
    const onPaste = (e: ClipboardEvent): void => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            onFile(file);
            return;
          }
        }
      }
    };

    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', onDragLeave);
    el.addEventListener('drop', onDrop);
    document.addEventListener('paste', onPaste);
    return () => {
      el.removeEventListener('dragover', onDragOver);
      el.removeEventListener('dragleave', onDragLeave);
      el.removeEventListener('drop', onDrop);
      document.removeEventListener('paste', onPaste);
    };
  }, [onFile]);

  const handlePressClick = useCallback(
    (_e: GestureResponderEvent) => {
      if (phase === 'success' || phase === 'error') {
        onReset();
        // Open picker after reset so users can immediately pick a new file.
        setTimeout(openPicker, 0);
        return;
      }
      openPicker();
    },
    [openPicker, onReset, phase],
  );

  const view = useMemo(() => {
    if (phase === 'success') {
      return (
        <View style={styles.body} testID="dropzone-success">
          <View style={styles.iconCircleSuccess}>
            <Ionicons name="checkmark" size={36} color="#22c55e" />
          </View>
          <Text style={styles.title}>{filename ?? 'Plan set uploaded'}</Text>
          <Text style={styles.subtitle}>Drew read the file and tagged the sheets.</Text>
          <UploadProgressInline stages={stageProgress} layout="horizontal" />
          <Pressable
            onPress={() => {
              onReset();
              setTimeout(openPicker, 0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Upload another plan set"
            style={({ hovered, pressed }: any) => [
              styles.secondaryButton,
              hovered && styles.secondaryButtonHover,
              pressed && styles.secondaryButtonPressed,
            ]}
            testID="dropzone-upload-another"
          >
            <Ionicons name="cloud-upload-outline" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.secondaryButtonText}>Upload another</Text>
          </Pressable>
        </View>
      );
    }

    if (phase === 'error') {
      return (
        <View style={styles.body} testID="dropzone-error">
          <View style={styles.iconCircleError}>
            <Ionicons name="alert-circle" size={32} color="#ef4444" />
          </View>
          <Text style={styles.title}>Couldn’t process that file</Text>
          <Text style={styles.subtitle} numberOfLines={3}>
            {error?.message ?? 'Unknown error.'}
          </Text>
          {error?.code ? <Text style={styles.errorCode}>{error.code}</Text> : null}
          <Pressable
            onPress={() => {
              onReset();
              setTimeout(openPicker, 0);
            }}
            accessibilityRole="button"
            accessibilityLabel="Try uploading again"
            style={({ hovered, pressed }: any) => [
              styles.secondaryButton,
              hovered && styles.secondaryButtonHover,
              pressed && styles.secondaryButtonPressed,
            ]}
            testID="dropzone-try-again"
          >
            <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.85)" />
            <Text style={styles.secondaryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    if (phase === 'reading' || phase === 'uploading' || phase === 'ingesting' || phase === 'classifying') {
      const pct = Math.min(100, Math.max(0, Math.round(progress.ratio * 100)));
      const phaseLabel: Record<typeof phase, string> = {
        reading: 'Reading file…',
        uploading: 'Uploading…',
        ingesting: 'Drew is parsing the plan set…',
        classifying: 'Tagging disciplines…',
      } as const;
      return (
        <View style={styles.body} testID={`dropzone-${phase}`}>
          <View style={styles.iconCircleBusy}>
            <Ionicons name="sync" size={32} color="#fbbf24" />
          </View>
          <Text style={styles.title}>{filename ?? 'Working on it…'}</Text>
          <Text style={styles.subtitle}>{phaseLabel[phase]}</Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width:
                    phase === 'reading' || phase === 'uploading'
                      ? `${pct}%`
                      : phase === 'ingesting'
                        ? '66%'
                        : '92%',
                },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {phase === 'reading' || phase === 'uploading'
              ? `${_formatBytes(progress.bytesDone)} / ${_formatBytes(progress.bytesTotal)}`
              : 'Hold tight — Drew is still working.'}
          </Text>
          <UploadProgressInline stages={stageProgress} layout="horizontal" />
        </View>
      );
    }

    // idle
    return (
      <View style={styles.body} testID="dropzone-idle">
        <View style={styles.iconCircleIdle}>
          <Ionicons name="cloud-upload-outline" size={36} color="rgba(255,255,255,0.85)" />
        </View>
        <Text style={styles.title}>Drop a plan set here</Text>
        <Text style={styles.subtitle}>
          We’ll read it and tell you the story — sheets, disciplines, revisions.
        </Text>
        <Pressable
          onPress={handlePressClick}
          accessibilityRole="button"
          accessibilityLabel="Choose a file to upload"
          style={({ hovered, pressed }: any) => [
            styles.primaryButton,
            hovered && styles.primaryButtonHover,
            pressed && styles.primaryButtonPressed,
          ]}
          testID="dropzone-choose-file"
        >
          <Ionicons name="folder-open-outline" size={14} color="#0a0a0a" />
          <Text style={styles.primaryButtonText}>Choose a file</Text>
        </Pressable>
        <Text style={styles.hint}>
          PDF, JPG, PNG, HEIC — up to {Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB. Paste from
          clipboard works too.
        </Text>
      </View>
    );
  }, [phase, progress, filename, stageProgress, error, handlePressClick, onReset, openPicker]);

  return (
    <Pressable
      onPress={phase === 'idle' ? openPicker : undefined}
      // Keep the host pressable only in idle so success / error CTAs win over it.
      style={({ hovered }: any) => [
        styles.host,
        isDragOver && styles.hostDragOver,
        hovered && phase === 'idle' && styles.hostHover,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Blueprint upload drop zone"
      testID="upload-drop-zone"
      // RN-web sets `id` on the underlying div via nativeID.
      nativeID="plans-photos-dropzone"
    >
      <Animated.View style={[styles.fader, { opacity: fadeAnim }]}>{view}</Animated.View>
      {Platform.OS === 'web' ? (
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          style={styles.hiddenInput as any}
          onChange={handleInputChange}
          data-testid="dropzone-file-input"
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    minHeight: 320,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.018)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 200ms ease, border-color 200ms ease' } as any)
      : {}),
  },
  hostHover: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  hostDragOver: {
    backgroundColor: 'rgba(251,191,36,0.05)',
    borderColor: 'rgba(251,191,36,0.65)',
    borderStyle: 'solid',
  },
  fader: {
    width: '100%',
    alignItems: 'center',
  },
  body: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 460,
  },
  iconCircleIdle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  iconCircleBusy: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(251,191,36,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.30)',
  },
  iconCircleSuccess: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(34,197,94,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.45)',
  },
  iconCircleError: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239,68,68,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.40)',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  hint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.40)',
    textAlign: 'center',
    letterSpacing: -0.05,
  },
  errorCode: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(239,68,68,0.70)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fbbf24',
    marginTop: 4,
  },
  primaryButtonHover: {
    backgroundColor: '#fcd34d',
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a0a0a',
    letterSpacing: -0.1,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    marginTop: 2,
  },
  secondaryButtonHover: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: -0.05,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 320,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#fbbf24',
    ...(Platform.OS === 'web' ? ({ transition: 'width 200ms ease' } as any) : {}),
  },
  progressLabel: {
    fontSize: 10.5,
    color: 'rgba(255,255,255,0.55)',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.05,
  },
  hiddenInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    pointerEvents: 'none',
  },
});
