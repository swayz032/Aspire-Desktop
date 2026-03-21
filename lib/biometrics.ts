/**
 * biometrics — Cross-platform biometric authentication wrapper.
 *
 * Native (iOS/Android): Uses expo-local-authentication (Face ID, fingerprint, iris).
 * Web: Returns false — biometrics not available on web.
 *
 * Governance:
 * - Law 4 (Risk Tiers): RED-tier approvals can require biometric confirmation
 * - Law 9 (Security): Device-level authentication strengthens identity assurance
 */
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIOMETRIC_PREF_KEY = 'aspire_biometric_enabled';

/** Check if biometric hardware is available and enrolled. */
export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;

    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

/** Get supported biometric types (for display purposes). */
export async function getSupportedBiometricTypes(): Promise<string[]> {
  if (Platform.OS === 'web') return [];

  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types.map(t => {
      switch (t) {
        case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
          return 'Face ID';
        case LocalAuthentication.AuthenticationType.FINGERPRINT:
          return 'Fingerprint';
        case LocalAuthentication.AuthenticationType.IRIS:
          return 'Iris';
        default:
          return 'Biometric';
      }
    });
  } catch {
    return [];
  }
}

/** Prompt user for biometric authentication. Returns true on success. */
export async function authenticateWithBiometrics(
  reason: string = 'Verify your identity'
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false, // Allow PIN/password fallback
      fallbackLabel: 'Use Passcode',
    });

    return result.success;
  } catch {
    return false;
  }
}

/** Get stored biometric preference. */
export async function getBiometricPreference(): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(BIOMETRIC_PREF_KEY) === 'true';
    } catch {
      return false;
    }
  }

  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_PREF_KEY);
    return value === 'true';
  } catch {
    return false;
  }
}

/** Store biometric preference. */
export async function setBiometricPreference(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(BIOMETRIC_PREF_KEY, String(enabled));
    } catch {}
    return;
  }

  try {
    await SecureStore.setItemAsync(BIOMETRIC_PREF_KEY, String(enabled));
  } catch {}
}
