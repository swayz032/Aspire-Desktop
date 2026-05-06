// Compare ephemeral-with-toolIds vs stateful (personaId) mint behavior.
// Usage: ANAM_API_KEY=... node scripts/test-anam-mint.mjs
import process from 'node:process';
const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }
const PERSONA_ID = '58f82b89-8ae7-43cc-930d-be8def14dff3';
const BASE = 'https://api.anam.ai/v1';

async function mint(label, body) {
  console.log(`\n=== ${label} ===`);
  console.log('payload:', JSON.stringify(body).slice(0, 200) + '...');
  const r = await fetch(`${BASE}/auth/session-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  console.log(`status: ${r.status}`);
  if (r.ok) {
    const data = JSON.parse(text);
    const tok = data.sessionToken || '';
    console.log(`tokenLength: ${tok.length}`);
    // JWTs are header.payload.signature — decode payload to see what's actually inside
    const parts = tok.split('.');
    if (parts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const summary = {
          type: payload.type,
          personaId: payload.personaId,
          hasPersonaConfig: !!payload.personaConfig,
          personaConfigKeys: payload.personaConfig ? Object.keys(payload.personaConfig) : [],
          toolIdsInPayload: payload.personaConfig?.toolIds || payload.toolIds || null,
          exp: payload.exp,
        };
        console.log('JWT payload summary:', JSON.stringify(summary, null, 2));
      } catch (e) { console.log('JWT decode failed:', e.message); }
    }
  } else {
    console.log('error body:', text.slice(0, 600));
  }
}

// Test 1: stateful (personaId only) — what the docs say is correct
await mint('STATEFUL (personaId only)', { personaConfig: { personaId: PERSONA_ID } });

// Test 2: stateful with override fields (hybrid — undocumented)
await mint('STATEFUL + overrides (hybrid)', {
  personaConfig: {
    personaId: PERSONA_ID,
    systemPrompt: 'You are Ava.',
    voiceDetectionOptions: { silenceBeforeSessionEndSeconds: 60 },
  },
});

// Test 3: ephemeral with toolIds — what we currently send
await mint('EPHEMERAL + toolIds (current)', {
  personaConfig: {
    name: 'Ava',
    avatarId: '30fa96d0-26c4-4e55-94a0-517025942e18',
    voiceId: '0c8b52f4-f26d-4810-855c-c90e5f599cbc',
    llmId: 'b4f89001-9638-4879-a9c3-02cc9f9f2004',
    systemPrompt: 'You are Ava.',
    toolIds: ['c91c83ea-3780-4ca6-9e31-b8b277c9fc8a'],
  },
});
