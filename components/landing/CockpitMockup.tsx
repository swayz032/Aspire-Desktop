import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { DesktopHome } from '@/components/desktop/DesktopHome';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const NATURAL_WIDTH = 1440;
const NATURAL_HEIGHT = 980;
const MAX_SCALE = 0.72;
// Width at which we hit MAX_SCALE. Below this, scale linearly down so the
// mockup never exceeds the viewport width on tablet (e.g. iPad portrait 1024).
const SCALE_REFERENCE_WIDTH = 1500;
const CLIP_HEIGHT = 620;

function CockpitMockupInner() {
  const { width } = useWindowDimensions();
  // Dynamic scale: full 0.72 on desktop (>=1500 CSS px), linearly smaller on tablet.
  // At 1024 px (iPad portrait) -> ~0.683 -> scaled width ~983 px (fits viewport).
  const scale = Math.min(MAX_SCALE, width / SCALE_REFERENCE_WIDTH);
  const scaledWidth = NATURAL_WIDTH * scale;
  const clipHeight = Math.min(CLIP_HEIGHT, NATURAL_HEIGHT * scale);

  return (
    // Outer guard rail — even if scaledWidth math is slightly off,
    // overflow:hidden + maxWidth:100% guarantee the mockup cannot push the
    // page horizontally and trigger pannable Safari behaviour on iPad.
    <div style={{
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      display: 'flex',
      justifyContent: 'center',
      boxSizing: 'border-box',
    }}>
      <div data-testid="landing-cockpit-frame" style={{
        width: scaledWidth,
        maxWidth: '100%',
        boxSizing: 'border-box',
        margin: '0 auto',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'transparent',
        boxShadow: '0 40px 120px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.07)',
      }}>
      {/* macOS browser chrome bar */}
      <div style={{
        background: '#1C1C1E',
        borderBottom: '1px solid #2C2C2E',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderRadius: '16px 16px 0 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#28C840' }} />
        </div>
        <div style={{
          flex: 1,
          background: '#2C2C2E',
          borderRadius: 6,
          padding: '5px 12px',
          fontSize: 11,
          color: '#6e6e73',
          textAlign: 'center' as const,
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
          letterSpacing: '0.01em',
        }}>
          app.aspire.ai
        </div>
        <div style={{ width: 60, flexShrink: 0 }} />
      </div>

      {/* Clip container — shows only the top CLIP_HEIGHT px of the scaled dashboard.
          Explicit pixel height (derived from the dynamic scale) keeps layout from
          collapsing when the surrounding flex column resolves children. */}
      <div data-testid="landing-cockpit-clip" style={{
        position: 'relative',
        width: '100%',
        height: `clamp(420px, 52vw, ${clipHeight}px)`,
        overflow: 'hidden',
      }}>
        {/* Scaled DesktopHome — pointer-events frozen, non-interactive */}
        <div data-testid="landing-cockpit-source" style={{
          position: 'absolute',
          top: 0,
          left: 'clamp(-430px, calc((1440px - 100vw) * 0.38), 0px)',
          width: NATURAL_WIDTH,
          height: NATURAL_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          pointerEvents: 'none' as const,
          userSelect: 'none' as const,
          WebkitUserSelect: 'none' as const,
        }}>
          {/* React Native View gives DesktopShell's flex:1 a defined pixel height */}
          <View style={{ width: NATURAL_WIDTH, height: NATURAL_HEIGHT }}>
            <DesktopHome />
          </View>
        </div>

        {/* Bottom fade — blends cut edge into hero dark background */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 160,
          background: 'linear-gradient(to bottom, transparent, #050508)',
          pointerEvents: 'none',
          zIndex: 10,
        }} />
      </div>
      </div>
    </div>
  );
}

export default function CockpitMockup(props: any) {
  return (
    <PageErrorBoundary pageName="cockpit-mockup">
      <CockpitMockupInner {...props} />
    </PageErrorBoundary>
  );
}
