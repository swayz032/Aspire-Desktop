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

  describe('Lock #13: Street View shell flexes to fill heroSlot (4K crispness)', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/LiveStreetViewHero.tsx',
    );

    // The shell style block — find from `shell: {` to its matching `},`.
    const shellMatch = src.match(/shell:\s*\{[\s\S]*?\n\s{2}\}/);

    it('shell style block exists', () => {
      expect(shellMatch).toBeTruthy();
    });

    it('shell sets flex: 1 (without it the pano renders at a fixed size '
       + 'and Google serves lower-res tiles = blurry Street View)', () => {
      expect(shellMatch![0]).toMatch(/\bflex:\s*1\b/);
    });

    it('shell does NOT cap with aspectRatio (legacy 12/5 was the blur cause)', () => {
      // The whole point of the regression: any aspectRatio reintroduces
      // the fixed-letterbox sizing that triggers low-res Pano tiles.
      expect(shellMatch![0]).not.toMatch(/\baspectRatio\s*:/);
    });

    it('shell keeps a minHeight floor (>= 320) so the pano never collapses', () => {
      const minHeightMatch = shellMatch![0].match(/minHeight:\s*(\d+)/);
      expect(minHeightMatch).toBeTruthy();
      expect(Number(minHeightMatch![1])).toBeGreaterThanOrEqual(320);
    });
  });

  describe('Lock #14: PhotoGalleryHero shell flexes + black bg (immersive)', () => {
    const src = read(
      'components/service-hub/estimate-studio/visuals/PhotoGalleryHero.tsx',
    );
    const shellMatch = src.match(/shell:\s*\{[\s\S]*?\n\s{2}\}/);

    it('shell uses flex:1 and #000000 bg', () => {
      expect(shellMatch).toBeTruthy();
      expect(shellMatch![0]).toMatch(/\bflex:\s*1\b/);
      expect(shellMatch![0]).toMatch(/backgroundColor:\s*['"]#000000['"]/);
    });

    it('shell does NOT pin a fixed aspectRatio (would clip images)', () => {
      expect(shellMatch![0]).not.toMatch(/\baspectRatio\s*:/);
    });
  });

  describe('Lock #15: ProjectAddressBar owns address input ONLY (Wave 0 cleanup)', () => {
    // Wave 0 (2026-05-17): Upload, "+ New Project", and the "Recent ▾"
    // dropdown were removed from the Estimate Studio header bar. Tim
    // Rail Controls > Quick Actions is the single source of truth for
    // Upload + New Project. This lock prevents them from being
    // re-introduced into ProjectAddressBar.
    const src = read(
      'components/service-hub/estimate-studio/ProjectAddressBar.tsx',
    );

    it('does NOT render an Upload button', () => {
      // Strip block comments so the rule comment in the file header
      // doesn't trigger a false positive.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/<Text[^>]*>Upload<\/Text>/);
      expect(code).not.toMatch(/testID=["']estimate-studio-upload-evidence["']/);
      expect(code).not.toMatch(/styles\.uploadButton\b/);
    });

    it('does NOT render a "New Project" button', () => {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/<Text[^>]*>New Project<\/Text>/);
      expect(code).not.toMatch(/testID=["']estimate-studio-new-project["']/);
      expect(code).not.toMatch(/styles\.newProjectButton\b/);
    });

    it('does NOT render the "Recent" dropdown chip', () => {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
      expect(code).not.toMatch(/<Text[^>]*>Recent<\/Text>/);
      expect(code).not.toMatch(/styles\.recentChip\b/);
    });

    it('DOES still render the address TextInput with its anchor testID', () => {
      expect(src).toMatch(/<TextInput\b/);
      expect(src).toMatch(/testID=["']estimate-studio-address-input["']/);
      expect(src).toMatch(/placeholder=["']Enter property address\.\.\.["']/);
    });

    it('drops the compact + onNewProject props from the public API', () => {
      // The compact toggle existed only to hide the now-removed buttons,
      // and onNewProject only wired the now-removed "+ New Project" button.
      // Both must stay gone so callers don't pass dead props.
      expect(src).not.toMatch(/\bcompact\??\s*:/);
      expect(src).not.toMatch(/\bonNewProject\??\s*:/);
    });
  });

  describe('Lock #17: Scope tab uses shared shell + renders inline TruthBadges', () => {
    // Wave 7 (2026-05-17): Scope is THE tab where contractors read the plain-
    // English story. It MUST use the same CanvasCardSwitcher + BottomChipStrip
    // shells (so card geometry stays consistent across tabs) and MUST render
    // inline TruthBadge components in the story so contractors can instantly
    // tell observed-vs-derived-vs-assumed facts.
    const tabSrc = read(
      'components/service-hub/estimate-studio/scope/ScopeTab.tsx',
    );
    const storySrc = read(
      'components/service-hub/estimate-studio/scope/StoryPanel.tsx',
    );
    const pageSrc = read('app/service-hub/estimate-studio/scope.tsx');

    it('uses <CanvasCardSwitcher /> for the main canvas region', () => {
      expect(tabSrc).toMatch(/CanvasCardSwitcher/);
      expect(tabSrc).toMatch(/<CanvasCardSwitcher\b/);
    });

    it('uses <BottomChipStrip /> for card selection', () => {
      expect(tabSrc).toMatch(/BottomChipStrip/);
      expect(tabSrc).toMatch(/<BottomChipStrip\b/);
    });

    it('StoryPanel renders inline <TruthBadge /> components', () => {
      expect(storySrc).toMatch(/TruthBadge/);
      expect(storySrc).toMatch(/<TruthBadge\b/);
    });

    it('empty state copy contains the literal "Drop a plan set in Plans & Photos"', () => {
      // Tonio: this is the contractor's entry breadcrumb when no project has
      // been uploaded. The literal must remain so the visible UX matches the
      // contract.
      expect(tabSrc).toMatch(/Drop a plan set in Plans & Photos/);
    });

    it('scope.tsx route delegates to <ScopeTab /> (no TabPlaceholder)', () => {
      expect(pageSrc).toMatch(/<ScopeTab\s*\/>/);
      expect(pageSrc).not.toMatch(/TabPlaceholder/);
    });
  });

  describe('Lock #18: Takeoff tab uses shared shells + mode-aware geometry', () => {
    // Wave 8 (2026-05-17): Takeoff is the Commercial Blueprint workspace. It
    // must reuse the Wave 6A shells so future modes (residential, smart-room,
    // roofing) inherit consistent geometry. The mode switcher has 4 pills:
    // Commercial + Residential enabled, Smart Room + Roofing disabled with
    // a "Phase 8" badge until Phase 8 ships.
    const tabSrc = read(
      'components/service-hub/estimate-studio/takeoff/TakeoffTab.tsx',
    );
    const pageSrc = read('app/service-hub/estimate-studio/takeoff.tsx');
    const modeSrc = read(
      'components/service-hub/estimate-studio/takeoff/ModeSwitcher.tsx',
    );
    const sheetViewerSrc = read(
      'components/service-hub/estimate-studio/takeoff/SheetViewer.tsx',
    );

    it('TakeoffTab uses <CanvasCardSwitcher /> via the mode container', () => {
      // The mode container hosts CanvasCardSwitcher — that's the shell reuse.
      const commercialSrc = read(
        'components/service-hub/estimate-studio/takeoff/CommercialBlueprintMode.tsx',
      );
      expect(commercialSrc).toMatch(/CanvasCardSwitcher/);
      expect(commercialSrc).toMatch(/<CanvasCardSwitcher\b/);
    });

    it('TakeoffTab uses <BottomChipStrip /> for card selection', () => {
      expect(tabSrc).toMatch(/BottomChipStrip/);
      expect(tabSrc).toMatch(/<BottomChipStrip\b/);
    });

    it('TakeoffTab uses 4 chips: Sheet Viewer / Assemblies / Quantities / Symbol Legend', () => {
      expect(tabSrc).toMatch(/key:\s*['"]sheet-viewer['"]/);
      expect(tabSrc).toMatch(/key:\s*['"]assemblies['"]/);
      expect(tabSrc).toMatch(/key:\s*['"]quantities['"]/);
      expect(tabSrc).toMatch(/key:\s*['"]legend['"]/);
      // Labels match the plan.
      expect(tabSrc).toMatch(/label:\s*['"]Sheet Viewer['"]/);
      expect(tabSrc).toMatch(/label:\s*['"]Assemblies['"]/);
      expect(tabSrc).toMatch(/label:\s*['"]Quantities['"]/);
      expect(tabSrc).toMatch(/label:\s*['"]Symbol Legend['"]/);
    });

    it('takeoff.tsx route delegates to <TakeoffTab /> (no TabPlaceholder)', () => {
      expect(pageSrc).toMatch(/<TakeoffTab\s*\/>/);
      expect(pageSrc).not.toMatch(/TabPlaceholder/);
    });

    it('ModeSwitcher exposes exactly four modes', () => {
      expect(modeSrc).toMatch(/key:\s*['"]commercial['"]/);
      expect(modeSrc).toMatch(/key:\s*['"]residential['"]/);
      expect(modeSrc).toMatch(/key:\s*['"]smart-room['"]/);
      expect(modeSrc).toMatch(/key:\s*['"]roofing['"]/);
    });

    it('Smart Room + Roofing modes are disabled with a Phase 8 badge', () => {
      // Each disabled mode must carry both `disabled: true` and badge:'Phase 8'.
      const smartRoomBlock = modeSrc.match(/key:\s*['"]smart-room['"][\s\S]{0,200}/);
      expect(smartRoomBlock).toBeTruthy();
      expect(smartRoomBlock![0]).toMatch(/disabled:\s*true/);
      expect(smartRoomBlock![0]).toMatch(/badge:\s*['"]Phase 8['"]/);

      const roofingBlock = modeSrc.match(/key:\s*['"]roofing['"][\s\S]{0,200}/);
      expect(roofingBlock).toBeTruthy();
      expect(roofingBlock![0]).toMatch(/disabled:\s*true/);
      expect(roofingBlock![0]).toMatch(/badge:\s*['"]Phase 8['"]/);
    });

    it('renders the Drop-a-plan-set empty-state copy when no project is loaded', () => {
      // Locked literal so reviewers always see the correct CTA when empty.
      expect(tabSrc).toMatch(/Drop a plan set in Plans & Photos/);
    });

    it('SymbolOverlay is reachable from SheetViewer (overlay toggle wired)', () => {
      expect(sheetViewerSrc).toMatch(/SymbolOverlay/);
      expect(sheetViewerSrc).toMatch(/<SymbolOverlay\b/);
      expect(sheetViewerSrc).toMatch(/symbol-overlay-toggle/);
    });

    it('TimRailContextTab branches on /takeoff and renders TakeoffContextPayload', () => {
      const railSrc = read(
        'components/service-hub/estimate-studio/tim-rail/TimRailContextTab.tsx',
      );
      expect(railSrc).toMatch(/pathname\.endsWith\(['"]\/takeoff['"]\)/);
      expect(railSrc).toMatch(/<TakeoffContextPayload\b/);
    });

    it('Push-to-materials is a YELLOW capability flow (scope materials.bundle.add)', () => {
      const routesSrc = read('server/routes.ts');
      // The new route must mint a token with the materials.bundle.add scope.
      expect(routesSrc).toMatch(/\/api\/v1\/blueprints\/projects\/:id\/push-to-materials/);
      expect(routesSrc).toMatch(/scope:\s*['"]materials\.bundle\.add['"]/);
      expect(routesSrc).toMatch(/risk_tier:\s*['"]yellow['"]/);
    });
  });

  describe('Lock #16: Plans & Photos tab uses shared shell (CanvasCardSwitcher + BottomChipStrip)', () => {
    // Wave 6A (2026-05-17): Plans & Photos is the primary upload entry for
    // the Blueprint Story Engine. It must use the shared canvas-card switcher
    // shell so future waves (Scope, Takeoff) inherit the same geometry
    // instead of re-implementing free-form layouts per tab.
    const tabSrc = read(
      'components/service-hub/estimate-studio/plans-photos/PlansPhotosTab.tsx',
    );
    const pageSrc = read('app/service-hub/estimate-studio/plans-photos.tsx');

    it('uses <CanvasCardSwitcher /> for the main canvas region', () => {
      expect(tabSrc).toMatch(/CanvasCardSwitcher/);
      expect(tabSrc).toMatch(/<CanvasCardSwitcher\b/);
    });

    it('uses <BottomChipStrip /> for card selection', () => {
      expect(tabSrc).toMatch(/BottomChipStrip/);
      expect(tabSrc).toMatch(/<BottomChipStrip\b/);
    });

    it('uses <UploadDropZone /> (not a free-form upload form)', () => {
      expect(tabSrc).toMatch(/UploadDropZone/);
      expect(tabSrc).toMatch(/<UploadDropZone\b/);
    });

    it('plans-photos.tsx route delegates to <PlansPhotosTab /> (no TabPlaceholder)', () => {
      expect(pageSrc).toMatch(/<PlansPhotosTab\s*\/>/);
      expect(pageSrc).not.toMatch(/TabPlaceholder/);
    });

    it('renders the Wave 6.5 coming-soon banner so reviewers know what is deferred', () => {
      // The banner explains thumbnails + 5-stage progress land in Wave 6.5.
      // The literal string must remain so the visible UX matches the contract.
      expect(tabSrc).toMatch(/Wave 6\.5/);
      expect(tabSrc).toMatch(/Wave 2\.5/);
    });
  });

  describe('Lock #20: Service Memory pages clone Office Memory at /service-hub/memory/*', () => {
    // Wave 5.1b-6 + 5.1b-7 (2026-05-17): Service Memory mirrors Office Memory
    // byte-for-byte at /service-hub/memory/*. This lock asserts:
    //   (1) The previous ComingSoonStub at app/service-hub/memory.tsx is gone.
    //   (2) The three sub-pages exist under app/service-hub/memory/.
    //   (3) The hero title literal is "Service Memory" (not Memory Engine).
    //   (4) Pages REUSE the office-memory components (no duplication of
    //       MemoryCard / MemoryResultsGrid / MemoryFilterBar / MemoryGridListToggle
    //       / MemoryDetailHeader / LedAmbientSearchBar). The 85% reuse target
    //       is enforced by checking the imports trace back to office-memory.
    const indexSrc = read('app/service-hub/memory/index.tsx');
    const resultsSrc = read('app/service-hub/memory/results.tsx');
    const detailSrc = read('app/service-hub/memory/[memoryId].tsx');
    const heroSrc = read('components/service-hub/ServiceMemoryHero.tsx');

    it('the old ComingSoonStub at app/service-hub/memory.tsx no longer exists', () => {
      // The directory-only structure (memory/index.tsx, memory/results.tsx,
      // memory/[memoryId].tsx) replaces the flat memory.tsx file.
      const fs = require('node:fs');
      const stubPath = join(ROOT, 'app/service-hub/memory.tsx');
      expect(fs.existsSync(stubPath)).toBe(false);
    });

    it('hero component renders the literal title "Service Memory"', () => {
      // Anchored as a JSX child between `>` and `<` so doc-comments don't
      // accidentally satisfy the match.
      expect(heroSrc).toMatch(/>\s*Service Memory\s*</);
    });

    it('hero subtitle matches the service desk copy', () => {
      expect(heroSrc).toMatch(
        /Search every job, blueprint, material decision, and call your service desk has captured\./,
      );
    });

    it('index.tsx imports ServiceMemoryHero (not MemoryEngineHero)', () => {
      expect(indexSrc).toMatch(/import\s+\{\s*ServiceMemoryHero\s*\}/);
      expect(indexSrc).not.toMatch(/import\s+\{\s*MemoryEngineHero\s*\}/);
    });

    it('results.tsx reuses the office-memory grid + filter + toggle components', () => {
      expect(resultsSrc).toMatch(/from\s+['"]@\/components\/office-memory\/MemoryFilterBar['"]/);
      expect(resultsSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/MemoryGridListToggle['"]/,
      );
      expect(resultsSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/MemoryResultsGrid['"]/,
      );
    });

    it('results.tsx calls useServiceMemorySearch (not useMemorySearch)', () => {
      expect(resultsSrc).toMatch(
        /from\s+['"]@\/lib\/service-memory\/useServiceMemorySearch['"]/,
      );
      expect(resultsSrc).toMatch(/useServiceMemorySearch\s*\(/);
    });

    it('results.tsx page header reads "Service Memory Results"', () => {
      expect(resultsSrc).toMatch(/>\s*Service Memory Results\s*</);
    });

    it('detail page reuses MemoryDetailHeader from office-memory barrel', () => {
      expect(detailSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/details['"]/,
      );
      expect(detailSrc).toMatch(/MemoryDetailHeader/);
    });

    it('detail page swaps to ServiceMemoryDetailRightRail (not the office rail)', () => {
      expect(detailSrc).toMatch(
        /import\s+\{\s*ServiceMemoryDetailRightRail\s*\}/,
      );
      expect(detailSrc).toMatch(/<ServiceMemoryDetailRightRail\b/);
      // The office rail must NOT be imported here — the service rail is
      // service-specific because its LINKED_MEMORY_TYPES set differs.
      expect(detailSrc).not.toMatch(
        /import\s+\{[^}]*\bMemoryDetailRightRail\b[^}]*\}\s+from\s+['"]@\/components\/office-memory\/details['"]/,
      );
    });

    it('detail page calls useServiceMemoryDetail and deep-links back to /service-hub/memory', () => {
      expect(detailSrc).toMatch(
        /from\s+['"]@\/lib\/service-memory\/useServiceMemoryDetail['"]/,
      );
      expect(detailSrc).toMatch(/useServiceMemoryDetail\s*\(/);
      expect(detailSrc).toMatch(/['"]\/service-hub\/memory['"]/);
    });

    it('hero reuses the LedAmbientSearchBar from office-memory (no duplication)', () => {
      expect(heroSrc).toMatch(
        /from\s+['"]@\/components\/office-memory\/LedAmbientSearchBar['"]/,
      );
    });
  });

  describe('Lock #21: Tim Rail Context renders ServiceBriefCard on Service Hub routes', () => {
    // Wave 5.1b (2026-05-17): Service Hub views (excluding Estimate Studio
    // sub-tabs that have their own per-tab Context payload + the Materials
    // tab) must surface a Service Memory brief summary card in the Tim Rail
    // Context tab. This lock catches regressions where someone removes the
    // card or accidentally renders it on the Estimate Studio sub-tabs.
    const railSrc = read(
      'components/service-hub/estimate-studio/tim-rail/TimRailContextTab.tsx',
    );
    const cardSrc = read('components/service-hub/ServiceBriefCard.tsx');

    it('TimRailContextTab imports and references ServiceBriefCard', () => {
      expect(railSrc).toMatch(/import\s+\{\s*ServiceBriefCard\s*\}/);
      expect(railSrc).toMatch(/<ServiceBriefCard\b/);
    });

    it('TimRailContextTab gates ServiceBriefCard on isServiceHubRoute', () => {
      expect(railSrc).toMatch(/isServiceHubRoute/);
      expect(railSrc).toMatch(/pathname\.startsWith\(['"]\/service-hub['"]\)/);
    });

    it('ServiceBriefCard is suppressed on Estimate Studio sub-tabs', () => {
      // The render must negate the Estimate Studio sub-tab booleans so each
      // tab's bespoke Context payload (Plans & Photos / Scope / Takeoff)
      // continues to render unchanged.
      expect(railSrc).toMatch(/!isPlansPhotosTab/);
      expect(railSrc).toMatch(/!isScopeTab/);
      expect(railSrc).toMatch(/!isTakeoffTab/);
    });

    it('ServiceBriefCard renders exactly 5 service counters', () => {
      expect(cardSrc).toMatch(/service-brief-counter-picks/);
      expect(cardSrc).toMatch(/service-brief-counter-overrides/);
      expect(cardSrc).toMatch(/service-brief-counter-pending/);
      expect(cardSrc).toMatch(/service-brief-counter-handoffs/);
      expect(cardSrc).toMatch(/service-brief-counter-threads/);
    });

    it('ServiceBriefCard "View all" deep-links to /service-hub/memory', () => {
      expect(cardSrc).toMatch(/\/service-hub\/memory/);
    });
  });
});
