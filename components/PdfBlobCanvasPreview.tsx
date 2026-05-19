/**
 * PdfBlobCanvasPreview — renders a PDF blob URL inline using pdfjs-dist
 * to draw each page on a <canvas>. NO iframe, NO <object>, NO browser PDF
 * plugin dependency. Works regardless of Chrome's PDF setting
 * (chrome://settings/content/pdfDocuments) — pure JavaScript pixel rendering.
 *
 * Why this exists: the iframe-based PDF preview was unreliable across users
 * because Chrome's "Download PDFs" setting suppresses inline rendering of
 * application/pdf in iframes/objects/embeds. Many users had this set
 * (intentionally or by enterprise policy), so the modal showed "browser
 * cannot display this PDF inline" or a CSP-blocked area. Canvas rendering
 * sidesteps that entire layer.
 *
 * Worker: served same-origin from /vendor/pdfjs/pdf.worker.min.mjs
 * (copied from node_modules/pdfjs-dist/build/ during the desktop build).
 * Keeping it same-origin avoids needing to widen `script-src` or
 * `worker-src` CSP for an external CDN.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface PdfBlobCanvasPreviewProps {
  /** Same-origin blob URL of the PDF (created via URL.createObjectURL). */
  blobUrl: string;
  /** Accent color for the loading indicator and CTA. */
  accentColor?: string;
  /** Optional accessible label for screen readers. */
  ariaLabel?: string;
}

type RenderState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; pageCount: number }
  | { kind: 'error'; message: string };

// Lazy-loaded pdfjs module — heavy (~400KB) so don't pull it into the main
// chunk. Cached at module scope so the second open of the modal is instant.
let pdfjsModule: typeof import('pdfjs-dist') | null = null;
let pdfjsLoadPromise: Promise<typeof import('pdfjs-dist')> | null = null;

async function loadPdfjs() {
  if (pdfjsModule) return pdfjsModule;
  if (pdfjsLoadPromise) return pdfjsLoadPromise;
  pdfjsLoadPromise = import('pdfjs-dist').then((mod) => {
    // Worker source MUST be set before getDocument is called. Same-origin
    // so no CSP friction and no external dependency.
    mod.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    pdfjsModule = mod;
    return mod;
  });
  return pdfjsLoadPromise;
}

export function PdfBlobCanvasPreview({ blobUrl, accentColor = '#3B82F6', ariaLabel }: PdfBlobCanvasPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<RenderState>({ kind: 'idle' });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!blobUrl) return;

    let cancelled = false;
    setState({ kind: 'loading' });

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        if (cancelled) return;

        const loadingTask = pdfjs.getDocument({ url: blobUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }

        const container = containerRef.current;
        if (!container) return;
        // Clear any prior render (modal re-open on a different invoice).
        container.innerHTML = '';

        const deviceScale = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) {
            await pdf.destroy();
            return;
          }
          const page = await pdf.getPage(pageNum);
          // Fit to container width while preserving aspect ratio. We re-read
          // container width per page so resize during render still works.
          const baseViewport = page.getViewport({ scale: 1 });
          const containerWidth = container.clientWidth || 800;
          const scale = (containerWidth / baseViewport.width) * 0.96; // 4% gutter
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width * deviceScale);
          canvas.height = Math.floor(viewport.height * deviceScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          canvas.style.display = 'block';
          canvas.style.margin = pageNum === 1 ? '16px auto' : '12px auto';
          canvas.style.boxShadow = '0 2px 14px rgba(0,0,0,0.18)';
          canvas.style.borderRadius = '4px';
          canvas.style.backgroundColor = '#ffffff';

          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          ctx.scale(deviceScale, deviceScale);

          container.appendChild(canvas);

          await page.render({ canvasContext: ctx, viewport }).promise;
        }

        if (!cancelled) setState({ kind: 'ready', pageCount: pdf.numPages });
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[PdfBlobCanvasPreview] render failed', err);
        setState({
          kind: 'error',
          message: err instanceof Error ? err.message : 'Failed to render PDF',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blobUrl]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fallback}>
        <Ionicons name="document-text-outline" size={32} color="#6e6e73" />
        <Text style={styles.fallbackText}>PDF preview is available in browser.</Text>
      </View>
    );
  }

  return (
    <View style={styles.outer}>
      {(state.kind === 'idle' || state.kind === 'loading') && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={styles.loadingText}>Loading invoice…</Text>
        </View>
      )}
      {state.kind === 'error' && (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle-outline" size={32} color="#fca5a5" />
          <Text style={styles.errorText}>{state.message}</Text>
          <Pressable
            onPress={() => {
              if (typeof window !== 'undefined') {
                window.open(blobUrl, '_blank', 'noopener,noreferrer');
              }
            }}
            style={[styles.openButton, { backgroundColor: accentColor }]}
          >
            <Text style={styles.openButtonText}>Open invoice PDF</Text>
          </Pressable>
        </View>
      )}
      <div
        ref={containerRef}
        aria-label={ariaLabel || 'PDF preview'}
        style={{
          width: '100%',
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          backgroundColor: '#1a1a1c',
          padding: 0,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#1a1a1c',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 1,
  },
  loadingText: {
    fontSize: 13,
    color: '#6e6e73',
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    zIndex: 2,
    backgroundColor: '#111113',
  },
  errorText: {
    fontSize: 13,
    color: '#a1a1a6',
    textAlign: 'center',
  },
  openButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  openButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#111113',
  },
  fallbackText: {
    fontSize: 13,
    color: '#6e6e73',
  },
});
