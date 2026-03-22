/**
 * Unified clipboard utility — cross-platform clipboard operations.
 *
 * Uses expo-clipboard which handles web, iOS, and Android internally.
 * Replaces raw `navigator.clipboard.writeText()` calls that only work on web.
 */
import * as Clipboard from 'expo-clipboard';
import { devWarn } from '@/lib/devLog';

/** Copy text to clipboard. Returns true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch (err) {
    devWarn('[Clipboard] copy failed:', err);
    return false;
  }
}

/** Read text from clipboard. Returns empty string on failure. */
export async function readFromClipboard(): Promise<string> {
  try {
    return await Clipboard.getStringAsync();
  } catch {
    return '';
  }
}
