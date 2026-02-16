import { Platform } from 'react-native';

export const CARD_BG = '#1C1C1E';
export const CARD_BORDER = 'rgba(255,255,255,0.06)';
export const CARD_BORDER_HOVER = 'rgba(255,255,255,0.10)';

export const premiumCard = {
  backgroundColor: CARD_BG,
  borderWidth: 1,
  borderColor: CARD_BORDER,
  borderRadius: 14,
  overflow: 'hidden' as const,
};

export const premiumCardWeb = (pattern?: string) => {
  if (Platform.OS !== 'web') return {};
  const base: Record<string, any> = {
    background: CARD_BG,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 14,
    overflow: 'hidden',
  };
  if (pattern) {
    base.backgroundImage = pattern;
    base.backgroundRepeat = 'no-repeat';
  }
  return base;
};

const enc = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

export const svgPatterns = {
  trendLine: (color = 'rgba(255,255,255,0.04)', accent = 'rgba(59,130,246,0.08)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">` +
    `<path d="M0 160 Q80 140 140 120 T240 80 T340 40 L400 20" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    `<path d="M0 180 Q100 160 180 130 T300 70 L400 40" fill="none" stroke="${color}" stroke-width="1"/>` +
    `<circle cx="140" cy="120" r="3" fill="${accent}"/>` +
    `<circle cx="240" cy="80" r="3" fill="${accent}"/>` +
    `<circle cx="340" cy="40" r="3" fill="${accent}"/>` +
    `</svg>`
  ),
  gridDots: (color = 'rgba(255,255,255,0.025)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">` +
    `<circle cx="15" cy="15" r="1" fill="${color}"/>` +
    `</svg>`
  ),
  diagonalLines: (color = 'rgba(255,255,255,0.025)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">` +
    `<line x1="0" y1="40" x2="40" y2="0" stroke="${color}" stroke-width="0.5"/>` +
    `</svg>`
  ),
  concentricRings: (color = 'rgba(255,255,255,0.03)', accent = 'rgba(59,130,246,0.06)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">` +
    `<circle cx="160" cy="40" r="80" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<circle cx="160" cy="40" r="55" fill="none" stroke="${accent}" stroke-width="0.6"/>` +
    `<circle cx="160" cy="40" r="30" fill="none" stroke="${color}" stroke-width="0.5"/>` +
    `</svg>`
  ),
  barChart: (color = 'rgba(255,255,255,0.03)', accent = 'rgba(59,130,246,0.05)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160">` +
    `<rect x="20" y="100" width="20" height="50" rx="3" fill="${color}"/>` +
    `<rect x="55" y="70" width="20" height="80" rx="3" fill="${accent}"/>` +
    `<rect x="90" y="85" width="20" height="65" rx="3" fill="${color}"/>` +
    `<rect x="125" y="50" width="20" height="100" rx="3" fill="${accent}"/>` +
    `<rect x="160" y="60" width="20" height="90" rx="3" fill="${color}"/>` +
    `<rect x="195" y="30" width="20" height="120" rx="3" fill="${accent}"/>` +
    `<rect x="230" y="45" width="20" height="105" rx="3" fill="${color}"/>` +
    `<rect x="265" y="20" width="20" height="130" rx="3" fill="${accent}"/>` +
    `</svg>`
  ),
  currency: (color = 'rgba(255,255,255,0.025)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">` +
    `<text x="60" y="70" text-anchor="middle" font-family="system-ui" font-size="48" font-weight="600" fill="${color}">$</text>` +
    `</svg>`
  ),
  shieldCheck: (color = 'rgba(255,255,255,0.03)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="180" viewBox="0 0 160 180">` +
    `<path d="M80 10 L140 40 L140 100 Q140 150 80 170 Q20 150 20 100 L20 40 Z" fill="none" stroke="${color}" stroke-width="1.5"/>` +
    `<path d="M55 90 L75 110 L110 65" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `</svg>`
  ),
  networkNodes: (color = 'rgba(255,255,255,0.03)', accent = 'rgba(59,130,246,0.05)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
    `<line x1="60" y1="40" x2="120" y2="80" stroke="${color}" stroke-width="0.8"/>` +
    `<line x1="120" y1="80" x2="180" y2="50" stroke="${color}" stroke-width="0.8"/>` +
    `<line x1="120" y1="80" x2="160" y2="130" stroke="${color}" stroke-width="0.8"/>` +
    `<line x1="60" y1="40" x2="80" y2="120" stroke="${color}" stroke-width="0.8"/>` +
    `<circle cx="60" cy="40" r="5" fill="${accent}"/>` +
    `<circle cx="120" cy="80" r="6" fill="${accent}"/>` +
    `<circle cx="180" cy="50" r="4" fill="${accent}"/>` +
    `<circle cx="160" cy="130" r="5" fill="${accent}"/>` +
    `<circle cx="80" cy="120" r="4" fill="${accent}"/>` +
    `</svg>`
  ),
  invoice: (color = 'rgba(255,255,255,0.025)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="180" viewBox="0 0 140 180">` +
    `<rect x="20" y="10" width="100" height="160" rx="6" fill="none" stroke="${color}" stroke-width="1.2"/>` +
    `<line x1="40" y1="45" x2="100" y2="45" stroke="${color}" stroke-width="1"/>` +
    `<line x1="40" y1="65" x2="90" y2="65" stroke="${color}" stroke-width="0.8"/>` +
    `<line x1="40" y1="85" x2="95" y2="85" stroke="${color}" stroke-width="0.8"/>` +
    `<line x1="40" y1="105" x2="80" y2="105" stroke="${color}" stroke-width="0.8"/>` +
    `<line x1="40" y1="135" x2="100" y2="135" stroke="${color}" stroke-width="1.2"/>` +
    `</svg>`
  ),
  people: (color = 'rgba(255,255,255,0.03)', accent = 'rgba(139,92,246,0.05)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="140" viewBox="0 0 200 140">` +
    `<circle cx="70" cy="40" r="16" fill="none" stroke="${color}" stroke-width="1.2"/>` +
    `<path d="M42 95 Q42 70 70 70 Q98 70 98 95" fill="none" stroke="${color}" stroke-width="1.2"/>` +
    `<circle cx="130" cy="40" r="16" fill="none" stroke="${accent}" stroke-width="1"/>` +
    `<path d="M102 95 Q102 70 130 70 Q158 70 158 95" fill="none" stroke="${accent}" stroke-width="1"/>` +
    `</svg>`
  ),
  financeDashboard: (color = 'rgba(255,255,255,0.03)', accent = 'rgba(59,130,246,0.06)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200" viewBox="0 0 480 200">` +
    `<path d="M20 160 Q60 140 100 130 T180 100 T260 70 T340 50 T420 30 L460 20" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round"/>` +
    `<path d="M20 170 Q80 155 140 145 T220 120 T300 95 T380 65 L460 45" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<path d="M20 180 Q90 170 160 160 T260 140 T360 110 L460 80" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.6"/>` +
    `<circle cx="100" cy="130" r="2.5" fill="${accent}" opacity="0.8"/>` +
    `<circle cx="180" cy="100" r="2.5" fill="${accent}" opacity="0.8"/>` +
    `<circle cx="260" cy="70" r="3" fill="${accent}" opacity="0.9"/>` +
    `<circle cx="340" cy="50" r="2.5" fill="${accent}" opacity="0.8"/>` +
    `<circle cx="420" cy="30" r="3" fill="${accent}"/>` +
    `<rect x="80" y="140" width="1" height="30" fill="${color}" opacity="0.3"/>` +
    `<rect x="160" y="110" width="1" height="60" fill="${color}" opacity="0.3"/>` +
    `<rect x="240" y="80" width="1" height="90" fill="${color}" opacity="0.3"/>` +
    `<rect x="320" y="60" width="1" height="110" fill="${color}" opacity="0.3"/>` +
    `<rect x="400" y="40" width="1" height="130" fill="${color}" opacity="0.3"/>` +
    `</svg>`
  ),
  pulseWave: (color = 'rgba(255,255,255,0.025)', accent = 'rgba(16,185,129,0.06)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="120" viewBox="0 0 300 120">` +
    `<path d="M0 60 L30 60 L45 20 L60 90 L75 40 L90 70 L105 55 L120 60 L150 60 L165 25 L180 85 L195 45 L210 65 L225 58 L240 60 L300 60" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="M0 60 L30 60 L45 20 L60 90 L75 40 L90 70 L105 55 L120 60 L150 60 L165 25 L180 85 L195 45 L210 65 L225 58 L240 60 L300 60" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity="0.3"/>` +
    `</svg>`
  ),
  hexGrid: (color = 'rgba(255,255,255,0.02)', accent = 'rgba(139,92,246,0.04)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="180" viewBox="0 0 200 180">` +
    `<polygon points="60,10 90,25 90,55 60,70 30,55 30,25" fill="none" stroke="${color}" stroke-width="0.6"/>` +
    `<polygon points="120,10 150,25 150,55 120,70 90,55 90,25" fill="none" stroke="${accent}" stroke-width="0.6"/>` +
    `<polygon points="60,70 90,85 90,115 60,130 30,115 30,85" fill="none" stroke="${accent}" stroke-width="0.6"/>` +
    `<polygon points="120,70 150,85 150,115 120,130 90,115 90,85" fill="none" stroke="${color}" stroke-width="0.6"/>` +
    `<polygon points="180,40 200,52 200,78 180,90 160,78 160,52" fill="none" stroke="${color}" stroke-width="0.4" opacity="0.5"/>` +
    `<polygon points="0,40 20,52 20,78 0,90 -10,78 -10,52" fill="none" stroke="${color}" stroke-width="0.4" opacity="0.5"/>` +
    `</svg>`
  ),
  isometricBlocks: (color = 'rgba(255,255,255,0.02)', accent = 'rgba(59,130,246,0.04)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="180" viewBox="0 0 260 180">` +
    `<path d="M130 20 L200 60 L130 100 L60 60 Z" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<path d="M130 100 L130 140 L60 100 L60 60" fill="none" stroke="${color}" stroke-width="0.6"/>` +
    `<path d="M130 100 L130 140 L200 100 L200 60" fill="none" stroke="${accent}" stroke-width="0.6"/>` +
    `<path d="M80 90 L130 118 L180 90" fill="none" stroke="${color}" stroke-width="0.4" opacity="0.4"/>` +
    `<path d="M60 50 L110 78 L160 50" fill="none" stroke="${accent}" stroke-width="0.4" opacity="0.3"/>` +
    `</svg>`
  ),
  flowLines: (color = 'rgba(255,255,255,0.025)', accent = 'rgba(6,182,212,0.05)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="160" viewBox="0 0 300 160">` +
    `<path d="M0 40 C50 40 50 80 100 80 S150 120 200 120 S250 80 300 80" fill="none" stroke="${accent}" stroke-width="1" opacity="0.8"/>` +
    `<path d="M0 60 C50 60 50 100 100 100 S150 60 200 60 S250 100 300 100" fill="none" stroke="${color}" stroke-width="0.8" opacity="0.6"/>` +
    `<path d="M0 80 C50 80 50 40 100 40 S150 80 200 80 S250 40 300 40" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.4"/>` +
    `<circle cx="100" cy="80" r="2" fill="${accent}" opacity="0.6"/>` +
    `<circle cx="200" cy="120" r="2" fill="${accent}" opacity="0.6"/>` +
    `</svg>`
  ),
  circuitBoard: (color = 'rgba(255,255,255,0.02)', accent = 'rgba(245,158,11,0.04)') => enc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">` +
    `<path d="M20 80 H60 V40 H100 V80 H140 V120 H180 V80 H220" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<path d="M40 20 V60 H80 V100 H120 V60 H160 V100 H200 V140" fill="none" stroke="${accent}" stroke-width="0.6"/>` +
    `<circle cx="60" cy="40" r="3" fill="none" stroke="${accent}" stroke-width="0.8"/>` +
    `<circle cx="100" cy="80" r="3" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<circle cx="140" cy="120" r="3" fill="none" stroke="${accent}" stroke-width="0.8"/>` +
    `<circle cx="180" cy="80" r="3" fill="none" stroke="${color}" stroke-width="0.8"/>` +
    `<rect cx="60" cy="40" x="58" y="38" width="4" height="4" rx="1" fill="${accent}" opacity="0.5"/>` +
    `<rect cx="140" cy="120" x="138" y="118" width="4" height="4" rx="1" fill="${accent}" opacity="0.5"/>` +
    `</svg>`
  ),
};

export type PatternPosition = 'right' | 'left' | 'center' | 'top-right' | 'bottom-right' | 'bottom-left';

export const cardWithPattern = (patternSvg: string, position: PatternPosition = 'right', size = '50%') => {
  if (Platform.OS !== 'web') return { backgroundColor: CARD_BG };
  const posMap: Record<PatternPosition, string> = {
    'right': 'right center',
    'left': 'left center',
    'center': 'center center',
    'top-right': 'top right',
    'bottom-right': 'bottom right',
    'bottom-left': 'bottom left',
  };
  return {
    background: CARD_BG,
    backgroundImage: patternSvg,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: posMap[position],
    backgroundSize: size,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 14,
    overflow: 'hidden',
  } as any;
};

export const heroCardBg = (accent1: string, accent2?: string) => {
  if (Platform.OS !== 'web') return { backgroundColor: CARD_BG };
  const layers = [
    `radial-gradient(ellipse at top right, ${accent1}12 0%, transparent 50%)`,
    accent2 ? `radial-gradient(ellipse at bottom left, ${accent2}0a 0%, transparent 50%)` : '',
    CARD_BG,
  ].filter(Boolean).join(', ');
  return {
    background: layers,
    border: `1px solid ${CARD_BORDER}`,
    borderRadius: 16,
    overflow: 'hidden',
  } as any;
};

export const gridDotsBg = () => {
  if (Platform.OS !== 'web') return {};
  return {
    backgroundImage: svgPatterns.gridDots(),
    backgroundRepeat: 'repeat',
    backgroundSize: '30px 30px',
  } as any;
};

export const diagonalLinesBg = () => {
  if (Platform.OS !== 'web') return {};
  return {
    backgroundImage: svgPatterns.diagonalLines(),
    backgroundRepeat: 'repeat',
    backgroundSize: '40px 40px',
  } as any;
};
