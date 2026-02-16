export const palletIndustryProfile = {
  industry: "wooden_pallets",
  label: "Wooden Pallet Business",
  businessName: "Scott Pallet Services",
  region: "Atlanta, GA",
  persona: "Owner-operator",
};

export const dailyBrief = {
  id: "brief-2026-01-22",
  date: "2026-01-22",
  title: "Pricing power is hiding in your pickup radius and repair grading",
  bullets: [
    "Separate pricing for A/B/C grade pallets; stop averaging margins.",
    "Tighten pickup radius or add a fuel surcharge beyond 25 miles.",
    "Sell repaired pallets with documented grading to justify higher price points."
  ],
  whyItMatters:
    "Most pallet shops lose margin through blended pricing and uncontrolled logistics costs.",
  ctas: [
    { label: "Discuss with Ava", action: "OPEN_STUDIO", params: { mode: "pricing" } },
    { label: "Save takeaway", action: "SAVE_TO_NOTES" }
  ],
  imageKey: "pallet-yard",
  tags: ["pricing", "logistics", "margin", "wooden_pallets"],
};

export const pulseItems = [
  {
    id: "pulse-1",
    category: "Sales",
    title: "Cold outreach angle: 'reduce dock congestion with scheduled pallet pickup'",
    summary: "A practical hook for warehouses frustrated with random pickup windows.",
    imageKey: "warehouse-dock",
    tags: ["outreach", "logistics", "wooden_pallets"],
  },
  {
    id: "pulse-2",
    category: "Operations",
    title: "Grade drift is silently killing margin",
    summary: "If your A/B/C sorting isn't consistent, your pricing model collapses.",
    imageKey: "pallet-stacks",
    tags: ["ops", "quality", "wooden_pallets"],
  },
  {
    id: "pulse-3",
    category: "Procurement",
    title: "Win back supply: partner with small manufacturers for offcuts",
    summary: "A low-competition supplier channel for repair wood and stringers.",
    imageKey: "lumber-yard",
    tags: ["supply", "recycling", "wooden_pallets"],
  },
  {
    id: "pulse-4",
    category: "Safety",
    title: "Forklift zone markings reduce incidents and downtime",
    summary: "Simple floor marking SOPs reduce near-misses and insurance risk.",
    imageKey: "safety-floor",
    tags: ["safety", "ops", "wooden_pallets"],
  },
  {
    id: "pulse-5",
    category: "Market",
    title: "Value prop shift: 'pallet recovery program' beats 'pallet sales'",
    summary: "Position as a recovery partner, not a commodity vendor.",
    imageKey: "truck-loading",
    tags: ["positioning", "sales", "wooden_pallets"],
  },
  {
    id: "pulse-6",
    category: "Pricing",
    title: "Add a minimum order threshold for deliveries",
    summary: "Small drops eat profit—minimums protect your route economics.",
    imageKey: "delivery-truck",
    tags: ["pricing", "logistics", "wooden_pallets"],
  },
];

export const templates = [
  {
    id: "tpl-quote-followup-7-14-21",
    type: "Follow-up Sequence",
    title: "7/14/21 Quote Follow-Up for Pallet Buyers",
    description: "Polite persistence without sounding needy. Includes 3 emails + 1 call script.",
    tags: ["templates", "outreach", "wooden_pallets"],
    ctas: [
      { label: "Customize", action: "OPEN_TEMPLATE_EDITOR" },
      { label: "Send to Operate", action: "HANDOFF_TO_OPERATE" }
    ],
    imageKey: "template-cover-outreach",
  },
  {
    id: "tpl-cold-email-warehouse",
    type: "Cold Email",
    title: "Cold Email: Warehouse Manager — Pickup Scheduling Angle",
    description: "A short pitch focused on reducing dock congestion and missed pickups.",
    tags: ["cold_email", "sales", "wooden_pallets"],
    ctas: [{ label: "Customize", action: "OPEN_TEMPLATE_EDITOR" }],
    imageKey: "template-cover-sales",
  },
  {
    id: "tpl-referral-ask",
    type: "Script",
    title: "Referral Ask Script After Successful Delivery",
    description: "Simple ask that works for repeat buyers and brokers.",
    tags: ["sales", "scripts", "wooden_pallets"],
    ctas: [{ label: "Customize", action: "OPEN_TEMPLATE_EDITOR" }],
    imageKey: "template-cover-scripts",
  },
];

export const playbooks = [
  {
    id: "pb-grade-sop",
    title: "A/B/C Grading SOP (Margin Protection)",
    description: "Standard Operating Procedure for consistent pallet grading",
    steps: [
      "Define A/B/C visually (photos) and print at the sorting station",
      "Spot-check 10 pallets per hour during peak",
      "Track rework rate; if >5%, retrain grading"
    ],
    tags: ["ops", "quality", "wooden_pallets"],
    imageKey: "playbook-cover-ops",
  },
  {
    id: "pb-pickup-routing",
    title: "Pickup Routing Rules (Fuel + Time Control)",
    description: "Optimize routes to protect margins on logistics",
    steps: [
      "Standard radius (e.g., 25 miles). Beyond that: surcharge or schedule bundling",
      "Group pickups by zone and day",
      "Reject low-volume pickups unless combined"
    ],
    tags: ["logistics", "pricing", "wooden_pallets"],
    imageKey: "playbook-cover-logistics",
  },
];

export const journalPrompts = [
  { id: "jp-1", prompt: "What is the one constraint limiting growth this week (leads, supply, labor, cash)?" },
  { id: "jp-2", prompt: "What would make our pricing defensible instead of comparable?" },
  { id: "jp-3", prompt: "What repeatable system can we install in 30 minutes today?" },
];

export const masterminds = [
  {
    id: "mm-1",
    title: "Pallet Founder Mastermind — Weekly Ops & Sales",
    nextSession: "2026-01-24T18:00:00",
    agenda: [
      "Wins + stuck points (5 min each)",
      "One pricing lever per business (grading, radius, minimums)",
      "Accountability commitments for next week"
    ],
    prepPrompts: [
      "Bring 1 stuck deal and 1 margin problem",
      "Bring your top 3 customer types (warehouse, broker, manufacturer)"
    ],
    lastCommitments: [
      "Implement A/B/C grading photos at sorting station",
      "Test 25-mile radius pricing with fuel surcharge",
      "Follow up on 3 cold leads from last week"
    ],
  }
];

export const studioModes = [
  { id: "offer", label: "Offer", icon: "gift-outline" },
  { id: "pricing", label: "Pricing", icon: "cash-outline" },
  { id: "outreach", label: "Outreach", icon: "mail-outline" },
  { id: "market", label: "Market", icon: "trending-up-outline" },
  { id: "ops", label: "Ops", icon: "settings-outline" },
];

export const todayHighlights = [
  { id: "hl-1", title: "Quote follow-up due", description: "ABC Logistics - $4,200 order", type: "action" },
  { id: "hl-2", title: "New pulse article", description: "Grade drift margins", type: "content" },
];

export const openLoops = [
  { id: "ol-1", title: "Cold email draft", status: "needs review", type: "template" },
  { id: "ol-2", title: "Pricing calculator", status: "in progress", type: "studio" },
];

export type ImageKeyType = 
  | "pallet-yard" 
  | "warehouse-dock" 
  | "pallet-stacks" 
  | "lumber-yard" 
  | "safety-floor" 
  | "truck-loading" 
  | "delivery-truck"
  | "template-cover-outreach"
  | "template-cover-sales"
  | "template-cover-scripts"
  | "playbook-cover-ops"
  | "playbook-cover-logistics";
