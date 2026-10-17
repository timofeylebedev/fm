// Code → Figma: the template of design/figma/push.gen.js. `npm run tokens:sync` fills CHANGES with the values that
// changed in design/tokens.json since the last sync, and Claude runs push.gen.js with the Figma MCP tool `use_figma`.
// It touches only those values: one variable, one field, one mode at a time. Runs inside Figma (Plugin API).
// A change is { collection, name, field: "type"|"value"|"web"|"description", mode?, type, value } (value null = removed).

const CHANGES = /*CHANGES*/[];

const TYPES = { color: "COLOR", number: "FLOAT", string: "STRING", boolean: "BOOLEAN" };
// what a new variable may be applied to in Figma (by its name), so it does not show up in every picker
const scopesFor = (name, type) =>
  type === "color" ? ["ALL_FILLS", "STROKE_COLOR", "EFFECT_COLOR"]
  : type === "string" ? ["FONT_FAMILY", "FONT_STYLE"]
  : type === "boolean" ? []
  : /^type\//.test(name) ? ["FONT_SIZE"]
  : /radius/.test(name) ? ["CORNER_RADIUS"]
  : /(gap|pad)/.test(name) ? ["GAP"]
  : ["WIDTH_HEIGHT", "GAP"];

const rgba = (hex) => {
  const h = hex.slice(1);
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
};

const cols = await figma.variables.getLocalVariableCollectionsAsync();
const byName = {};                                    // "Collection/name" → variable
for (const c of cols) for (const id of c.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  byName[c.name + "/" + v.name] = v;
}
const toFigma = async (type, value) => {
  if (value && typeof value === "object" && "alias" in value) {
    const target = byName[value.alias];
    if (!target) throw new Error(`alias target ${value.alias} not found`);
    return figma.variables.createVariableAlias(target);
  }
  return type === "color" ? rgba(value) : value;
};

const done = [], skipped = [];
// variables that are new in the code: create them first
for (const ch of CHANGES.filter((c) => c.field === "type" && c.value !== null)) {
  const key = ch.collection + "/" + ch.name;
  if (byName[key]) continue;
  const col = cols.find((c) => c.name === ch.collection);
  if (!col) { skipped.push(`${key}: no collection "${ch.collection}" in Figma`); continue; }
  const v = figma.variables.createVariable(ch.name, col, TYPES[ch.value]);
  v.scopes = scopesFor(ch.name, ch.value);
  byName[key] = v;
  done.push(`${key}: created (${ch.value})`);
}
for (const ch of CHANGES) {
  const key = ch.collection + "/" + ch.name;
  const v = byName[key];
  if (ch.field === "type") {
    if (ch.value === null && v) { v.remove(); done.push(`${key}: removed`); }
    continue;
  }
  if (!v) { skipped.push(`${key}: not in Figma`); continue; }
  const col = cols.find((c) => c.id === v.variableCollectionId);
  if (ch.field === "value") {
    if (ch.value === null) { skipped.push(`${key}: no value to remove`); continue; }
    const mode = ch.mode === undefined ? col.modes[0] : col.modes.find((m) => m.name === ch.mode);
    if (!mode) { skipped.push(`${key}: no mode "${ch.mode}"`); continue; }
    v.setValueForMode(mode.modeId, await toFigma(ch.type, ch.value));
    done.push(`${key}${ch.mode ? " @" + ch.mode : ""} = ${JSON.stringify(ch.value)}`);
  } else if (ch.field === "web") {
    if (ch.value === null) v.removeVariableCodeSyntax("WEB"); else v.setVariableCodeSyntax("WEB", ch.value);
    done.push(`${key}: web = ${ch.value}`);
  } else if (ch.field === "description") {
    v.description = ch.value ?? "";
    done.push(`${key}: description`);
  }
}
return { changed: done.length, done, skipped };
