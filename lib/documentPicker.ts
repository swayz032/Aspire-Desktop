/**
 * documentPicker — Cross-platform file picker utility.
 *
 * Uses expo-document-picker which handles:
 * - Web: <input type="file"> dialog
 * - iOS: UIDocumentPickerViewController
 * - Android: ACTION_OPEN_DOCUMENT intent
 *
 * Returns picked file info or null if user cancelled.
 */
import * as DocumentPicker from 'expo-document-picker';
import { devWarn } from '@/lib/devLog';

export interface PickedDocument {
  uri: string;
  name: string;
  size: number | undefined;
  mimeType: string | undefined;
}

export interface PickDocumentOptions {
  /** MIME types to allow (e.g., ['application/pdf', 'image/*']) */
  types?: string[];
  /** Allow picking multiple files */
  multiple?: boolean;
}

/** Open native file picker. Returns array of picked documents, or empty array if cancelled. */
export async function pickDocuments(
  options: PickDocumentOptions = {}
): Promise<PickedDocument[]> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: options.types ?? ['*/*'],
      multiple: options.multiple ?? false,
      copyToCacheDirectory: true,
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map(asset => ({
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? undefined,
      mimeType: asset.mimeType ?? undefined,
    }));
  } catch (err) {
    devWarn('[DocumentPicker] pick failed:', err);
    return [];
  }
}

/** Convenience: pick a single document. Returns document or null if cancelled. */
export async function pickDocument(
  options: Omit<PickDocumentOptions, 'multiple'> = {}
): Promise<PickedDocument | null> {
  const docs = await pickDocuments({ ...options, multiple: false });
  return docs[0] ?? null;
}
