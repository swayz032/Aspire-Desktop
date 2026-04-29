/**
 * ElevenLabs ConvAI tool param normalizer.
 *
 * ElevenLabs validation requires that each request_body_schema property has
 * EXACTLY ONE of: `description`, `dynamic_variable`, `is_system_provided`,
 * `constant_value`. Default-valued empty fields ('', false) cause validation
 * failures with "Can only set one of...".
 *
 * This helper recursively walks a tool schema and removes the empty/conflicting
 * fields, preserving only the meaningful one in priority:
 *   1. dynamic_variable (when non-empty string)
 *   2. constant_value (when truthy)
 *   3. is_system_provided (when true)
 *   4. description (default)
 */

function normalizeLeaf(p) {
  if (typeof p !== 'object' || p === null) return p;
  // Recurse first
  if (p.properties && typeof p.properties === 'object') {
    for (const k of Object.keys(p.properties)) {
      p.properties[k] = normalizeLeaf(p.properties[k]);
    }
  }
  if (p.items) {
    p.items = normalizeLeaf(p.items);
  }
  // Pick exactly one of the four fields based on priority
  const hasDV = typeof p.dynamic_variable === 'string' && p.dynamic_variable !== '';
  const hasCV =
    p.constant_value !== undefined &&
    p.constant_value !== null &&
    p.constant_value !== '' &&
    !(Array.isArray(p.constant_value) && p.constant_value.length === 0);
  const hasISP = p.is_system_provided === true;
  if (hasDV) {
    delete p.description;
    delete p.is_system_provided;
    delete p.constant_value;
  } else if (hasCV) {
    delete p.description;
    delete p.is_system_provided;
    delete p.dynamic_variable;
  } else if (hasISP) {
    delete p.description;
    delete p.dynamic_variable;
    delete p.constant_value;
  } else {
    // Default to description; clean up empty alternatives
    delete p.dynamic_variable;
    delete p.is_system_provided;
    delete p.constant_value;
    if (p.description === undefined || p.description === '') {
      // Provide a stub to satisfy validation
      p.description = p.description || 'parameter';
    }
  }
  return p;
}

export function normalizeTool(tool) {
  if (!tool || typeof tool !== 'object') return tool;
  // ElevenLabs may serve tools with schema at either `tool.api_schema` (top) or
  // `tool.webhook.api_schema` (nested). Normalize whichever exists.
  const candidates = [
    tool?.api_schema?.request_body_schema,
    tool?.webhook?.api_schema?.request_body_schema,
  ];
  for (const schema of candidates) {
    if (schema?.properties && typeof schema.properties === 'object') {
      for (const k of Object.keys(schema.properties)) {
        schema.properties[k] = normalizeLeaf(schema.properties[k]);
      }
    }
  }
  return tool;
}

export function normalizeTools(tools) {
  if (!Array.isArray(tools)) return tools;
  return tools.map(normalizeTool);
}
