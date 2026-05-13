/**
 * Materials Tab — Regression Lock (Pass H v1).
 *
 * These tests assert file-content invariants for the bug fixes shipped
 * across 2026-05-12 → 2026-05-13. They DO NOT exercise runtime behavior;
 * they guarantee the specific anti-patterns we just removed can't sneak
 * back in via a future refactor / merge / agent edit.
 *
 * Each lock points at the bug it prevents AND the founder direction or
 * production incident that motivated it. If a lock fails, READ THE
 * FAILURE MESSAGE — it tells you which decision is being violated and
 * why it was made. If the design intent has legitimately changed, update
 * BOTH this file and the underlying code in the SAME commit — never
 * delete-only.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('Materials Tab — Regression Lock (post-2026-05-13)', () => {
  // ─────────────────────────────────────────────────────────────────────
  // Lock #1: Express proxy forwards `address` + `mode`
  //
  // 2026-05-12 incident: Express proxy `allowedParams` whitelist dropped
  // address/mode → backend never knew the user's project address →
  // SerpApi defaulted pickup data to Bangor 2414 → products=0 on every
  // search. Fix: commit 6f8c916.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #1: Express proxy must forward address + mode', () => {
    const src = read('server/routes.ts');

    it('whitelists "address" in the materials proxy allowedParams', () => {
      // The allowedParams declaration must include 'address' so it survives
      // the proxy filter. Any future "tighten the proxy" PR that drops it
      // will fail this test.
      expect(src).toMatch(
        /allowedParams\s*=\s*\[[^\]]*['"]address['"][^\]]*\]/,
      );
    });

    it('whitelists "mode" so Tool vs Supplier dispatch works', () => {
      expect(src).toMatch(
        /allowedParams\s*=\s*\[[^\]]*['"]mode['"][^\]]*\]/,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Lock #2: useMaterialsSearch must forward the project address
  //
  // 2026-05-12 incident: hook hardcoded MOCK_STORE in its return + never
  // wired projectAddress into the search payload. Fixes: 8ce3e26 +
  // useProjectAddress integration.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #2: useMaterialsSearch wires projectAddress into search', () => {
    const src = read('hooks/useMaterialsSearch.ts');

    it('reads address from useProjectAddress', () => {
      expect(src).toMatch(/useProjectAddress/);
      expect(src).toMatch(/const\s+\{\s*address:\s*projectAddress\s*\}\s*=\s*useProjectAddress\(\)/);
    });

    it('passes projectAddress to searchMaterials() in the request payload', () => {
      expect(src).toMatch(/address:\s*projectAddress/);
    });

    it('does NOT hardcode MOCK_STORE in the hook return', () => {
      // The MOCK_STORE constant lived in this file pre-fix and was
      // returned unconditionally from useMaterialsSearch, masking real
      // backend results. The constant + return must be gone.
      expect(src).not.toMatch(/closestStore:\s*MOCK_STORE/);
    });

    it('declares state for closestStore and suppliers (not hardcoded null)', () => {
      // The hook MUST have setState for both so the mapper can populate
      // them from real backend responses. Removing useState here is what
      // caused the closestStore=mock regression.
      expect(src).toMatch(/setClosestStore/);
      expect(src).toMatch(/setSuppliers/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Lock #3: mapServerResponse guards against missing fields
  //
  // 2026-05-13 incident: supplier-mode backend response omits products /
  // specialty_suppliers / filters entirely. The mapper did
  // `resp.products.map(...)` blindly → TypeError on undefined → entire
  // response crashed → setSuppliers never ran → UI stayed empty even
  // though Yelp returned 10 suppliers. Fix: commit 82646d5.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #3: mapServerResponse guards against missing fields', () => {
    const src = read('lib/api/materialsApi.ts');

    it('guards resp.products with Array.isArray', () => {
      expect(src).toMatch(/Array\.isArray\(resp\.products\)/);
    });

    it('guards resp.specialty_suppliers with Array.isArray', () => {
      expect(src).toMatch(/Array\.isArray\(resp\.specialty_suppliers\)/);
    });

    it('guards resp.suppliers with Array.isArray (returns null when absent)', () => {
      expect(src).toMatch(
        /suppliers:\s*Array\.isArray\(resp\.suppliers\)[\s\S]{0,200}:\s*null/,
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Lock #4: HeroSwitcher has NO aspectRatio (would lock the hero to a
  // short band and leave a black gap below the visual on laptop).
  //
  // 2026-05-13 user complaint: "the screen has empty space that the
  // visuals needs to be bigger to fill the bottom space." aspectRatio:
  // 12/5 was forcing height = width × 5/12 (~460px) regardless of the
  // heroSlot's minHeight:520. Fix: commit 4085be5 — use flex:1 instead.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #4: HeroSwitcher uses flex:1 (no aspectRatio:12/5)', () => {
    const src = read('components/service-hub/estimate-studio/visuals/HeroSwitcher.tsx');

    it('container style uses flex:1 to fill heroSlot height', () => {
      expect(src).toMatch(/flex:\s*1/);
    });

    it('container style does NOT have aspectRatio:12/5', () => {
      // Any aspect-ratio lock would re-introduce the bottom gap.
      expect(src).not.toMatch(/aspectRatio:\s*12\s*\/\s*5/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Lock #5: SupplierCard — no solid-amber surfaces
  //
  // 2026-05-13 founder feedback: "too much yellow... should be black with
  // yellow outline." Earlier card design used solid #fbbf24 background on
  // the Draft RFQ button + amber-tinted card background. New design is
  // deep-black bg with amber accents on borders/text only.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #5: SupplierCard is black with yellow outline, not solid yellow', () => {
    const src = read('components/service-hub/estimate-studio/materials/SupplierCard.tsx');

    it('card background is deep black, not amber-tinted', () => {
      expect(src).toMatch(/backgroundColor:\s*['"]#0A0A0F['"]/);
    });

    it('Draft RFQ CTA is a GHOST button — transparent bg, not solid amber', () => {
      // Pull the `cta:` style block and verify backgroundColor is transparent.
      const ctaMatch = src.match(/cta:\s*\{[\s\S]{0,400}?\}/);
      expect(ctaMatch).toBeTruthy();
      const ctaBlock = ctaMatch?.[0] ?? '';
      expect(ctaBlock).toMatch(/backgroundColor:\s*['"]transparent['"]/);
      // And it must NOT use solid #fbbf24 as the BG (border is fine).
      expect(ctaBlock).not.toMatch(/backgroundColor:\s*['"]#fbbf24['"]/);
    });

    it('renders a photo header (Yelp thumbnail or fallback icon tile)', () => {
      expect(src).toMatch(/supplier\.thumbnail/);
      expect(src).toMatch(/photoFallback/);
    });

    it('renders address row when present', () => {
      // The address row is rendered conditionally on fullAddress being
      // non-empty — make sure the conditional + Ionicons "location-outline"
      // pair stays present.
      expect(src).toMatch(/location-outline/);
      expect(src).toMatch(/fullAddress/);
    });

    it('renders clickable phone + website pills when present', () => {
      expect(src).toMatch(/call-outline/);
      expect(src).toMatch(/globe-outline/);
      // Phone must use tel: schema; website must use https:// fallback.
      expect(src).toMatch(/tel:\$\{/);
      expect(src).toMatch(/https:\/\/\$\{/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Lock #6: SupplierGrid caps at 6 cards per page
  //
  // 2026-05-13 founder direction: "less cards to a page quality is better
  // 6 cards to a page." Backend returns up to 10; UI shows 6 with a
  // premium "Show N more" pill.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #6: SupplierGrid caps initial render at 6 cards', () => {
    const src = read('components/service-hub/estimate-studio/materials/SupplierGrid.tsx');

    it('declares PAGE_SIZE = 6', () => {
      expect(src).toMatch(/PAGE_SIZE\s*=\s*6/);
    });

    it('slices the suppliers list by PAGE_SIZE when not expanded', () => {
      expect(src).toMatch(/suppliers\.slice\(0,\s*PAGE_SIZE\)/);
    });

    it('shows a "Show N more" affordance when more results exist', () => {
      expect(src).toMatch(/Show \{remaining\} more/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Lock #7: Supplier type exposes thumbnail field
  //
  // 2026-05-13 fix: Yelp CDN thumbnail flows from backend → hook →
  // SupplierCard photo header. Removing this field would revert the card
  // to icon-only tiles and lose the premium feel.
  // ─────────────────────────────────────────────────────────────────────
  describe('Lock #7: Supplier domain type carries the thumbnail field', () => {
    const src = read('hooks/useMaterialsSearch.ts');
    it('Supplier interface declares thumbnail?: string', () => {
      // Tolerate whitespace + the docstring comment we wrote.
      expect(src).toMatch(/thumbnail\?:\s*string/);
    });
  });
});
