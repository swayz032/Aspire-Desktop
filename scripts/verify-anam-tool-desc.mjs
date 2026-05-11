import process from 'node:process';
const KEY = process.env.ANAM_API_KEY;
const r = await fetch('https://api.anam.ai/v1/tools/af247cb8-d1ce-4721-9ebe-d0ec397ba9eb', {
  headers: { Authorization: `Bearer ${KEY}` },
});
const o = await r.json();
const desc = o.description || '';
console.log('description length:', desc.length);
console.log('contains "invoicing workflow":', desc.toLowerCase().includes('invoicing workflow'));
console.log('contains "quinn":', desc.toLowerCase().includes('quinn'));
console.log('contains "voice rules":', desc.toLowerCase().includes('voice rules'));
console.log('contains "tools and cards":', desc.toLowerCase().includes('tools and cards'));
console.log('first 250 chars:', desc.slice(0, 250));
