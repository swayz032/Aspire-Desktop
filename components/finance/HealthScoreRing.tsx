import React from 'react';
import { Platform } from 'react-native';

interface Props {
  score?: number;
  connectedCount?: number;
  mismatchCount?: number;
  cashRunwayDays?: number;
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

export function HealthScoreRing({ score, connectedCount = 0, mismatchCount = 0, cashRunwayDays = 60 }: Props) {
  if (Platform.OS !== 'web') return null;

  const finalScore = score ?? deriveScore(connectedCount, mismatchCount, cashRunwayDays);
  const { label, color } = getScoreStatus(finalScore);

  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (finalScore / 100) * circumference;
  const offset = circumference - progress;
  const gradId = 'health-ring-grad';

  return (
    <div style={{
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.07)',
      background: `radial-gradient(ellipse at 50% 50%, ${color}14 0%, transparent 70%), linear-gradient(135deg, #0A0A0F 0%, #111116 100%)`,
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: 11,
        fontWeight: 400,
        letterSpacing: 1,
        textTransform: 'uppercase' as const,
        marginBottom: 12,
        alignSelf: 'flex-start',
      }}>
        FINANCE HEALTH
      </div>
      <div style={{ position: 'relative', width: size, height: size }}>
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
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            color: '#fff',
            fontSize: 40,
            fontWeight: 700,
            lineHeight: '44px',
          }}>
            {finalScore}
          </div>
          <div style={{
            color,
            fontSize: 12,
            fontWeight: 600,
            marginTop: 2,
          }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
