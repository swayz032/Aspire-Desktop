/**
 * Per-discipline static content for Story Mode v2 left-pane zones.
 *
 * Until Drew's REASON stage produces real per-project narrative, we render
 * generic but high-quality per-discipline content so a rookie GC gets
 * useful guidance immediately on every upload. Three categories per
 * discipline:
 *
 *   - scopeItems    → goes into WHAT'S IN SCOPE (replaces useless
 *                     per-sheet "A — per A-301" bullets)
 *   - commonMistakes → goes into a new "WATCH OUT FOR" zone (rookie
 *                     trap warnings, ~3 per discipline)
 *   - orderOfOps    → goes into a new "ORDER OF OPERATIONS" zone
 *                     (numbered steps, ~5 per discipline)
 *
 * Keys match `DisciplineMeta.key` from `blueprintsStoryV2.ts`.
 */

export interface DisciplineContent {
  scopeItems: string[];
  commonMistakes: string[];
  orderOfOps: string[];
}

export const DISCIPLINE_CONTENT: Record<string, DisciplineContent> = {
  general: {
    scopeItems: [
      'Cover sheet, sheet index, and applicable building codes for the whole project',
      'Project-wide rules (ADA mounting heights, partition types, abbreviations)',
      'Life safety + egress plans showing how people get out of the building',
      'Site location + jurisdiction context for permits and inspections',
    ],
    commonMistakes: [
      'Skipping the cover sheet — the addendum notes there usually change scope mid-project',
      'Missing the applicable code edition (NFPA, IBC, IMC) — local AHJ can fail an inspection over this',
      'Building before reading the life-safety plan — exit widths drive partition layout',
    ],
    orderOfOps: [
      'Read the cover sheet + sheet index before opening any other sheet',
      'Note the applicable code editions and any local amendments',
      'Walk the site with the life-safety plan to confirm egress paths',
      'Confirm scope boundaries with the owner before mobilization',
    ],
  },

  demolition: {
    scopeItems: [
      'Existing partitions, doors, and fixtures slated for removal',
      'Demolition protection for adjacent construction that stays',
      'Patch + repair scope for surfaces the demo touches',
      'Existing utility cutoffs (plumbing, electrical) that must be capped before demo',
    ],
    commonMistakes: [
      'Cutting without confirming existing utilities are de-energized + drained',
      'Skipping protection on adjacent finishes — patches always cost more than protection',
      'Missing existing-conditions sheets (EX-series) — they show what stays, not what goes',
    ],
    orderOfOps: [
      'Walk the site with the EX + AD sheets and tag everything coming out',
      'Coordinate utility cutoffs with the building engineer before any cut',
      'Install protection on adjacent floors, walls, and ceilings that stay',
      'Sequence demo so debris removal doesn\'t block remaining trades',
      'Document existing conditions with photos before swinging the hammer',
    ],
  },

  architectural: {
    scopeItems: [
      'Overall floor plan with partition layout and door positions',
      'Reflected ceiling plan (RCP) heights, grid, and lighting layout coordination',
      'Door schedule with frame types, hardware, and rating callouts',
      'Wall + floor finish schedule with paint colors, base, and transitions',
      'Interior elevations + sections where the architect calls them out',
    ],
    commonMistakes: [
      'Framing without checking the door schedule — rough opening sizes drive stud layout',
      'Ignoring the RCP — soffit and ceiling height changes affect partition heights',
      'Painting before confirming the finish schedule — colors often change in addenda',
    ],
    orderOfOps: [
      'Chalk partitions on the slab per the floor plan dimensions',
      'Frame walls, doorbucks, and any backing required by the partition type',
      'Coordinate with MEP for in-wall rough-in before drywall',
      'Hang and tape drywall, then prime',
      'Install doors, frames, hardware per the door schedule',
      'Apply finishes (paint, base, transitions) per the finish schedule',
    ],
  },

  structural: {
    scopeItems: [
      'Foundation + footing layout with rebar and concrete specs',
      'Slab on grade thickness, reinforcement, and joint pattern',
      'Steel frame erection sequence, connections, and column locations',
      'Load paths + bearing wall callouts',
    ],
    commonMistakes: [
      'Pouring slab without confirming embed locations (anchor bolts, sleeves) with MEP',
      'Misreading the column line grid — every other discipline references it',
      'Cutting structural members without an engineer\'s approval',
    ],
    orderOfOps: [
      'Survey + lay out the column grid before any excavation',
      'Form, place rebar, and pour footings per the foundation plan',
      'Form and pour the slab with embed coordination',
      'Erect steel or framing per the structural sequence',
      'Coordinate hanger and brace locations with MEP before deck closes',
    ],
  },

  plumbing: {
    scopeItems: [
      'Domestic cold + hot water supply layout from the meter to every fixture',
      'Sanitary waste + vent routing through floors and out the roof',
      'Fixture rough-in (toilets, lavs, sinks, drinking fountains, mop sinks)',
      'Water heater + recirculation loop installation',
      'Isolation valves + cleanouts per local code',
    ],
    commonMistakes: [
      'Setting fixtures before confirming dimensions on the enlarged restroom plan',
      'Forgetting isolation valves at each fixture group — code requires them',
      'Missing the slope spec — 1/4 in per foot on sanitary lines, no exceptions',
    ],
    orderOfOps: [
      'Mark drain + supply centerlines on the slab before the concrete pour',
      'Install under-slab waste and rough sleeves for vertical risers',
      'Pull supply lines in the walls per the domestic supply plan',
      'Run waste + vent per the waste/vent plan with cleanouts at every direction change',
      'Set water heater + connect recirculation loop',
      'Set fixtures + trim per the fixture schedule, test for leaks',
    ],
  },

  mechanical: {
    scopeItems: [
      'Heat pumps, AHUs, and ERV equipment setting + connections',
      'Ductwork routing with supports, dampers, and grilles',
      'Exhaust fans, louvers, and rooftop penetrations',
      'Refrigerant + condensate piping routed through the ceiling',
      'Gas line connections for any unit heaters or appliances',
    ],
    commonMistakes: [
      'Setting ductwork without checking RCP soffit heights — collisions are routine',
      'Missing refrigerant line length limits — exceeds spec = warranty void',
      'Forgetting the condensate pump or trap at the air handler',
    ],
    orderOfOps: [
      'Confirm equipment locations + clearances against the mechanical plan',
      'Cut roof penetrations for louvers and exhaust fans before MEP closes',
      'Set equipment + supports per the manufacturer spec',
      'Run ductwork with hangers, dampers, and balancing devices',
      'Connect refrigerant + condensate piping',
      'Commission + balance once the building is closed in',
    ],
  },

  electrical: {
    scopeItems: [
      'Lighting layout per the lighting plan + RCP coordination',
      'Power outlets, dedicated circuits, and panel feeder schedule',
      'Low-voltage cameras, access control, and data outlets',
      'Service entrance + main breaker panel work if applicable',
      'GFCI + AFCI protection on required circuits',
    ],
    commonMistakes: [
      'Pulling cable before confirming panel + breaker schedule loads',
      'Mounting fixtures before the architect signs off on RCP',
      'Forgetting GFCI on wet-location receptacles — failed inspection guaranteed',
    ],
    orderOfOps: [
      'Mark device + fixture locations on framing per the power and lighting plans',
      'Pull conductors through the walls before drywall closes',
      'Land panel feeders + breakers per the breaker feeder schedule',
      'Mount fixtures + devices once drywall is finished',
      'Install low-voltage cameras + access control rough + trim',
      'Test, label, and commission with the EE',
    ],
  },

  fire: {
    scopeItems: [
      'Sprinkler heads + branch line layout per the fire-protection plan',
      'Sprinkler drops coordinated with the RCP and HVAC ductwork',
      'Fire alarm devices (smoke detectors, pull stations, strobes)',
      'Fire-rated penetration sealing where pipes cross rated assemblies',
    ],
    commonMistakes: [
      'Running sprinkler drops without checking ductwork interferences in the ceiling',
      'Missing rated penetration seals at fire-rated walls — automatic fail',
      'Forgetting the AHJ inspection sequence — must hydro-test before drywall closes',
    ],
    orderOfOps: [
      'Lay out branch lines + drops per the fire-protection plan',
      'Coordinate drop locations with HVAC and the RCP before installing',
      'Install branch lines, drops, and fire-rated sleeves before drywall',
      'Hydro-test the system with the AHJ + city water present',
      'Set sprinkler heads at the final ceiling height',
      'Install fire-alarm devices, test, and commission',
    ],
  },

  civil: {
    scopeItems: [
      'Site layout, grading, and drainage per the civil plan',
      'Paving (drives, walks, ADA-accessible routes) and curbs',
      'Utility tie-ins at the property line (water, sewer, gas, telecom)',
      'Landscape + irrigation if landscape sheets are included',
      'Erosion + sediment control during construction',
    ],
    commonMistakes: [
      'Starting site work before confirming utility locates (Call 811)',
      'Missing erosion control on a sloped site — fines pile up fast',
      'Pouring paving before underground utilities are inspected + approved',
    ],
    orderOfOps: [
      'Mark utilities + locate calls before any excavation',
      'Strip topsoil and stockpile per the erosion-control plan',
      'Rough grade + compact subgrade to spec',
      'Install underground utilities and tie in at the property line',
      'Place paving with proper slope to drainage',
      'Final grade, landscape, and restore disturbed areas',
    ],
  },
};

/** Default per-discipline content used when the key is unknown.
 *  Keeps the UI from breaking on an unrecognized chapter key. */
export const FALLBACK_CONTENT: DisciplineContent = {
  scopeItems: [
    'Sheets grouped by discipline classification',
    'Refer to DREW READ chips below for the full sheet list',
  ],
  commonMistakes: [
    'Drew is still extracting per-discipline rookie hints for this chapter',
  ],
  orderOfOps: [
    'Refer to the original drawings for sequencing',
  ],
};

/** Resolve content by chapter key (must match the keys in
 *  `blueprintsStoryV2.ts` DISCIPLINE_MAP — `general` / `demolition` /
 *  `architectural` / `structural` / `plumbing` / `mechanical` /
 *  `electrical` / `fire` / `civil`). */
export function contentForChapter(chapterKey: string): DisciplineContent {
  return DISCIPLINE_CONTENT[chapterKey] ?? FALLBACK_CONTENT;
}
