/**
 * DialPadCard — extracted dial pad (spec §11).
 *
 * Reuses (NOT duplicates) the existing helpers from `app/session/calls.tsx`:
 *   - DIAL_PAD constant (calls.tsx:160)
 *   - playDTMFTone (calls.tsx:86)
 *   - resumeAudioContextFromGesture (calls.tsx:75)
 *   - formatE164Display (calls.tsx:251)
 *   - formatPhoneNumber (calls.tsx:262)
 *
 * Token minting is NOT done here — `/call-room` mints the voice token
 * server-side after navigation (see calls.tsx:655-660). The previous
 * JSDoc claim that `fetchVoiceToken` was imported here was incorrect and
 * was removed in the Pass 1 critic sub-pass.
 *
 * Pass 1 of `feat/front-desk-hub` (2026-05-11) added `export` keywords to
 * those symbols in calls.tsx so this card imports them — single source of
 * truth, zero copy. The legacy `/session/calls` route still owns + uses them.
 *
 * Card placement (spec §11): bottom-right column under the Front Desk
 * Inbox rail. NEVER inside the receptionist stage. NEVER inside the
 * lower workstrip.
 *
 * Call flow: validate number → snapshot button rect for portal-reveal →
 * `router.push('/call-room', ...)`. The `/call-room` route mints the voice
 * token internally (see calls.tsx:656 comment for why pre-mint was removed).
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/tokens';
import { useTenant } from '@/providers/TenantProvider';
import { useIsFinePointer } from '@/lib/useDesktop';
import {
  DIAL_PAD,
  playDTMFTone,
  resumeAudioContextFromGesture,
  formatE164Display,
  formatPhoneNumber,
} from '@/app/session/calls';

type UtilityMode = 'keypad' | 'recent' | 'contacts';

export function DialPadCard() {
  const router = useRouter();
  const { tenant } = useTenant();
  const isFine = useIsFinePointer();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [callError, setCallError] = useState<string | null>(null);
  const [utilityMode, setUtilityMode] = useState<UtilityMode>('keypad');
  const callButtonRef = useRef<HTMLElement | null>(null);

  const cleanedDigits = useMemo(() => phoneNumber.replace(/\D/g, ''), [phoneNumber]);
  const isValidNumber = cleanedDigits.length >= 10;
  const formattedDisplay = phoneNumber
    ? phoneNumber.startsWith('+')
      ? formatE164Display(phoneNumber)
      : formatPhoneNumber(phoneNumber)
    : '';

  const handleDigit = useCallback((digit: string) => {
    void resumeAudioContextFromGesture().then(() => playDTMFTone(digit));
    setPhoneNumber((prev) => prev + digit);
    setCallError(null);
  }, []);

  const handleBackspace = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
    setCallError(null);
  }, []);

  const handleCall = useCallback(() => {
    if (!isValidNumber) return;
    void resumeAudioContextFromGesture();
    setCallError(null);

    const officeId = tenant?.officeId;
    if (!officeId) {
      setCallError('Your office is still loading — try again in a moment.');
      return;
    }

    const toE164 = cleanedDigits.startsWith('1') ? `+${cleanedDigits}` : `+1${cleanedDigits}`;

    // Snapshot button rect BEFORE navigating so /call-room can do the
    // portal-reveal animation from the source coordinates (mirrors
    // captureOriginParams() pattern in calls.tsx:603).
    let origin: Record<string, string> = {};
    if (Platform.OS === 'web' && callButtonRef.current?.getBoundingClientRect) {
      try {
        const r = callButtonRef.current.getBoundingClientRect();
        origin = {
          originX: String(Math.round(r.left)),
          originY: String(Math.round(r.top)),
          originW: String(Math.round(r.width)),
          originH: String(Math.round(r.height)),
        };
      } catch {}
    }

    router.push({
      pathname: '/call-room',
      params: { phone: toE164, officeId, ...origin },
    } as never);
  }, [cleanedDigits, isValidNumber, router, tenant?.officeId]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Dial Pad</Text>
        <View style={styles.utilityRow}>
          <UtilityBtn
            icon="time-outline"
            active={utilityMode === 'recent'}
            onPress={() => setUtilityMode((m) => (m === 'recent' ? 'keypad' : 'recent'))}
            accessibilityLabel="Recent calls"
            isFine={isFine}
          />
          <UtilityBtn
            icon="people-outline"
            active={utilityMode === 'contacts'}
            onPress={() => setUtilityMode((m) => (m === 'contacts' ? 'keypad' : 'contacts'))}
            accessibilityLabel="Contacts"
            isFine={isFine}
          />
          <UtilityBtn
            icon="keypad-outline"
            active={utilityMode === 'keypad'}
            onPress={() => setUtilityMode('keypad')}
            accessibilityLabel="Keypad"
            isFine={isFine}
          />
        </View>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          value={formattedDisplay}
          onChangeText={(t) => {
            setPhoneNumber(t);
            setCallError(null);
          }}
          placeholder="Enter number or name"
          placeholderTextColor={Colors.text.muted}
          style={styles.input}
          keyboardType="phone-pad"
          accessibilityLabel="Phone number input"
        />
        <Pressable
          onPress={handleBackspace}
          accessibilityRole="button"
          accessibilityLabel="Backspace"
          disabled={phoneNumber.length === 0}
          style={({ hovered, pressed }: any) => [
            styles.backspaceBtn,
            isFine && hovered && styles.backspaceBtnHover,
            pressed && { opacity: 0.85 },
            phoneNumber.length === 0 && styles.backspaceBtnDisabled,
          ]}
        >
          <Ionicons name="backspace-outline" size={18} color={Colors.text.secondary} />
        </Pressable>
      </View>

      {utilityMode === 'keypad' && (
        <View style={styles.grid}>
          {DIAL_PAD.map((key) => (
            <Pressable
              key={key.digit}
              onPress={() => handleDigit(key.digit)}
              accessibilityRole="button"
              accessibilityLabel={`Dial ${key.digit}`}
              style={({ hovered, pressed }: any) => [
                styles.digit,
                isFine && hovered && styles.digitHover,
                pressed && styles.digitPressed,
              ]}
            >
              <Text style={styles.digitNum}>{key.digit}</Text>
              {key.letters ? <Text style={styles.digitLetters}>{key.letters}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}

      {utilityMode === 'recent' && (
        <View style={styles.utilityEmpty}>
          <Text style={styles.utilityEmptyText}>Recent calls — wired in Pass 4</Text>
        </View>
      )}
      {utilityMode === 'contacts' && (
        <View style={styles.utilityEmpty}>
          <Text style={styles.utilityEmptyText}>Contacts — wired in Pass 4</Text>
        </View>
      )}

      {callError ? <Text style={styles.errorText}>{callError}</Text> : null}

      <Pressable
        ref={(node: any) => {
          callButtonRef.current = node as HTMLElement | null;
        }}
        onPress={handleCall}
        disabled={!isValidNumber}
        accessibilityRole="button"
        accessibilityLabel="Call"
        accessibilityState={{ disabled: !isValidNumber }}
        style={({ hovered, pressed }: any) => [
          styles.callBtn,
          !isValidNumber && styles.callBtnDisabled,
          isValidNumber && isFine && hovered && styles.callBtnHover,
          isValidNumber && pressed && { opacity: 0.9 },
        ]}
      >
        <Ionicons name="call" size={18} color="#fff" />
        <Text style={styles.callBtnText}>Call</Text>
      </Pressable>
    </View>
  );
}

function UtilityBtn({
  icon,
  active,
  onPress,
  accessibilityLabel,
  isFine,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  isFine: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ hovered, pressed }: any) => [
        styles.utilityBtn,
        active && styles.utilityBtnActive,
        isFine && hovered && !active && styles.utilityBtnHover,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons name={icon} size={15} color={active ? Colors.accent.cyan : Colors.text.tertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: Colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  utilityRow: {
    flexDirection: 'row',
    gap: 4,
  },
  utilityBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'background 0.15s ease' } as any)
      : {}),
  },
  utilityBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  utilityBtnActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.4,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  },
  backspaceBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  backspaceBtnHover: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  backspaceBtnDisabled: {
    opacity: 0.3,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  digit: {
    width: '32%',
    aspectRatio: 1.7,
    borderRadius: 10,
    backgroundColor: '#242426',
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ cursor: 'pointer', transition: 'all 0.1s ease' } as any)
      : {}),
  },
  digitHover: {
    backgroundColor: '#2c2c2e',
  },
  digitPressed: {
    backgroundColor: '#3a3a3c',
    transform: [{ scale: 0.97 }],
  },
  digitNum: {
    color: Colors.text.primary,
    fontSize: 20,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  digitLetters: {
    color: Colors.text.muted,
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 1,
  },
  utilityEmpty: {
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d0d0d',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  utilityEmptyText: {
    color: Colors.text.muted,
    fontSize: 12,
  },
  errorText: {
    color: '#ff3b30',
    fontSize: 12,
    fontWeight: '500',
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#34c759',
    ...(Platform.OS === 'web'
      ? ({
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(52,199,89,0.35)',
          transition: 'all 0.15s ease',
        } as any)
      : {}),
  },
  callBtnHover: {
    backgroundColor: '#30b753',
  },
  callBtnDisabled: {
    backgroundColor: '#2c2c2e',
    ...(Platform.OS === 'web' ? ({ cursor: 'not-allowed', boxShadow: 'none' } as any) : {}),
  },
  callBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
