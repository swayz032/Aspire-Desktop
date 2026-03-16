import React from 'react';
import { Platform } from 'react-native';

interface Props {
  score?: number;
  connectedCount?: number;
  mismatchCount?: number;
  cashRunwayDays?: number;
  accentColor?: string;
}

function deriveScore(connectedCount: number, mismatchCount: number, cashRunwayDays: number): number {
  let s = 50;
  if (connectedCount >= 3) s += 20;
  else if (connectedCount >= 1) s += 10;
  if (mismatchCount === 0) s += 20;
  else if (mismatchCount <= 3) s += 10;
  else s -= 10;
  if (cashRunwayDays >= 90) s += 10;
  else if (cashRunwayDays >= 30) s += 5;
  else s -= 10;
  return Math.max(0, Math.min(100, s));
}

function getScoreStatus(score: number): { label: string; color: string } {
  if (score >= 70) return { label: 'Healthy', color: '#10B981' };
  if (score >= 40) return { label: 'Watch', color: '#F59E0B' };
  return { label: 'Critical', color: '#EF4444' };
}

function deriveReasons(connectedCount: number, mismatchCount: number, cashRunwayDays: number) {
  const reasons: { label: string; pts: string; color: string }[] = [];

  if (connectedCount >= 3) reasons.push({ label: '3+ accounts connected', pts: '+20', color: '#10B981' });
  else if (connectedCount >= 1) reasons.push({ label: '1–2 accounts connected', pts: '+10', color: '#F59E0B' });
  else reasons.push({ label: 'No accounts connected', pts: '+0', color: 'rgba(255,255,255,0.35)' });

  if (mismatchCount === 0) reasons.push({ label: 'No mismatches found', pts: '+20', color: '#10B981' });
  else if (mismatchCount <= 3) reasons.push({ label: `${mismatchCount} mismatches`, pts: '+10', color: '#F59E0B' });
  else reasons.push({ label: `${mismatchCount} mismatches`, pts: '-10', color: '#EF4444' });

  if (cashRunwayDays >= 90) reasons.push({ label: `${cashRunwayDays}d runway`, pts: '+10', color: '#10B981' });
  else if (cashRunwayDays >= 30) reasons.push({ label: `${cashRunwayDays}d runway`, pts: '+5', color: '#F59E0B' });
  else reasons.push({ label: `${cashRunwayDays}d runway`, pts: '-10', color: '#EF4444' });

  return reasons;
}

export function HealthScoreRing({
  score,
  connectedCount = 0,
  mismatchCount = 0,
  cashRunwayDays = 60,
  accentColor,
}: Props) {
  if (Platform.OS !== 'web') return null;

  const finalScore = score ?? deriveScore(connectedCount, mismatchCount, cashRunwayDays);
  const { label, color } = getScoreStatus(finalScore);
  const reasons = deriveReasons(connectedCount, mismatchCount, cashRunwayDays);

  const size = 120;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (finalScore / 100) * circumference;
  const offset = circumference - progress;
  const gradId = 'health-ring-grad';

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: accentColor ? `2px solid ${accentColor}` : '1px solid rgba(255,255,255,0.07)',
        background: '#1C1C1E',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box' as const,
        transition: 'border-color 0.4s ease',
      }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 11,
          fontWeight: 400,
          letterSpacing: 1,
          textTransform: 'uppercase' as const,
          marginBottom: 10,
          flexShrink: 0,
        }}
      >
        FINANCE HEALTH
      </div>

      <div style={{ position: 'relative', width: size, height: size, alignSelf: 'center', marginBottom: 12, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={1} />
              <stop offset="50%" stopColor={color} stopOpacity={0.7} />
              <stop offset="100%" stopColor={color} stopOpacity={0.4} />
            </linearGradient>
            <filter id="ring-score-glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            filter="url(#ring-score-glow)"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ color: '#fff', fontSize: 36, fontWeight: 700, lineHeight: '40px' }}>
            {finalScore}
          </div>
          <div style={{ color, fontSize: 11, fontWeight: 600, marginTop: 2 }}>
            {label}
          </div>
        </div>
      </div>

      <div
        style={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: 10,
          fontWeight: 400,
          letterSpacing: 1,
          textTransform: 'uppercase' as const,
          marginBottom: 6,
          flexShrink: 0,
        }}
      >
        SCORE BREAKDOWN
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {reasons.map((r, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 0',
              ...(i < reasons.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : {}),
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{r.label}</span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: r.color,
                backgroundColor:
                  typeof r.color === 'string' && r.color.startsWith('#')
                    ? r.color + '20'
                    : 'rgba(255,255,255,0.05)',
                borderRadius: 8,
                padding: '2px 7px',
              }}
            >
              {r.pts}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
