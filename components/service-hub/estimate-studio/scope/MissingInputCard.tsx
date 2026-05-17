/**
 * MissingInputCard — Wave 7.
 *
 * Single row in the MissingInputsList. Each row exposes three action
 * buttons:
 *
 *   - Confirm in Field — collects a text/number value, calls
 *     useBlueprintActions().confirmMissingInput() → POST resolve endpoint.
 *     YELLOW tier — UI shows submitting / success / error states.
 *   - RFI            — Wave 8+ stub (drafts an RFI email).
 *   - Ask Tim        — Wave 8+ stub (hands the question to Tim Enterprise).
 *
 * On a successful confirm, the row collapses into a "Resolved" sub-state
 * with a field_confirmed TruthBadge.
 */
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BlueprintMissingInput } from '@/lib/api/blueprintsApi';
import { TruthBadge } from './TruthBadge';
import type { ActionPhase } from '@/hooks/useBlueprintActions';

interface Props {
  input: BlueprintMissingInput;
  phase: ActionPhase;
  error: { code: string; message: string } | null;
  onConfirm: (value: string) => void;
  onRequestRFI: () => void;
}

export function MissingInputCard({
  input,
  phase,
  error,
  onConfirm,
  onRequestRFI,
}: Props): React.ReactElement {
  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [value, setValue] = useState<string>('');

  const isResolved = input.status === 'resolved' || phase === 'success';
  const isSubmitting = phase === 'submitting';

  if (isResolved) {
    return (
      <View
        style={[styles.row, styles.rowResolved]}
        testID={`missing-input-${input.input_id}-resolved`}
      >
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
            <Text style={styles.title} numberOfLines={2}>
              {input.description}
            </Text>
          </View>
          {input.resolved_value || value ? (
            <Text style={styles.resolvedValue}>
              Confirmed: {input.resolved_value ?? value}
            </Text>
          ) : null}
          <TruthBadge truth="field_confirmed" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row} testID={`missing-input-${input.input_id}`}>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Ionicons name="alert-circle-outline" size={16} color="#fb923c" />
          <Text style={styles.title} numberOfLines={3}>
            {input.description}
          </Text>
          <TruthBadge truth="missing" />
        </View>
        {input.suggested_resolution ? (
          <Text style={styles.suggestion}>{input.suggested_resolution}</Text>
        ) : null}

        {confirmOpen ? (
          <View style={styles.confirmForm}>
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder="Enter confirmed value..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              editable={!isSubmitting}
              testID={`missing-input-${input.input_id}-text`}
            />
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => {
                  setConfirmOpen(false);
                  setValue('');
                }}
                disabled={isSubmitting}
                accessibilityRole="button"
                accessibilityLabel="Cancel confirmation"
                style={({ hovered, pressed }: any) => [
                  styles.actionBtn,
                  styles.actionBtnSecondary,
                  hovered && styles.actionBtnHover,
                  pressed && styles.actionBtnPressed,
                ]}
              >
                <Text style={styles.actionBtnSecondaryText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => onConfirm(value.trim())}
                disabled={isSubmitting || value.trim().length === 0}
                accessibilityRole="button"
                accessibilityLabel="Submit confirmation"
                style={({ hovered, pressed }: any) => [
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  isSubmitting && styles.actionBtnDisabled,
                  value.trim().length === 0 && styles.actionBtnDisabled,
                  hovered && !isSubmitting && styles.actionBtnHover,
                  pressed && styles.actionBtnPressed,
                ]}
                testID={`missing-input-${input.input_id}-submit`}
              >
                <Text style={styles.actionBtnPrimaryText}>
                  {isSubmitting ? 'Confirming…' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => setConfirmOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Confirm in field"
              style={({ hovered, pressed }: any) => [
                styles.actionBtn,
                styles.actionBtnPrimary,
                hovered && styles.actionBtnHover,
                pressed && styles.actionBtnPressed,
              ]}
              testID={`missing-input-${input.input_id}-open-confirm`}
            >
              <Ionicons
                name="checkmark-outline"
                size={12}
                color="#0b1220"
              />
              <Text style={styles.actionBtnPrimaryText}>Confirm in Field</Text>
            </Pressable>
            <Pressable
              onPress={onRequestRFI}
              accessibilityRole="button"
              accessibilityLabel="Draft an RFI email"
              style={({ hovered, pressed }: any) => [
                styles.actionBtn,
                styles.actionBtnSecondary,
                hovered && styles.actionBtnHover,
                pressed && styles.actionBtnPressed,
              ]}
              testID={`missing-input-${input.input_id}-rfi`}
            >
              <Ionicons
                name="mail-outline"
                size={12}
                color="rgba(255,255,255,0.85)"
              />
              <Text style={styles.actionBtnSecondaryText}>RFI</Text>
            </Pressable>
            <View
              style={[styles.actionBtn, styles.actionBtnDisabled]}
              accessibilityRole="text"
            >
              <Ionicons
                name="chatbubble-outline"
                size={12}
                color="rgba(255,255,255,0.45)"
              />
              <Text style={styles.actionBtnDisabledText}>Ask Tim (v2)</Text>
            </View>
          </View>
        )}

        {error ? (
          <Text style={styles.errorText} testID={`missing-input-${input.input_id}-error`}>
            {error.message}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderWidth: 1,
    borderColor: 'rgba(251,146,60,0.22)',
  },
  rowResolved: {
    borderColor: 'rgba(74,222,128,0.30)',
    backgroundColor: 'rgba(74,222,128,0.04)',
  },
  body: {
    flex: 1,
    gap: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
    lineHeight: 18,
  },
  suggestion: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.60)',
    lineHeight: 17,
    letterSpacing: -0.05,
    fontStyle: 'italic',
  },
  resolvedValue: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(74,222,128,0.95)',
    letterSpacing: -0.05,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  confirmForm: {
    gap: 8,
  },
  input: {
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 150ms ease' } as any)
      : {}),
  },
  actionBtnPrimary: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },
  actionBtnPrimaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0b1220',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  actionBtnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionBtnSecondaryText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  actionBtnHover: {
    opacity: 0.92,
  },
  actionBtnPressed: {
    opacity: 0.78,
  },
  actionBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.025)',
    borderColor: 'rgba(255,255,255,0.06)',
    opacity: 0.55,
  },
  actionBtnDisabledText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 11,
    color: '#ff6b6b',
    letterSpacing: -0.05,
  },
});
