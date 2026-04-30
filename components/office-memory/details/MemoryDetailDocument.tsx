/**
 * MemoryDetailDocument — center column for `document` and `artifact_reference`.
 *
 * Layout (per plan §15.B):
 *   - Title + filename (header is owned by parent)
 *   - PDFViewer / image / markdown by mime
 *   - File metadata (size, uploaded by, version)
 *   - Version history list
 */

import React, { useMemo } from 'react';
import { Image, Platform, StyleSheet, Text, View, type ImageStyle, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius } from '@/constants/tokens';
import type { MemoryDetail } from '../types';
import { PDFViewer } from '../blocks/PDFViewer';
import { MemoryBody } from './MemoryBody';

export interface MemoryDetailDocumentProps {
  memory: MemoryDetail;
}

function isImageMime(mime?: string): boolean {
  return !!mime && mime.startsWith('image/');
}
function isPdfMime(mime?: string): boolean {
  return !!mime && (mime === 'application/pdf' || mime.endsWith('/pdf'));
}

export function MemoryDetailDocument({ memory }: MemoryDetailDocumentProps) {
  const file = memory.file;
  const mime = file?.mime;

  const previewKind: 'pdf' | 'image' | 'markdown' | 'none' = useMemo(() => {
    if (file?.src && isPdfMime(mime)) return 'pdf';
    if (file?.src && isImageMime(mime)) return 'image';
    if (memory.body) return 'markdown';
    return 'none';
  }, [file, mime, memory.body]);

  return (
    <View style={styles.column}>
      {previewKind === 'pdf' && file?.src && (
        <PDFViewer
          src={file.src}
          filename={memory.title}
          meta={[mime, file.sizeLabel].filter(Boolean).join(' · ')}
          eyebrow="Document"
          defaultExpanded={false}
        />
      )}

      {previewKind === 'image' && file?.src && (
        <View style={styles.imageCard}>
          <Text style={styles.eyebrow}>Image</Text>
          <View style={styles.imageFrame}>
            <Image
              source={{ uri: file.src }}
              style={styles.image as ImageStyle}
              accessibilityLabel={memory.title}
              resizeMode="contain"
            />
          </View>
        </View>
      )}

      {previewKind === 'markdown' && memory.body && (
        <MemoryBody content={memory.body} format={memory.bodyFormat ?? 'markdown'} />
      )}

      {previewKind === 'none' && (
        <View style={styles.noPreview}>
          <Ionicons name="document-outline" size={32} color={Colors.text.tertiary as string} />
          <Text style={styles.noPreviewTitle}>Preview unavailable</Text>
          <Text style={styles.noPreviewSub}>
            {file?.src ? `${mime ?? 'unknown type'} not previewable inline` : 'No file attached.'}
          </Text>
        </View>
      )}

      <FileMetaCard memory={memory} />

      {memory.versionHistory && memory.versionHistory.length > 0 && (
        <VersionHistoryCard history={memory.versionHistory} />
      )}
    </View>
  );
}

// ─── Sub-cards ──────────────────────────────────────────────────────────────

function FileMetaCard({ memory }: { memory: MemoryDetail }) {
  const file = memory.file;
  const rows: Array<{ label: string; value: string }> = [];
  if (file?.mime) rows.push({ label: 'Type', value: file.mime });
  if (file?.sizeLabel) rows.push({ label: 'Size', value: file.sizeLabel });
  if (file?.uploadedBy ?? memory.createdBy)
    rows.push({ label: 'Uploaded by', value: (file?.uploadedBy ?? memory.createdBy) });
  if (file?.version) rows.push({ label: 'Version', value: file.version });

  return (
    <View style={styles.metaCard}>
      <Text style={styles.eyebrow}>File</Text>
      {rows.length === 0 ? (
        <Text style={styles.empty}>No file metadata captured.</Text>
      ) : (
        <View style={styles.metaList}>
          {rows.map((row) => (
            <View key={row.label} style={styles.metaRow}>
              <Text style={styles.metaLabel}>{row.label}</Text>
              <Text style={styles.metaValue}>{row.value}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function VersionHistoryCard({
  history,
}: {
  history: NonNullable<MemoryDetail['versionHistory']>;
}) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.eyebrow}>Version History</Text>
      <View style={styles.metaList}>
        {history.map((v, i) => (
          <View key={`${v.version}-${i}`} style={styles.versionRow}>
            <View style={styles.versionDot} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.versionLabel}>{v.version}</Text>
              <Text style={styles.versionMeta}>
                {v.date}
                {v.actor ? ` · ${v.actor}` : ''}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  column: { gap: 16 },
  imageCard: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    gap: 16,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  imageFrame: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0c0c10',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.tertiary as string,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  noPreview: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: BorderRadius.xl,
    paddingVertical: 36,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderStyle: 'dashed',
  },
  noPreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary as string,
  },
  noPreviewSub: {
    fontSize: 12,
    color: Colors.text.muted as string,
  },
  metaCard: {
    backgroundColor: Colors.memory.cardBg as string,
    borderRadius: BorderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow:
            '0 1px 3px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.20), inset 0 1px 0 rgba(255,255,255,0.03)',
        } as unknown as ViewStyle)
      : {
          shadowColor: '#000',
          shadowOpacity: 0.30,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 4,
        }),
  },
  metaList: { gap: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  metaLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.tertiary as string,
    width: 110,
    flexShrink: 0,
    paddingTop: 1,
    letterSpacing: 0.1,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary as string,
    flex: 1,
    lineHeight: 22,
    letterSpacing: -0.05,
  },
  empty: {
    fontSize: 14,
    color: Colors.text.tertiary as string,
    fontStyle: 'italic',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#60A5FA',
    marginTop: 6,
  },
  versionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary as string,
    letterSpacing: -0.05,
  },
  versionMeta: {
    fontSize: 11,
    fontWeight: '400',
    color: Colors.text.tertiary as string,
  },
});

export default MemoryDetailDocument;
