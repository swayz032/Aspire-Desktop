import React from 'react';
import { View } from 'react-native';
import { DesktopHome } from '@/components/desktop/DesktopHome';

const NATURAL_WIDTH = 1440;
const NATURAL_HEIGHT = 980;
const SCALE = 0.72;
const CLIP_HEIGHT = 660;

export default function CockpitMockup() {
  return (
    <div style={{
      width: '100%',
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

      {/* Clip container — shows only the top CLIP_HEIGHT px of the scaled dashboard */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: CLIP_HEIGHT,
        overflow: 'hidden',
      }}>
        {/* Scaled DesktopHome — pointer-events frozen, non-interactive */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: NATURAL_WIDTH,
          height: NATURAL_HEIGHT,
          transform: `scale(${SCALE})`,
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
          height: 100,
          background: 'linear-gradient(to bottom, transparent, #050508)',
          pointerEvents: 'none',
          zIndex: 10,
        }} />
      </div>
    </div>
  );
}
