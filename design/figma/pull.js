// Figma → JSON: reads every local variable of the Figma file and returns it in the shape of design/tokens.json.
// Runs inside Figma (Plugin API), not in Node: Claude passes this file's text to the Figma MCP tool `use_figma`
// (file key in design/figma-map.json), saves the result as design/.figma-export.json and runs `npm run tokens:sync`.
// Read-only: it changes nothing in Figma.

const hex = (n) => Math.round(n * 255).toString(16).padStart(2, "0");
const color = (c) => "#" + hex(c.r) + hex(c.g) + hex(c.b) + ("a" in c && c.a < 1 ? hex(c.a) : "");
const TYPES = { COLOR: "color", FLOAT: "number", STRING: "string", BOOLEAN: "boolean" };

const cols = await figma.variables.getLocalVariableCollectionsAsync();
const names = {};                                        // variable id → "Collection/name", for aliases
const all = [];
for (const c of cols) {
  for (const id of c.variableIds) {
    const v = await figma.variables.getVariableByIdAsync(id);
    names[id] = c.name + "/" + v.name;
    all.push([c, v]);
  }
}
const out = { collections: {}, tokens: {} };
for (const c of cols) {
  out.collections[c.name] = { modes: c.modes.map((m) => m.name) };
  out.tokens[c.name] = {};
}
for (const [c, v] of all) {
  const values = {};
  for (const m of c.modes) {
    const raw = v.valuesByMode[m.modeId];
    values[m.name] =
      raw && typeof raw === "object" && raw.type === "VARIABLE_ALIAS" ? { alias: names[raw.id] || raw.id }
      : v.resolvedType === "COLOR" ? color(raw)
      : v.resolvedType === "FLOAT" ? Math.round(raw * 100) / 100
      : raw;
  }
  const t = { type: TYPES[v.resolvedType] };
  t.value = c.modes.length === 1 ? values[c.modes[0].name] : values;
  if (v.codeSyntax && v.codeSyntax.WEB) t.web = v.codeSyntax.WEB;
  if (v.description) t.description = v.description;
  out.tokens[c.name][v.name] = t;
}
return out;
