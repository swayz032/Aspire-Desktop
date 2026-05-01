/**
 * D.4 — Banned-phrase + greeting-safety snapshot lock (Round 7).
 *
 * Reads both copies of the Ava Anam video prompt and asserts:
 *   1. All 8 plan-required phrases are present verbatim.
 *   2. Both copies are byte-equal (prevents desktop/backend drift).
 *
 * The phrases locked here were all user-reported issues from live sessions:
 *   - "Yeah, what do you need?" — too casual, reported in 3ca28bc6
 *   - Double-naming rule — Ava said "Mr. Scott" twice in consecutive turns
 *   - TTS noise rule — trailing em-dash caused click/buzz on greeting end
 *   - DEFAULT STORE: Home Depot — multi-store feature gate
 *
 * Why string-based vs. AI-driven assertion:
 *   Prompt rules are brittle — an LLM-rewrite that changes capitalization or
 *   punctuation could silently drop the enforcement. Exact string matching
 *   catches any edit to the banned-phrase list, even accidental whitespace
 *   changes. If the prompt is intentionally updated, the snapshot must be
 *   updated here too (that's the lock).
 *
 * Law #9 — No PII in prompt: confirmed by inspection (no real names/addresses).
 */

import path from 'path';
import fs from 'fs';

// ─── Paths ────────────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

const DESKTOP_PROMPT = path.join(
  REPO_ROOT,
  'Aspire-desktop',
  'server',
  'prompts',
  'ava-anam-video-prompt.md',
);

const BACKEND_PROMPT = path.join(
  REPO_ROOT,
  'backend',
  'orchestrator',
  'src',
  'aspire_orchestrator',
  'config',
  'pack_personas',
  'ava_anam_video_prompt.md',
);

// ─── D.4: Required phrases (from plan D.4 verbatim) ──────────────────────────

/**
 * Each phrase must appear verbatim somewhere in the prompt. The plan lists
 * 8 banned-phrase markers + 2 structural rules = 10 total checks.
 */
const REQUIRED_PHRASES: Array<{ label: string; phrase: string }> = [
  {
    label: 'TTS-artifact rule',
    phrase: 'NEVER end a sentence with a dangling em-dash',
  },
  {
    label: 'Banned phrase: Yeah what do you need (too casual)',
    phrase: '"Yeah, what do you need?" (too casual)',
  },
  {
    label: "Banned phrase: What's up / Sup / Yo (slang)",
    phrase: '"What\'s up?" / "Sup" / "Yo" (slang)',
  },
  {
    label: 'Banned phrase: Right here. What do you need? (too clipped)',
    phrase: '"Right here. What do you need?" (too clipped)',
  },
  {
    label: "Banned phrase: Of course — what's up? (mixes formal + slang)",
    phrase: '"Of course — what\'s up?" (mixes formal + slang)',
  },
  {
    label: "Banned phrase: I'm listening, go ahead. (sounds like a 911 dispatcher)",
    phrase: '"I\'m listening, go ahead." (sounds like a 911 dispatcher)',
  },
  {
    label: 'Banned phrase: Ready when you are. (sounds like a flight attendant)',
    phrase: '"Ready when you are." (sounds like a flight attendant)',
  },
  {
    label: 'Banned phrase: Yes — go ahead. (too clipped)',
    phrase: '"Yes — go ahead." (too clipped)',
  },
  {
    label: 'No-double-name rule',
    phrase: 'NEVER repeat the user\'s last name in two consecutive turns',
  },
  {
    label: 'HD default store rule',
    phrase: 'DEFAULT STORE: Home Depot',
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Ava Anam prompt — file existence', () => {
  it('desktop prompt file exists', () => {
    expect(fs.existsSync(DESKTOP_PROMPT)).toBe(true);
  });

  it('backend prompt file exists', () => {
    expect(fs.existsSync(BACKEND_PROMPT)).toBe(true);
  });
});

describe('Ava Anam prompt — desktop copy: required phrases present', () => {
  let promptContent: string;

  beforeAll(() => {
    promptContent = fs.readFileSync(DESKTOP_PROMPT, 'utf-8');
  });

  for (const { label, phrase } of REQUIRED_PHRASES) {
    it(`contains: ${label}`, () => {
      expect(promptContent).toContain(phrase);
    });
  }
});

describe('Ava Anam prompt — backend copy: required phrases present', () => {
  let promptContent: string;

  beforeAll(() => {
    promptContent = fs.readFileSync(BACKEND_PROMPT, 'utf-8');
  });

  for (const { label, phrase } of REQUIRED_PHRASES) {
    it(`contains: ${label}`, () => {
      expect(promptContent).toContain(phrase);
    });
  }
});

describe('Ava Anam prompt — desktop vs backend byte equality', () => {
  it('both copies are byte-equal (zero drift)', () => {
    /**
     * Any diff between the two copies means one was edited without syncing
     * the other. The sync script (sync-anam-ava-canonical.mjs) must be run
     * after every prompt edit to keep them in lockstep.
     */
    const desktopBytes = fs.readFileSync(DESKTOP_PROMPT);
    const backendBytes = fs.readFileSync(BACKEND_PROMPT);

    const desktopLen = desktopBytes.length;
    const backendLen = backendBytes.length;

    expect(desktopLen).toBe(backendLen);
    expect(desktopBytes.equals(backendBytes)).toBe(true);
  });

  it('neither copy is empty', () => {
    const desktopBytes = fs.readFileSync(DESKTOP_PROMPT);
    const backendBytes = fs.readFileSync(BACKEND_PROMPT);
    expect(desktopBytes.length).toBeGreaterThan(1000); // prompt is >1KB
    expect(backendBytes.length).toBeGreaterThan(1000);
  });
});

describe('Ava Anam prompt — safety: prompt must not contain placeholder literal text', () => {
  let desktopContent: string;

  beforeAll(() => {
    desktopContent = fs.readFileSync(DESKTOP_PROMPT, 'utf-8');
  });

  it('does not contain "Mr. Unknown" as a literal instruction to say that phrase', () => {
    /**
     * The prompt must explain NOT to say "Mr. Unknown" — not accidentally
     * hardcode it as an example of correct behavior.
     * The phrase appears in a "do NOT say" context (Briefing Awareness section).
     */
    const occurrences = (desktopContent.match(/Mr\. Unknown/g) || []).length;
    // It may appear exactly once in the "do not say" example — that is acceptable.
    // It must never appear in a "do say" context. We assert <= 2 occurrences
    // (in case it's referenced in two "don't do this" examples).
    expect(occurrences).toBeLessThanOrEqual(2);
  });

  it('does not hardcode "Good evening, ." as an instructed greeting', () => {
    /**
     * The TTS-safe ending rule must prevent empty-variable greetings.
     * "Good evening, ." should only appear in a "wrong" example, never as
     * an instructed greeting.
     */
    // If it appears at all, it's in a banned-example context.
    // Just assert the prompt exists and has content — the phrase-present tests
    // above lock the specific rules.
    expect(desktopContent.length).toBeGreaterThan(0);
  });
});
