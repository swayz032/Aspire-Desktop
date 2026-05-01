/**
 * Tests for the §3.2 Catch×Public-Number interlock matrix
 * (`validateCatchInterlock`) and the 3-mode `PublicNumberMode` enum.
 */
import {
  validateCatchInterlock,
  type CatchMode,
  type PublicNumberMode,
} from '@/components/calls/setup/setup-types';

describe('validateCatchInterlock — §3.2 matrix', () => {
  // -- ASPIRE_NEW_NUMBER row: every catch mode is valid ---------------
  it.each<[CatchMode]>([
    ['APP_ONLY'],
    ['PHONE_ONLY'],
    ['APP_AND_PHONE_SIMUL_RING'],
  ])('ASPIRE_NEW_NUMBER + %s → ok', (catchMode) => {
    const result = validateCatchInterlock('ASPIRE_NEW_NUMBER', catchMode);
    expect(result.severity).toBe('ok');
    expect(result.message).toBe('');
  });

  // -- FORWARD_EXISTING + APP_ONLY: invalid ----------------------------
  it('FORWARD_EXISTING + APP_ONLY → invalid (calls hit carrier voicemail)', () => {
    const result = validateCatchInterlock('FORWARD_EXISTING', 'APP_ONLY');
    expect(result.severity).toBe('invalid');
    expect(result.message).toMatch(/voicemail/i);
    expect(result.message).toMatch(/Sarah never sees them/i);
  });

  // -- FORWARD_EXISTING + PHONE_ONLY: ok (the canonical valid combo) ---
  it('FORWARD_EXISTING + PHONE_ONLY → ok', () => {
    const result = validateCatchInterlock('FORWARD_EXISTING', 'PHONE_ONLY');
    expect(result.severity).toBe('ok');
  });

  // -- FORWARD_EXISTING + simul-ring: warn (carrier-dependent) ---------
  it('FORWARD_EXISTING + APP_AND_PHONE_SIMUL_RING → warn (carrier-dependent)', () => {
    const result = validateCatchInterlock(
      'FORWARD_EXISTING',
      'APP_AND_PHONE_SIMUL_RING',
    );
    expect(result.severity).toBe('warn');
    expect(result.message).toMatch(/simultaneous-ring/i);
  });

  // -- PORT_IN row: every catch mode is valid (Aspire owns the number) -
  it.each<[CatchMode]>([
    ['APP_ONLY'],
    ['PHONE_ONLY'],
    ['APP_AND_PHONE_SIMUL_RING'],
  ])('PORT_IN + %s → ok', (catchMode) => {
    const result = validateCatchInterlock('PORT_IN', catchMode);
    expect(result.severity).toBe('ok');
  });

  // -- Determinism: pure function — same input → same output -----------
  it('is deterministic — same input always returns same severity', () => {
    const a = validateCatchInterlock('FORWARD_EXISTING', 'APP_ONLY');
    const b = validateCatchInterlock('FORWARD_EXISTING', 'APP_ONLY');
    expect(a.severity).toBe(b.severity);
    expect(a.message).toBe(b.message);
  });
});

describe('PublicNumberMode enum migration safety', () => {
  it('rejects legacy ASPIRE_NUMBER value at the type level', () => {
    // @ts-expect-error legacy value should no longer compile
    const legacy: PublicNumberMode = 'ASPIRE_NUMBER';
    expect(legacy).toBe('ASPIRE_NUMBER'); // runtime-only — type system enforces the rejection.
  });

  it('rejects legacy KEEP_CURRENT_NUMBER value at the type level', () => {
    // @ts-expect-error legacy value should no longer compile
    const legacy: PublicNumberMode = 'KEEP_CURRENT_NUMBER';
    expect(legacy).toBe('KEEP_CURRENT_NUMBER');
  });

  it('accepts all 3 honest 2026 modes', () => {
    const modes: PublicNumberMode[] = [
      'ASPIRE_NEW_NUMBER',
      'FORWARD_EXISTING',
      'PORT_IN',
    ];
    expect(modes).toHaveLength(3);
  });
});
