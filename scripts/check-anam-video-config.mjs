// Read live Ava persona video-related fields.
const apiKey = process.env.ANAM_API_KEY;
if (!apiKey) { console.error('Set ANAM_API_KEY'); process.exit(1); }
const r = await fetch('https://api.anam.ai/v1/personas/58f82b89-8ae7-43cc-930d-be8def14dff3', {
  headers: { Authorization: 'Bearer ' + apiKey },
});
const d = await r.json();
const interesting = ['name', 'avatarId', 'voiceId', 'avatarModel', 'sessionOptions', 'videoQuality', 'voiceDetectionOptions', 'voiceGenerationOptions', 'maxSessionLengthSeconds', 'skipGreeting'];
for (const k of interesting) {
  console.log(k + ': ' + JSON.stringify(d[k]));
}
console.log('---all top-level keys---');
console.log(Object.keys(d).join(', '));
