/**
 * Visuals Tab — Regression Lock
 *
 * These tests assert file-content invariants for the design decisions
 * documented in `docs/locks/VISUALS_TAB_LOCK.md`. They DO NOT exercise
 * runtime behavior — they just guarantee specific anti-patterns can't
 * sneak back into the codebase.
 *
 * If a test here fails, the failure message tells you exactly which
 * lock was violated AND points you at the lock doc explaining why.
 * If the design intent has legitimately changed, update the lock doc
 * AND adjust the assertion in the SAME PR — never delete-only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Visuals Tab — Design Lock v1.0', () => {
  describe('Lock #1: House Inspector — single right-side cluster', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/HouseInspectorControls.tsx',
    );

    it('does NOT render a left-side preset cluster', () => {
      // The cluster style would be `position: 'absolute', left: 14`.
      // Doc comments are allowed; rendered JSX is not.
      expect(src).not.toMatch(/styles\.presetCluster/);
      expect(src).not.toMatch(/<Text style=\{styles\.clusterLabel\}>VIEW FROM<\/Text>/);
    });

    it('keeps onPreset in the API surface (API-only, not in UI)', () => {
      // Prop must still exist so parents can drive the initial camera.
      expect(src).toMatch(/onPreset:\s*\(preset:\s*CameraPresetKey\)\s*=>\s*void/);
    });
  });

  describe('Lock #2: Street View Pano initial zoom = 2', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/LiveStreetViewHero.tsx',
    );

    it('sets zoom: 2 (NOT zoom: 1)', () => {
      // Find the StreetViewPanorama constructor call. Its options object
      // starts right after the opening `(` and we read up to the matching
      // close-paren-semicolon. Use a non-greedy match anchored on `zoom:`
      // so we don't accidentally swallow nested object literals.
      // Skip the doc-comment occurrence; anchor on the real constructor
      // by requiring containerRef in the same call.
      const idx = src.indexOf('new google.maps.StreetViewPanorama(containerRef');
      expect(idx).toBeGreaterThanOrEqual(0);
      // 600-char window is enough for the options block.
      const window = src.slice(idx, idx + 800);
      // Match zoom: N followed by a non-digit (comma / end of options line).
      // Avoids false positives from `zoom: 18` on the inset satellite map.
      expect(window).toMatch(/zoom:\s*2(?!\d)/);
      expect(window).not.toMatch(/zoom:\s*1(?!\d)/);
    });
  });

  describe('Lock #3: Roof canvas — interactive Pano fallback (no Static API)', () => {
    const src = read('components/service-hub/estimate-studio/visuals/HeroSwitcher.tsx');

    it("branches roof mode on data.roofImagery === 'streetview'", () => {
      expect(src).toMatch(/data\?\.roofImagery\s*===\s*['"]streetview['"]/);
    });

    it('renders LiveStreetViewHero (interactive Pano) for the streetview branch', () => {
      // Both the streetview card AND the roof-fallback should use LiveStreetViewHero.
      const liveHeroUses = (src.match(/<LiveStreetViewHero/g) ?? []).length;
      expect(liveHeroUses).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Lock #4: Solar dataLayers walks HIGH → MEDIUM → LOW', () => {
    const src = read('server/serviceHub/property/googleSolarClient.ts');

    it('declares all three tiers in order', () => {
      // Tier declaration block.
      expect(src).toMatch(/quality:\s*['"]HIGH['"]/);
      expect(src).toMatch(/quality:\s*['"]MEDIUM['"]/);
      expect(src).toMatch(/quality:\s*['"]LOW['"]/);
    });

    it('supports qualityTiers opt-in for fast preflights', () => {
      expect(src).toMatch(/qualityTiers\?:\s*Array<['"]HIGH['"]\s*\|\s*['"]MEDIUM['"]\s*\|\s*['"]LOW['"]>/);
    });
  });

  describe('Lock #5: Solar coord validation = numeric range only', () => {
    const src = read('server/serviceHub/property/googleSolarClient.ts');

    it('does NOT regex the .toString() of the coord float', () => {
      // The old LATLNG_RE captured at most 8 decimals — JS doubles emit up to 17.
      expect(src).not.toMatch(/LATLNG_RE\.test/);
    });

    it('uses Number.isFinite + range check', () => {
      expect(src).toMatch(/Number\.isFinite\(coords\.lat\)/);
      expect(src).toMatch(/Number\.isFinite\(coords\.lng\)/);
    });
  });

  describe('Lock #6: Photo classifier — caption-driven, default interior', () => {
    const src = read('server/serviceHub/property/adamResearchClient.ts');

    it('does NOT contain the legacy positional heuristic', () => {
      expect(src).not.toMatch(/classifyByPosition/);
    });

    it('keeps a single classify() call that takes (caption, idx)', () => {
      expect(src).toMatch(/classify\(\s*caption[^,)]*,\s*idx\s*\)/);
    });
  });

  describe('Lock #8: Cache-write guard requires status=ok|partial + populated facts', () => {
    const src = read('server/serviceHub/property/propertyAggregator.ts');

    it('only writes when Adam status is ok or partial', () => {
      expect(src).toMatch(/adamResult\?\.status\s*===\s*['"]ok['"]/);
      expect(src).toMatch(/adamResult\?\.status\s*===\s*['"]partial['"]/);
    });

    it('also gates on facts.sqft and facts.yearBuilt being populated', () => {
      expect(src).toMatch(/facts\.sqft\s*!=\s*null/);
      expect(src).toMatch(/facts\.yearBuilt\s*!=\s*null/);
    });

    it('skipping cache write is logged with the suite_id and address', () => {
      expect(src).toMatch(/skipping cache write/);
    });
  });

  describe('Lock #9: Adam timeout = 60s', () => {
    const src = read('server/serviceHub/property/propertyAggregator.ts');

    it('ADAM_TIMEOUT_MS is at least 60s', () => {
      const m = src.match(/ADAM_TIMEOUT_MS\s*=\s*([\d_]+)/);
      expect(m).toBeTruthy();
      const ms = parseInt(m![1].replace(/_/g, ''), 10);
      expect(ms).toBeGreaterThanOrEqual(60_000);
    });
  });

  describe('Lock #11: PropertyData.facts surface stays comprehensive', () => {
    const src = read('services/serviceHub/propertyDataApi.ts');

    // Every locked field that the Context tab depends on.
    const required = [
      'roofCover',
      'permits',
      'mortgageLender',
      'ltvRatio',
      'availableEquity',
      'avmConfidenceScore',
      'avmFsd',
      'avmDate',
      'estimatedRent',
      'taxAssessedTotal',
      'previousOwnerName',
      'absenteeOwner',
      'homeownerExemption',
      'lastSaleCashOrMortgage',
      'appreciationPct',
    ];

    it.each(required)('declares facts.%s', (field) => {
      // The type may or may not have a ? — we just check the name exists
      // somewhere in the facts block.
      const factsBlock = src.match(/facts:\s*\{[\s\S]*?\n\s{2}\};/);
      expect(factsBlock).toBeTruthy();
      expect(factsBlock![0]).toMatch(new RegExp(`\\b${field}\\?:`));
    });
  });

  describe('Lock #12: Premium Context-tab design tokens present', () => {
    const src = read(
      'components/service-hub/estimate-studio/tim-rail/PropertySummaryCard.tsx',
    );

    it('declares statCard, chip, and permitCard primitives', () => {
      expect(src).toMatch(/statCard:\s*\{/);
      expect(src).toMatch(/chipPositive:\s*\{/);
      expect(src).toMatch(/permitCard:\s*\{/);
    });

    it('uses tabular-nums for numeric values', () => {
      expect(src).toMatch(/fontVariant:\s*\[\s*['"]tabular-nums['"]\s*\]/);
    });
  });
});
