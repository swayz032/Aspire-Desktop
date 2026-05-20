# Ava Worked Examples (Source Reference)

These transcripts illustrate the state machines defined in the canonical KB docs. They are NOT uploaded to the Anam KB — they exist here for human review and onboarding new contributors.

Why separated: production transcript 22698af9 (2026-05-20) showed Anam's chunker returning prose-style worked-example chunks instead of state-machine chunks. Ava then followed the OLD "Step 1 ... Step 11" workflow instead of the new state machine. Keeping worked examples out of the uploaded KB prevents this retrieval pollution.

---

## Invoicing and Quotes — Worked Examples

## WORKED EXAMPLE — New Customer, Invoice (Happy Path)

User: "I need to send an invoice."
[→ STATE 1]
Ava: "Sure thing. Who's it for?"

User: "Ricky Joy LLC."
[→ STATE 2]
Ava: "Got it, Ricky Joy LLC — that right?"

User: "Yes."
[→ STATE 3]
Ava: "Let me check if they're in your system."
[Quinn LOOKUP: details="Ricky Joy LLC"]
[Quinn → needs_onboarding]
[→ STATE 4]
Ava: "Ricky Joy isn't in your system yet. It's a one-time setup — I just need their first name, last name, and email. Company, phone, and address are optional."

User: "First name Ricky, last name Joy, email rickyjoy@gmail.com."
[→ STATE 5]
Ava: "Got it, the email is rickyjoy at gmail dot com — that right?"

User: "Yes."
[→ STATE 6]
Ava: "Now what are you billing them for, and how much?"

User: "Five hundred pallets at nine fifty each."
[→ STATE 7]
Ava: "That's four thousand seven fifty. When should this be due?"

User: "Twenty days."
[→ STATE 8]
Ava: "Any notes you want on it?"

User: "Brand new GMA 48x40 pallets."
[→ STATE 9]
Ava: "Alright — five hundred pallets at nine fifty each, four thousand seven fifty total, for Ricky Joy LLC. Due in twenty days. Notes: brand new GMA 48x40 pallets. That right?"

User: "Yes."
[→ STATE 10]
[Quinn CREATE: details="Ricky Joy LLC, email rickyjoy@gmail.com, billing for 500 pallets at 9.50 each, total 4750, due in 20 days, notes: brand new GMA 48x40 pallets"]
[Quinn → draft created]
[→ STATE 11]
Ava: "Done. It's in your approval queue with a preview. Go check it out when you get a chance."

[→ STATE_SILENT_DURING_REVIEW]
[User opens the queue card, reviews the canvas PDF preview, clicks Approve. The platform sends the invoice to rickyjoy@gmail.com via Stripe. Ava says nothing during this window.]

User: "Approved."
[→ STATE_IDLE]
Ava: "Awesome — it's on its way."

---

## WORKED EXAMPLE — Deny and Revise

[Continuing from STATE_SILENT_DURING_REVIEW above, but the user denies instead.]

User: "Wait, the total's wrong. It should be five thousand flat."
[→ STATE_REVISE]
Ava: "Got it. So five thousand flat for Ricky Joy?"

User: "Yes, same notes, same due date."
[→ STATE 9 with revised total]
Ava: "Alright — five thousand total for Ricky Joy LLC, due in twenty days. Notes: brand new GMA 48x40 pallets. That right?"

User: "Yes."
[→ STATE 10 — creates a NEW draft]
[Quinn CREATE: details="Ricky Joy LLC, email rickyjoy@gmail.com, billing for service flat 5000, total 5000, due in 20 days, notes: brand new GMA 48x40 pallets"]
[→ STATE 11]
Ava: "Done. New draft's in your queue."

[→ STATE_SILENT_DURING_REVIEW]

---

## WORKED EXAMPLE — Single-Word Name Pause

User: "Send an invoice to Clark..."
[→ STATE 1, name received as just "Clark"]
[Ava waits 2 seconds because the name is single-word]

User: "...James."
[Combined name treated as "Clark James"]
[→ STATE 2]
Ava: "Got it, Clark James — that right?"

User: "Yes."
[→ STATE 3]
Ava: "Let me check if they're in your system."

---

## WORKED EXAMPLE — Email Correction Recovery

[Continuing from STATE 5 after a verified email.]

User: "Yes."
[Ava starts transitioning to STATE 6.]
User: "Wait, actually that email's wrong. It's TonyOSways32 at gmail dot com."
[→ STATE 5 with new email]
Ava: "Got it — what's the correct email? ... Got it, TonyOSways32 at gmail dot com — that right?"

User: "Yes."
[→ STATE 6 — first name, last name, and customer name are still in memory; no re-asking]
Ava: "Now what are you billing them for, and how much?"

---

## Tools and Cards — Worked Examples

## Worked Examples

### Example 1 — Product lookup (happy path)

User: "I need PVC pipe."
[→ STATE 1: classify as PRODUCT_LOOKUP, entity_type=product]
[→ STATE 2: user_address not cached]
Ava: "Sure thing. What address?"

User: "4863 Price Street, Forest Park, Georgia 30297."
[user_address cached]
[→ STATE 3]
Ava: "Give me a second, let me look into that."
[invoke_adam → records returned, artifact_type=PriceComparison]
[→ STATE 4]
Ava: "Closest Home Depot is on Capital Circle Northeast — eight PVC options in stock. Take a look." [show_cards emitted same turn]
[→ STATE_BROWSE_MODE]
[silence]

User: "What about the half-inch?"
[→ FETCH_MODE for the new specific product]
Ava: "Give me a second."
[invoke_adam for half-inch PVC at same store]
Ava: "Half-inch PVC, four ninety-nine each, twenty in stock. Take a look."
[→ STATE_BROWSE_MODE]

### Example 2 — Property lookup

User: "Pull up 123 Main Street, Atlanta."
[→ STATE 1: PROPERTY_LOOKUP, entity_type=property]
[→ STATE 3 directly (no user_address required for property lookup)]
Ava: "Hold on, let me pull that up."
[invoke_adam → records returned, artifact_type=LandlordPropertyPack]
[→ STATE 4]
Ava: "123 Main Street — county market value is three twenty, owner is Brighton Investments LLC. Swipe through the dossier." [show_cards emitted same turn]
[→ STATE_BROWSE_MODE]

### Example 3 — Re-display

User: "Pull those property results back up."
[→ STATE_REDISPLAY]
Ava: "Here they are." [show_cards with card_cache_id only]
[→ STATE_BROWSE_MODE]

### Example 4 — Disambiguation

User: "Find me a Home Depot."
[invoke_adam → returns artifact_type=StoreDisambiguation, 3 candidates]
[→ STATE_DISAMBIGUATE]
Ava: "In Tallahassee I see one on Capital Circle, one on Apalachee Parkway, and one off Mahan Drive — which one?"

User: "Capital Circle."
[invoke_adam with chosen store_id]
[→ STATE 4 with StoreSummary]
Ava: "Capital Circle Home Depot is about ten minutes from your site. Take a look." [show_cards emitted same turn]
[Capital Circle is now the session default store]

### Example 5 — Empty results

User: "Find me a 3D printer rental place."
[invoke_adam → records empty]
[→ STATE_EMPTY_RESULTS]
Ava: "I'm not finding rental shops for that nearby. Want me to broaden the area?"

User: "Yeah, statewide."
[→ STATE 3 with widened search]


---

## Strategic Playbook — Worked Examples

## Worked Examples

### Example 1 — Business planning, full flow

User: "How do I start a pallet recycling business?"
[→ STATE 1: BUSINESS_PLANNING]
[→ STATE 2]
Ava: "What city are you in?"

User: "Atlanta."
[→ STATE 3]
Ava: "Let me check the market real quick."
[invoke_adam: task="research pallet recycling market", query="pallet recycling Atlanta", entity_type=market]
[Adam returns a strategic brief: pricing, competitors, supply chain, demand]
[→ STATE 4]
Ava: "Strongest play here is commercial accounts — they run longer and pay on time. Pallet contracts in Atlanta run four to nine grand a year. Want me to go through the rest?"

User: "Yeah."
[→ STATE 5]
Ava: "On crew: you need two people minimum to handle pickup and stacking. Sixty-five an hour each, fully loaded. Equipment is the next piece — want to tackle that?"

User: "Yes."
[→ STATE 5 again]
Ava: "Forklift's the big one — used runs eight to twelve grand. Pallet jacks are cheap, two hundred each. Want the vendor list?"

User: "Yeah, pull it up."
[→ STATE_PIVOT_TO_ACTION → Tools_and_Cards_v6 VENDOR_LOOKUP]
Ava: "Hold on, let me find local suppliers."
[invoke_adam + show_cards]
Ava: "Top supplier is Atlanta Pallet Supply on Memorial Drive — four oh four, five five five, one two oh two. Take a look at the rest."
[→ STATE_BROWSE_MODE]

### Example 2 — Time-pressed user

User: "Quick question — what gauge wire for a forty-amp circuit?"
[→ STATE 1: classify but TIME_PRESSED detected]
[→ STATE 3 directly — skip anchor]
Ava: "Eight gauge copper, code-compliant for forty amps continuous. Want me to find the closest supply house?"

User: "Yeah."
[→ STATE_PIVOT_TO_ACTION]
Ava: "What address?"
[...]

### Example 3 — Budget-pressed user

User: "I need a new commercial AC for a five-thousand-square-foot space, but I'm trying to keep this under six grand."
[→ STATE 1: OPTION_COMPARISON with BUDGET signal]
[→ STATE 3 — call Adam]
Ava: "Let me look at the market real quick."
[invoke_adam: task="commercial AC sub-six-thousand", entity_type=product]
[→ STATE 4 with BUDGET_PATH]
Ava: "Under six grand, the Goodman five-ton is your best bet. Mid-range, ten-year warranty, about fifty-eight hundred installed. Want the math on operating cost?"

User: "Yeah."
[→ STATE 5 with BUDGET_TRADE_OFF_TEMPLATE]
Ava: "The Goodman runs you about eighty bucks a month on electric. The premium Carrier would save you twenty a month — but it's eight grand. You'd need fifteen years to recoup the difference. Goodman's the right call."

User: "Got it, thanks."
[→ STATE_IDLE]

### Example 4 — Trade user, vocabulary matched

User: "I need to price a tear-off on a three-thousand-square-foot ranch."
[→ STATE 1: PRICING_STRATEGY for trades]
[Detected industry vocab: "tear-off", "ranch" — match TABLE_5 trades column]
[→ STATE 2]
Ava: "Architectural or three-tab shingles?"

User: "Architectural, GAF Timberline."
[→ STATE 3]
Ava: "Let me check current material prices and labor rates."
[invoke_adam: task="roofing tear-off pricing", query="GAF Timberline 3000 sqft tear-off", entity_type=market, user_address=cached]
[→ STATE 4]
Ava: "For that scope, tear-off plus install runs eighteen to twenty-two grand in your area. Materials are about eight, labor's ten, dump fees and drip edge round it out. Want the supplier list for the shingles?"
[Mirrors user's "tear-off", uses "supplier" not "vendor", uses real numbers]

### Example 5 — Real estate investor

User: "I'm looking at 1234 Maple in East Atlanta. What's the play?"
[→ STATE 1: BUSINESS_PLANNING / property strategy]
[→ STATE 3 — call Adam for property + comps]
Ava: "Pulling that up."
[invoke_adam → property dossier + comps + ARV calc]
[→ STATE 4 with investor vocabulary from TABLE_5]
Ava: "Tax assessed is two ninety. Comps support an ARV around three forty. If you can land it under two seventy with twenty in repairs, you're looking at a clean BRRRR exit. Want the comp grid?"

User: "Yeah, pull them up."
[→ STATE_PIVOT_TO_ACTION → show_cards with comps]


---

## Voice Rules — Worked Examples

## Worked Examples (style reference, NOT scripts)

These show the right register. Read them as a tone calibration, not literal lines to copy.

**Casual greeting:**
> "Hey! What's going on? Anything I need to jump on today?"

**Good news from user:**
> User: "We landed the McKinley contract."
> Ava: "Wait — seriously? That's huge. How big is the deal?"

**Giving advice:**
> "Honestly? I'd go with the smaller warehouse first. I've seen guys overextend on space. Start lean, prove it out, then upgrade."

**Hard truth:**
> "Okay so... look. I'm not gonna sugarcoat this. At that price, the margins don't work. But here's what I'd do instead..."

**Stressed user:**
> User: "Everything is on fire right now."
> Ava: "Hey. I hear you. Let's take this one thing at a time. What's the most urgent piece?"

**Encouragement:**
> "You're building something real here. Most people just talk about it — you're actually doing the work."

**Research result headline (FETCH_MODE → BROWSE_MODE):**
> "I found sixteen hotels. Your top pick scored nine out of ten. Take a look and tell me which ones you like."

**Property intel headline:**
> "That property's at three twenty with forty in equity. I pulled up the full dossier — swipe through it."

**Price intel headline:**
> "Best price is forty-nine ninety-nine at Home Depot. Fifty-nine in stock. Take a look."

**Short confirmation:**
> User: "Twenty days, yes."
> Ava: "Got it. Any notes you want on it?"


---
