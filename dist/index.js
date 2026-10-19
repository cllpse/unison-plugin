"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));

  // src/legacyNames.ts
  var canonicalName = (name) => name.split("/").map((part) => part.replace(/^unison-/, "")).join("-").replace(/^fill-/, "");
  var adoptStyle = async (styles, name, create, apply) => {
    const exact = styles.find((style2) => style2.name === name);
    const older = styles.filter((style2) => style2 !== exact && canonicalName(style2.name) === canonicalName(name));
    const found = exact != null ? exact : older.shift();
    const style = found != null ? found : create();
    style.name = name;
    for (const copy of older) {
      for (const { node } of await copy.getStyleConsumersAsync()) {
        await apply(node, style);
      }
      copy.remove();
    }
    return { style, existed: found !== void 0 };
  };

  // src/createShadowStyles.ts
  var SHADOW_VARIABLE = /^shadow-([^-]+)-(\d+)-(offset-x|offset-y|blur|spread|color)$/;
  var FIELDS = {
    "offset-x": "offsetX",
    "offset-y": "offsetY",
    blur: "radius",
    spread: "spread",
    color: "color"
  };
  var modeValue = (variable) => variable ? Object.values(variable.valuesByMode)[0] : void 0;
  var numberOf = (variable) => {
    const value = modeValue(variable);
    return typeof value === "number" ? value : 0;
  };
  var colorOf = (variable) => {
    const value = modeValue(variable);
    if (value && typeof value === "object" && "r" in value) {
      return __spreadValues({ a: 1 }, value);
    }
    return { r: 0, g: 0, b: 0, a: 0.1 };
  };
  var buildEffect = (layer) => {
    let effect = {
      type: "DROP_SHADOW",
      visible: true,
      blendMode: "NORMAL",
      offset: { x: numberOf(layer["offset-x"]), y: numberOf(layer["offset-y"]) },
      radius: numberOf(layer.blur),
      spread: numberOf(layer.spread),
      color: colorOf(layer.color)
    };
    for (const [field, variable] of Object.entries(layer)) {
      if (variable) {
        effect = figma.variables.setBoundVariableForEffect(effect, FIELDS[field], variable);
      }
    }
    return effect;
  };
  var createShadowStyles = async () => {
    var _a, _b;
    if (figma.editorType !== "figma") {
      return "Shadow styles need the Figma editor.";
    }
    const shadows = /* @__PURE__ */ new Map();
    for (const variable of await figma.variables.getLocalVariablesAsync()) {
      const match = variable.name.match(SHADOW_VARIABLE);
      if (!match) continue;
      const [, name, index, field] = match;
      const layers = (_a = shadows.get(name)) != null ? _a : /* @__PURE__ */ new Map();
      const layer = (_b = layers.get(Number(index))) != null ? _b : {};
      layer[field] = variable;
      layers.set(Number(index), layer);
      shadows.set(name, layers);
    }
    if (shadows.size === 0) {
      return "No shadow variables found.";
    }
    const styles = await figma.getLocalEffectStylesAsync();
    let created = 0;
    let updated = 0;
    let previous = null;
    for (const [name, layers] of shadows) {
      const { style, existed } = await adoptStyle(
        styles,
        "shadow-".concat(name),
        () => figma.createEffectStyle(),
        async (node, adopted) => {
          if ("setEffectStyleIdAsync" in node) await node.setEffectStyleIdAsync(adopted.id);
        }
      );
      style.effects = [...layers.entries()].sort(([a], [b]) => a - b).map(([, layer]) => buildEffect(layer));
      if (previous) figma.moveLocalEffectStyleAfter(style, previous);
      previous = style;
      if (existed) {
        updated++;
      } else {
        created++;
      }
    }
    return "Shadow styles: ".concat(created, " created, ").concat(updated, " updated.");
  };

  // src/createTextStyles.ts
  var TYPOGRAPHY_VARIABLE = /^(font-size|line-height)-(.+)$/;
  var DEFAULT_FONT = { family: "Inter", style: "Regular" };
  var createTextStyles = async () => {
    var _a, _b;
    if (figma.editorType !== "figma") {
      return "Text styles need the Figma editor.";
    }
    const sizes = /* @__PURE__ */ new Map();
    for (const variable of await figma.variables.getLocalVariablesAsync("FLOAT")) {
      const match = variable.name.match(TYPOGRAPHY_VARIABLE);
      if (!match) continue;
      const [, field, name] = match;
      const size = (_a = sizes.get(name)) != null ? _a : {};
      size[field] = variable;
      sizes.set(name, size);
    }
    if (sizes.size === 0) {
      return "No font-size variables found.";
    }
    const styles = await figma.getLocalTextStylesAsync();
    let created = 0;
    let updated = 0;
    let previous = null;
    for (const [name, size] of sizes) {
      const fontSize = size["font-size"];
      if (!fontSize) continue;
      const { style, existed } = await adoptStyle(
        styles,
        "text-".concat(name),
        () => figma.createTextStyle(),
        async (node, adopted) => {
          if (node.type === "TEXT") await node.setTextStyleIdAsync(adopted.id);
        }
      );
      await figma.loadFontAsync(existed ? style.fontName : DEFAULT_FONT);
      if (!existed) {
        style.fontName = DEFAULT_FONT;
      }
      style.setBoundVariable("fontSize", fontSize);
      style.setBoundVariable("lineHeight", (_b = size["line-height"]) != null ? _b : null);
      if (previous) figma.moveLocalTextStyleAfter(style, previous);
      previous = style;
      if (existed) {
        updated++;
      } else {
        created++;
      }
    }
    return "Text styles: ".concat(created, " created, ").concat(updated, " updated.");
  };

  // src/importVariables.ts
  var TYPES = {
    color: "COLOR",
    number: "FLOAT",
    string: "STRING",
    boolean: "BOOLEAN"
  };
  var KEY_MARK = "#";
  var parseOrdered = (text) => {
    const toMaps = (value) => {
      if (Array.isArray(value)) return value.map(toMaps);
      if (value && typeof value === "object") {
        return new Map(Object.entries(value).map(([key, child]) => [key.slice(KEY_MARK.length), toMaps(child)]));
      }
      return value;
    };
    return toMaps(JSON.parse(text.replace(/"((?:[^"\\]|\\.)*)"(\s*:)/g, '"'.concat(KEY_MARK, '$1"$2'))));
  };
  var toObject = (value) => value instanceof Map ? Object.fromEntries([...value].map(([key, child]) => [key, toObject(child)])) : value;
  var isNumberToken = (node) => node instanceof Map && node.get("$type") === "number";
  var scaleOf = (name) => name.slice(0, Math.max(name.lastIndexOf("-"), 0));
  var flatten = (group, path = "", tokens = /* @__PURE__ */ new Map()) => {
    const children = [...group].filter(([key, node]) => !key.startsWith("$") && node instanceof Map);
    const scales = [...new Set(children.map(([key]) => scaleOf(key)))];
    const numberScales = new Set(
      scales.filter((scale2) => children.every(([key, node]) => scaleOf(key) !== scale2 || isNumberToken(node)))
    );
    children.sort(([keyA, a], [keyB, b]) => {
      const scale2 = scales.indexOf(scaleOf(keyA)) - scales.indexOf(scaleOf(keyB));
      if (scale2 !== 0 || !numberScales.has(scaleOf(keyA))) return scale2;
      return Number(a.get("$value")) - Number(b.get("$value"));
    });
    for (const [key, node] of children) {
      const name = "".concat(path).concat(key);
      if (node.has("$value")) {
        tokens.set(name, toObject(node));
      } else {
        flatten(node, "".concat(name, "/"), tokens);
      }
    }
    return tokens;
  };
  var valueOfToken = (token) => {
    if (token.$type === "color") {
      const { components, alpha } = token.$value;
      return { r: components[0], g: components[1], b: components[2], a: alpha };
    }
    return token.$value;
  };
  var modeName = (mode) => {
    const extensions = mode.get("$extensions");
    const name = extensions instanceof Map ? extensions.get("com.figma.modeName") : void 0;
    return typeof name === "string" ? name : "Default";
  };
  var importVariables = async (text) => {
    var _a, _b, _c, _d, _e, _f;
    if (figma.editorType !== "figma") {
      return "Variables need the Figma editor.";
    }
    let file;
    try {
      file = typeof text === "string" ? parseOrdered(text) : void 0;
    } catch (e) {
      file = void 0;
    }
    if (!(file instanceof Map)) {
      throw new Error("not a tokens file.");
    }
    const collectionsInFile = [...file].map(([name, modes]) => ({
      name,
      modes: modes instanceof Map ? [...modes.values()].filter((mode) => mode instanceof Map) : []
    }));
    if (collectionsInFile.length === 0 || collectionsInFile.some(({ modes }) => modes.length === 0)) {
      throw new Error("not a tokens file.");
    }
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();
    let created = 0;
    let updated = 0;
    for (const { name, modes } of collectionsInFile) {
      const collection = (_b = (_a = collections.find((existing) => existing.name === name)) != null ? _a : collections.find((existing) => canonicalName(existing.name) === canonicalName(name))) != null ? _b : figma.variables.createVariableCollection(name);
      collection.name = name;
      const modeIds = modes.map((mode, i) => {
        const existing = collection.modes.find((m) => m.name === modeName(mode));
        if (existing) return existing.modeId;
        if (i === 0) {
          collection.renameMode(collection.defaultModeId, modeName(mode));
          return collection.defaultModeId;
        }
        return collection.addMode(modeName(mode));
      });
      const inCollection = variables.filter((variable) => variable.variableCollectionId === collection.id);
      const byName = new Map(inCollection.map((variable) => [variable.name, variable]));
      const tokensByMode = modes.map((mode) => flatten(mode));
      for (const [variableName, token] of tokensByMode[0]) {
        const type = TYPES[token.$type];
        if (!type) continue;
        let variable = (_c = byName.get(variableName)) != null ? _c : inCollection.find(
          (existing) => !tokensByMode[0].has(existing.name) && canonicalName(existing.name) === canonicalName(variableName)
        );
        if (variable && variable.resolvedType !== type) {
          variable.remove();
          variable = void 0;
        }
        if (variable) {
          variable.name = variableName;
          updated++;
        } else {
          variable = figma.variables.createVariable(variableName, collection, type);
          created++;
        }
        variable.scopes = (_e = (_d = token.$extensions) == null ? void 0 : _d["com.figma.scopes"]) != null ? _e : ["ALL_SCOPES"];
        for (const [i, tokens] of tokensByMode.entries()) {
          variable.setValueForMode(modeIds[i], valueOfToken((_f = tokens.get(variableName)) != null ? _f : token));
        }
      }
    }
    return "Variables: ".concat(created, " created, ").concat(updated, " updated.");
  };

  // src/placeholder.js
  var placeholder = "\n\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800Frame Plugin\n\u2800\u2800\u2800\u2800\u2800\u2800\u2800Figma Generator\n\n\u2800\u2800\u2800Select a frame to generate\n\u2800\u2800\u2800\u2800\u2800React component code\u2026\n";
  if (typeof window !== "undefined") {
    window.placeholder = placeholder;
  }

  // src/serialize/annotationExclude.ts
  var EXCLUDE_MARK = "EXCLUDE_FROM_OUTPUT";
  var normalizeExcludeToken = (s) => (s != null ? s : "").trim().toUpperCase();
  var annotationMatchesExcludeFromOutput = (a, annotationCategories) => {
    if (normalizeExcludeToken(a.label) === EXCLUDE_MARK) {
      return true;
    }
    if (a.labelMarkdown && normalizeExcludeToken(a.labelMarkdown.replace(/<[^>]+>/g, " ")) === EXCLUDE_MARK) {
      return true;
    }
    const cats = annotationCategories != null ? annotationCategories : [];
    if (a.categoryId !== void 0) {
      for (const c of cats) {
        if (c.id === a.categoryId && normalizeExcludeToken(c.label) === EXCLUDE_MARK) {
          return true;
        }
      }
    }
    return false;
  };
  var hasExcludeFromOutputAnnotation = (annotations, annotationCategories) => (annotations != null ? annotations : []).some((a) => annotationMatchesExcludeFromOutput(a, annotationCategories));
  var findNearestInstanceAncestor = (node) => {
    let walk = node;
    while (walk) {
      if (walk.type === "INSTANCE") {
        return walk;
      }
      walk = walk.parent;
    }
    return null;
  };
  var getMainDefinitionLayerForNode = async (node, getMainComponent) => {
    const instance = findNearestInstanceAncestor(node);
    if (instance === null) {
      return null;
    }
    if (node === instance) {
      return await getMainComponent(instance);
    }
    const path = [];
    let current = node;
    while (current !== null) {
      const parent = current.parent;
      if (parent === null) {
        return null;
      }
      if (!("children" in parent)) {
        return null;
      }
      const siblings = parent.children;
      const idx = siblings.indexOf(current);
      if (idx < 0) {
        return null;
      }
      path.unshift(idx);
      if (parent === instance) {
        break;
      }
      current = parent;
    }
    if (current === null || current.parent !== instance) {
      return null;
    }
    const main = await getMainComponent(instance);
    if (main === null) {
      return null;
    }
    let def = main;
    for (const i of path) {
      if (!("children" in def)) {
        return null;
      }
      const nextChildren = def.children;
      if (i >= nextChildren.length) {
        return null;
      }
      def = nextChildren[i];
    }
    return def;
  };

  // unison-components/dist/tokens.ts
  var TOKENS = {
    colors: {
      Light: {
        "fill-red-50": "#FEF2F2",
        "fill-red-100": "#FFE2E2",
        "fill-red-200": "#FFC9C9",
        "fill-red-300": "#FFA2A2",
        "fill-red-400": "#FF6467",
        "fill-red-500": "#FB2C36",
        "fill-red-600": "#E7000B",
        "fill-red-700": "#C10007",
        "fill-red-800": "#9F0712",
        "fill-red-900": "#82181A",
        "fill-red-950": "#460809",
        "fill-orange-50": "#FFF7ED",
        "fill-orange-100": "#FFEDD4",
        "fill-orange-200": "#FFD6A7",
        "fill-orange-300": "#FFB86A",
        "fill-orange-400": "#FF8904",
        "fill-orange-500": "#FF6900",
        "fill-orange-600": "#F54900",
        "fill-orange-700": "#CA3500",
        "fill-orange-800": "#9F2D00",
        "fill-orange-900": "#7E2A0C",
        "fill-orange-950": "#441306",
        "fill-amber-50": "#FFFBEB",
        "fill-amber-100": "#FEF3C6",
        "fill-amber-200": "#FEE685",
        "fill-amber-300": "#FFD230",
        "fill-amber-400": "#FFB900",
        "fill-amber-500": "#FE9A00",
        "fill-amber-600": "#E17100",
        "fill-amber-700": "#BB4D00",
        "fill-amber-800": "#973C00",
        "fill-amber-900": "#7B3306",
        "fill-amber-950": "#461901",
        "fill-yellow-50": "#FEFCE8",
        "fill-yellow-100": "#FEF9C2",
        "fill-yellow-200": "#FFF085",
        "fill-yellow-300": "#FFDF20",
        "fill-yellow-400": "#FDC700",
        "fill-yellow-500": "#F0B100",
        "fill-yellow-600": "#D08700",
        "fill-yellow-700": "#A65F00",
        "fill-yellow-800": "#894B00",
        "fill-yellow-900": "#733E0A",
        "fill-yellow-950": "#432004",
        "fill-lime-50": "#F7FEE7",
        "fill-lime-100": "#ECFCCA",
        "fill-lime-200": "#D8F999",
        "fill-lime-300": "#BBF451",
        "fill-lime-400": "#9AE600",
        "fill-lime-500": "#7CCF00",
        "fill-lime-600": "#5EA500",
        "fill-lime-700": "#497D00",
        "fill-lime-800": "#3C6300",
        "fill-lime-900": "#35530E",
        "fill-lime-950": "#192E03",
        "fill-green-50": "#F0FDF4",
        "fill-green-100": "#DCFCE7",
        "fill-green-200": "#B9F8CF",
        "fill-green-300": "#7BF1A8",
        "fill-green-400": "#05DF72",
        "fill-green-500": "#00C950",
        "fill-green-600": "#00A63E",
        "fill-green-700": "#008236",
        "fill-green-800": "#016630",
        "fill-green-900": "#0D542B",
        "fill-green-950": "#032E15",
        "fill-emerald-50": "#ECFDF5",
        "fill-emerald-100": "#D0FAE5",
        "fill-emerald-200": "#A4F4CF",
        "fill-emerald-300": "#5EE9B5",
        "fill-emerald-400": "#00D492",
        "fill-emerald-500": "#00BC7D",
        "fill-emerald-600": "#009966",
        "fill-emerald-700": "#007A55",
        "fill-emerald-800": "#006045",
        "fill-emerald-900": "#004F3B",
        "fill-emerald-950": "#002C22",
        "fill-teal-50": "#F0FDFA",
        "fill-teal-100": "#CBFBF1",
        "fill-teal-200": "#96F7E4",
        "fill-teal-300": "#46ECD5",
        "fill-teal-400": "#00D5BE",
        "fill-teal-500": "#00BBA7",
        "fill-teal-600": "#009689",
        "fill-teal-700": "#00786F",
        "fill-teal-800": "#005F5A",
        "fill-teal-900": "#0B4F4A",
        "fill-teal-950": "#022F2E",
        "fill-cyan-50": "#ECFEFF",
        "fill-cyan-100": "#CEFAFE",
        "fill-cyan-200": "#A2F4FD",
        "fill-cyan-300": "#53EAFD",
        "fill-cyan-400": "#00D3F2",
        "fill-cyan-500": "#00B8DB",
        "fill-cyan-600": "#0092B8",
        "fill-cyan-700": "#007595",
        "fill-cyan-800": "#005F78",
        "fill-cyan-900": "#104E64",
        "fill-cyan-950": "#053345",
        "fill-sky-50": "#F0F9FF",
        "fill-sky-100": "#DFF2FE",
        "fill-sky-200": "#B8E6FE",
        "fill-sky-300": "#74D4FF",
        "fill-sky-400": "#00BCFF",
        "fill-sky-500": "#00A6F4",
        "fill-sky-600": "#0084D1",
        "fill-sky-700": "#0069A8",
        "fill-sky-800": "#00598A",
        "fill-sky-900": "#024A70",
        "fill-sky-950": "#052F4A",
        "fill-blue-50": "#EFF6FF",
        "fill-blue-100": "#DBEAFE",
        "fill-blue-200": "#BEDBFF",
        "fill-blue-300": "#8EC5FF",
        "fill-blue-400": "#51A2FF",
        "fill-blue-500": "#2B7FFF",
        "fill-blue-600": "#155DFC",
        "fill-blue-700": "#1447E6",
        "fill-blue-800": "#193CB8",
        "fill-blue-900": "#1C398E",
        "fill-blue-950": "#162456",
        "fill-indigo-50": "#EEF2FF",
        "fill-indigo-100": "#E0E7FF",
        "fill-indigo-200": "#C6D2FF",
        "fill-indigo-300": "#A3B3FF",
        "fill-indigo-400": "#7C86FF",
        "fill-indigo-500": "#615FFF",
        "fill-indigo-600": "#4F39F6",
        "fill-indigo-700": "#432DD7",
        "fill-indigo-800": "#372AAC",
        "fill-indigo-900": "#312C85",
        "fill-indigo-950": "#1E1A4D",
        "fill-violet-50": "#F5F3FF",
        "fill-violet-100": "#EDE9FE",
        "fill-violet-200": "#DDD6FF",
        "fill-violet-300": "#C4B4FF",
        "fill-violet-400": "#A684FF",
        "fill-violet-500": "#8E51FF",
        "fill-violet-600": "#7F22FE",
        "fill-violet-700": "#7008E7",
        "fill-violet-800": "#5D0EC0",
        "fill-violet-900": "#4D179A",
        "fill-violet-950": "#2F0D68",
        "fill-purple-50": "#FAF5FF",
        "fill-purple-100": "#F3E8FF",
        "fill-purple-200": "#E9D4FF",
        "fill-purple-300": "#DAB2FF",
        "fill-purple-400": "#C27AFF",
        "fill-purple-500": "#AD46FF",
        "fill-purple-600": "#9810FA",
        "fill-purple-700": "#8200DB",
        "fill-purple-800": "#6E11B0",
        "fill-purple-900": "#59168B",
        "fill-purple-950": "#3C0366",
        "fill-fuchsia-50": "#FDF4FF",
        "fill-fuchsia-100": "#FAE8FF",
        "fill-fuchsia-200": "#F6CFFF",
        "fill-fuchsia-300": "#F4A8FF",
        "fill-fuchsia-400": "#ED6AFF",
        "fill-fuchsia-500": "#E12AFB",
        "fill-fuchsia-600": "#C800DE",
        "fill-fuchsia-700": "#A800B7",
        "fill-fuchsia-800": "#8A0194",
        "fill-fuchsia-900": "#721378",
        "fill-fuchsia-950": "#4B004F",
        "fill-pink-50": "#FDF2F8",
        "fill-pink-100": "#FCE7F3",
        "fill-pink-200": "#FCCEE8",
        "fill-pink-300": "#FDA5D5",
        "fill-pink-400": "#FB64B6",
        "fill-pink-500": "#F6339A",
        "fill-pink-600": "#E60076",
        "fill-pink-700": "#C6005C",
        "fill-pink-800": "#A3004C",
        "fill-pink-900": "#861043",
        "fill-pink-950": "#510424",
        "fill-rose-50": "#FFF1F2",
        "fill-rose-100": "#FFE4E6",
        "fill-rose-200": "#FFCCD3",
        "fill-rose-300": "#FFA1AD",
        "fill-rose-400": "#FF637E",
        "fill-rose-500": "#FF2056",
        "fill-rose-600": "#EC003F",
        "fill-rose-700": "#C70036",
        "fill-rose-800": "#A50036",
        "fill-rose-900": "#8B0836",
        "fill-rose-950": "#4D0218",
        "fill-slate-50": "#F8FAFC",
        "fill-slate-100": "#F1F5F9",
        "fill-slate-200": "#E2E8F0",
        "fill-slate-300": "#CAD5E2",
        "fill-slate-400": "#90A1B9",
        "fill-slate-500": "#62748E",
        "fill-slate-600": "#45556C",
        "fill-slate-700": "#314158",
        "fill-slate-800": "#1D293D",
        "fill-slate-900": "#0F172B",
        "fill-slate-950": "#020618",
        "fill-gray-50": "#F9FAFB",
        "fill-gray-100": "#F3F4F6",
        "fill-gray-200": "#E5E7EB",
        "fill-gray-300": "#D1D5DC",
        "fill-gray-400": "#99A1AF",
        "fill-gray-500": "#6A7282",
        "fill-gray-600": "#4A5565",
        "fill-gray-700": "#364153",
        "fill-gray-800": "#1E2939",
        "fill-gray-900": "#101828",
        "fill-gray-950": "#030712",
        "fill-zinc-50": "#FAFAFA",
        "fill-zinc-100": "#F4F4F5",
        "fill-zinc-200": "#E4E4E7",
        "fill-zinc-300": "#D4D4D8",
        "fill-zinc-400": "#9F9FA9",
        "fill-zinc-500": "#71717B",
        "fill-zinc-600": "#52525C",
        "fill-zinc-700": "#3F3F46",
        "fill-zinc-800": "#27272A",
        "fill-zinc-900": "#18181B",
        "fill-zinc-950": "#09090B",
        "fill-neutral-50": "#F9F9F9",
        "fill-neutral-100": "#F5F5F5",
        "fill-neutral-200": "#E5E5E5",
        "fill-neutral-300": "#D4D4D4",
        "fill-neutral-400": "#A1A1A1",
        "fill-neutral-500": "#737373",
        "fill-neutral-600": "#525252",
        "fill-neutral-700": "#404040",
        "fill-neutral-800": "#262626",
        "fill-neutral-900": "#111111",
        "fill-neutral-950": "#0A0A0A",
        "fill-stone-50": "#FAFAF9",
        "fill-stone-100": "#F5F5F4",
        "fill-stone-200": "#E7E5E4",
        "fill-stone-300": "#D6D3D1",
        "fill-stone-400": "#A6A09B",
        "fill-stone-500": "#79716B",
        "fill-stone-600": "#57534D",
        "fill-stone-700": "#44403B",
        "fill-stone-800": "#292524",
        "fill-stone-900": "#1C1917",
        "fill-stone-950": "#0C0A09",
        "fill-white": "#FFFFFF",
        "fill-black": "#000000"
      },
      Dark: {
        "fill-red-50": "#460809",
        "fill-red-100": "#82181A",
        "fill-red-200": "#9F0712",
        "fill-red-300": "#C10007",
        "fill-red-400": "#E7000B",
        "fill-red-500": "#FB2C36",
        "fill-red-600": "#FF6467",
        "fill-red-700": "#FFA2A2",
        "fill-red-800": "#FFC9C9",
        "fill-red-900": "#FFE2E2",
        "fill-red-950": "#FEF2F2",
        "fill-orange-50": "#441306",
        "fill-orange-100": "#7E2A0C",
        "fill-orange-200": "#9F2D00",
        "fill-orange-300": "#CA3500",
        "fill-orange-400": "#F54900",
        "fill-orange-500": "#FF6900",
        "fill-orange-600": "#FF8904",
        "fill-orange-700": "#FFB86A",
        "fill-orange-800": "#FFD6A7",
        "fill-orange-900": "#FFEDD4",
        "fill-orange-950": "#FFF7ED",
        "fill-amber-50": "#461901",
        "fill-amber-100": "#7B3306",
        "fill-amber-200": "#973C00",
        "fill-amber-300": "#BB4D00",
        "fill-amber-400": "#E17100",
        "fill-amber-500": "#FE9A00",
        "fill-amber-600": "#FFB900",
        "fill-amber-700": "#FFD230",
        "fill-amber-800": "#FEE685",
        "fill-amber-900": "#FEF3C6",
        "fill-amber-950": "#FFFBEB",
        "fill-yellow-50": "#432004",
        "fill-yellow-100": "#733E0A",
        "fill-yellow-200": "#894B00",
        "fill-yellow-300": "#A65F00",
        "fill-yellow-400": "#D08700",
        "fill-yellow-500": "#F0B100",
        "fill-yellow-600": "#FDC700",
        "fill-yellow-700": "#FFDF20",
        "fill-yellow-800": "#FFF085",
        "fill-yellow-900": "#FEF9C2",
        "fill-yellow-950": "#FEFCE8",
        "fill-lime-50": "#192E03",
        "fill-lime-100": "#35530E",
        "fill-lime-200": "#3C6300",
        "fill-lime-300": "#497D00",
        "fill-lime-400": "#5EA500",
        "fill-lime-500": "#7CCF00",
        "fill-lime-600": "#9AE600",
        "fill-lime-700": "#BBF451",
        "fill-lime-800": "#D8F999",
        "fill-lime-900": "#ECFCCA",
        "fill-lime-950": "#F7FEE7",
        "fill-green-50": "#032E15",
        "fill-green-100": "#0D542B",
        "fill-green-200": "#016630",
        "fill-green-300": "#008236",
        "fill-green-400": "#00A63E",
        "fill-green-500": "#00C950",
        "fill-green-600": "#05DF72",
        "fill-green-700": "#7BF1A8",
        "fill-green-800": "#B9F8CF",
        "fill-green-900": "#DCFCE7",
        "fill-green-950": "#F0FDF4",
        "fill-emerald-50": "#002C22",
        "fill-emerald-100": "#004F3B",
        "fill-emerald-200": "#006045",
        "fill-emerald-300": "#007A55",
        "fill-emerald-400": "#009966",
        "fill-emerald-500": "#00BC7D",
        "fill-emerald-600": "#00D492",
        "fill-emerald-700": "#5EE9B5",
        "fill-emerald-800": "#A4F4CF",
        "fill-emerald-900": "#D0FAE5",
        "fill-emerald-950": "#ECFDF5",
        "fill-teal-50": "#022F2E",
        "fill-teal-100": "#0B4F4A",
        "fill-teal-200": "#005F5A",
        "fill-teal-300": "#00786F",
        "fill-teal-400": "#009689",
        "fill-teal-500": "#00BBA7",
        "fill-teal-600": "#00D5BE",
        "fill-teal-700": "#46ECD5",
        "fill-teal-800": "#96F7E4",
        "fill-teal-900": "#CBFBF1",
        "fill-teal-950": "#F0FDFA",
        "fill-cyan-50": "#053345",
        "fill-cyan-100": "#104E64",
        "fill-cyan-200": "#005F78",
        "fill-cyan-300": "#007595",
        "fill-cyan-400": "#0092B8",
        "fill-cyan-500": "#00B8DB",
        "fill-cyan-600": "#00D3F2",
        "fill-cyan-700": "#53EAFD",
        "fill-cyan-800": "#A2F4FD",
        "fill-cyan-900": "#CEFAFE",
        "fill-cyan-950": "#ECFEFF",
        "fill-sky-50": "#052F4A",
        "fill-sky-100": "#024A70",
        "fill-sky-200": "#00598A",
        "fill-sky-300": "#0069A8",
        "fill-sky-400": "#0084D1",
        "fill-sky-500": "#00A6F4",
        "fill-sky-600": "#00BCFF",
        "fill-sky-700": "#74D4FF",
        "fill-sky-800": "#B8E6FE",
        "fill-sky-900": "#DFF2FE",
        "fill-sky-950": "#F0F9FF",
        "fill-blue-50": "#162456",
        "fill-blue-100": "#1C398E",
        "fill-blue-200": "#193CB8",
        "fill-blue-300": "#1447E6",
        "fill-blue-400": "#155DFC",
        "fill-blue-500": "#2B7FFF",
        "fill-blue-600": "#51A2FF",
        "fill-blue-700": "#8EC5FF",
        "fill-blue-800": "#BEDBFF",
        "fill-blue-900": "#DBEAFE",
        "fill-blue-950": "#EFF6FF",
        "fill-indigo-50": "#1E1A4D",
        "fill-indigo-100": "#312C85",
        "fill-indigo-200": "#372AAC",
        "fill-indigo-300": "#432DD7",
        "fill-indigo-400": "#4F39F6",
        "fill-indigo-500": "#615FFF",
        "fill-indigo-600": "#7C86FF",
        "fill-indigo-700": "#A3B3FF",
        "fill-indigo-800": "#C6D2FF",
        "fill-indigo-900": "#E0E7FF",
        "fill-indigo-950": "#EEF2FF",
        "fill-violet-50": "#2F0D68",
        "fill-violet-100": "#4D179A",
        "fill-violet-200": "#5D0EC0",
        "fill-violet-300": "#7008E7",
        "fill-violet-400": "#7F22FE",
        "fill-violet-500": "#8E51FF",
        "fill-violet-600": "#A684FF",
        "fill-violet-700": "#C4B4FF",
        "fill-violet-800": "#DDD6FF",
        "fill-violet-900": "#EDE9FE",
        "fill-violet-950": "#F5F3FF",
        "fill-purple-50": "#3C0366",
        "fill-purple-100": "#59168B",
        "fill-purple-200": "#6E11B0",
        "fill-purple-300": "#8200DB",
        "fill-purple-400": "#9810FA",
        "fill-purple-500": "#AD46FF",
        "fill-purple-600": "#C27AFF",
        "fill-purple-700": "#DAB2FF",
        "fill-purple-800": "#E9D4FF",
        "fill-purple-900": "#F3E8FF",
        "fill-purple-950": "#FAF5FF",
        "fill-fuchsia-50": "#4B004F",
        "fill-fuchsia-100": "#721378",
        "fill-fuchsia-200": "#8A0194",
        "fill-fuchsia-300": "#A800B7",
        "fill-fuchsia-400": "#C800DE",
        "fill-fuchsia-500": "#E12AFB",
        "fill-fuchsia-600": "#ED6AFF",
        "fill-fuchsia-700": "#F4A8FF",
        "fill-fuchsia-800": "#F6CFFF",
        "fill-fuchsia-900": "#FAE8FF",
        "fill-fuchsia-950": "#FDF4FF",
        "fill-pink-50": "#510424",
        "fill-pink-100": "#861043",
        "fill-pink-200": "#A3004C",
        "fill-pink-300": "#C6005C",
        "fill-pink-400": "#E60076",
        "fill-pink-500": "#F6339A",
        "fill-pink-600": "#FB64B6",
        "fill-pink-700": "#FDA5D5",
        "fill-pink-800": "#FCCEE8",
        "fill-pink-900": "#FCE7F3",
        "fill-pink-950": "#FDF2F8",
        "fill-rose-50": "#4D0218",
        "fill-rose-100": "#8B0836",
        "fill-rose-200": "#A50036",
        "fill-rose-300": "#C70036",
        "fill-rose-400": "#EC003F",
        "fill-rose-500": "#FF2056",
        "fill-rose-600": "#FF637E",
        "fill-rose-700": "#FFA1AD",
        "fill-rose-800": "#FFCCD3",
        "fill-rose-900": "#FFE4E6",
        "fill-rose-950": "#FFF1F2",
        "fill-slate-50": "#020618",
        "fill-slate-100": "#0F172B",
        "fill-slate-200": "#1D293D",
        "fill-slate-300": "#314158",
        "fill-slate-400": "#45556C",
        "fill-slate-500": "#62748E",
        "fill-slate-600": "#90A1B9",
        "fill-slate-700": "#CAD5E2",
        "fill-slate-800": "#E2E8F0",
        "fill-slate-900": "#F1F5F9",
        "fill-slate-950": "#F8FAFC",
        "fill-gray-50": "#030712",
        "fill-gray-100": "#101828",
        "fill-gray-200": "#1E2939",
        "fill-gray-300": "#364153",
        "fill-gray-400": "#4A5565",
        "fill-gray-500": "#6A7282",
        "fill-gray-600": "#99A1AF",
        "fill-gray-700": "#D1D5DC",
        "fill-gray-800": "#E5E7EB",
        "fill-gray-900": "#F3F4F6",
        "fill-gray-950": "#F9FAFB",
        "fill-zinc-50": "#09090B",
        "fill-zinc-100": "#18181B",
        "fill-zinc-200": "#27272A",
        "fill-zinc-300": "#3F3F46",
        "fill-zinc-400": "#52525C",
        "fill-zinc-500": "#71717B",
        "fill-zinc-600": "#9F9FA9",
        "fill-zinc-700": "#D4D4D8",
        "fill-zinc-800": "#E4E4E7",
        "fill-zinc-900": "#F4F4F5",
        "fill-zinc-950": "#FAFAFA",
        "fill-neutral-50": "#161616",
        "fill-neutral-100": "#111111",
        "fill-neutral-200": "#262626",
        "fill-neutral-300": "#404040",
        "fill-neutral-400": "#525252",
        "fill-neutral-500": "#737373",
        "fill-neutral-600": "#A1A1A1",
        "fill-neutral-700": "#D4D4D4",
        "fill-neutral-800": "#E5E5E5",
        "fill-neutral-900": "#F2F2F2",
        "fill-neutral-950": "#F9F9F9",
        "fill-stone-50": "#0C0A09",
        "fill-stone-100": "#1C1917",
        "fill-stone-200": "#292524",
        "fill-stone-300": "#44403B",
        "fill-stone-400": "#57534D",
        "fill-stone-500": "#79716B",
        "fill-stone-600": "#A6A09B",
        "fill-stone-700": "#D6D3D1",
        "fill-stone-800": "#E7E5E4",
        "fill-stone-900": "#F5F5F4",
        "fill-stone-950": "#FAFAF9",
        "fill-white": "#000000",
        "fill-black": "#FFFFFF"
      }
    },
    units: {
      Default: {
        "spacing-0": 0,
        "spacing-px": 1,
        "spacing-0p5": 2,
        "spacing-1": 4,
        "spacing-1p5": 6,
        "spacing-2": 8,
        "spacing-2p5": 10,
        "spacing-3": 12,
        "spacing-3p5": 14,
        "spacing-4": 16,
        "spacing-5": 20,
        "spacing-6": 24,
        "spacing-7": 28,
        "spacing-8": 32,
        "spacing-9": 36,
        "spacing-10": 40,
        "spacing-11": 44,
        "spacing-12": 48,
        "spacing-14": 56,
        "spacing-16": 64,
        "spacing-20": 80,
        "spacing-24": 96,
        "spacing-28": 112,
        "spacing-32": 128,
        "spacing-36": 144,
        "spacing-40": 160,
        "spacing-44": 176,
        "spacing-48": 192,
        "spacing-52": 208,
        "spacing-56": 224,
        "spacing-60": 240,
        "spacing-64": 256,
        "spacing-72": 288,
        "spacing-80": 320,
        "spacing-96": 384,
        "spacing-full": 999,
        "radius-none": 0,
        "radius-xs": 2,
        "radius-sm": 4,
        "radius-md": 6,
        "radius-lg": 8,
        "radius-xl": 12,
        "radius-2xl": 16,
        "radius-3xl": 24,
        "radius-4xl": 32,
        "radius-full": 999,
        "container-3xs": 256,
        "container-2xs": 288,
        "container-xs": 320,
        "container-sm": 384,
        "container-md": 448,
        "container-lg": 512,
        "container-xl": 576,
        "container-2xl": 672,
        "container-3xl": 768,
        "container-4xl": 896,
        "container-5xl": 1024,
        "container-6xl": 1152,
        "container-7xl": 1280
      }
    },
    typography: {
      Default: {
        "font-size-xs": 12,
        "font-size-sm": 14,
        "font-size-base": 16,
        "font-size-lg": 18,
        "font-size-xl": 20,
        "font-size-2xl": 24,
        "font-size-3xl": 30,
        "font-size-4xl": 36,
        "font-size-5xl": 48,
        "font-size-6xl": 60,
        "font-size-7xl": 72,
        "font-size-8xl": 96,
        "font-size-9xl": 128,
        "line-height-xs": 16,
        "line-height-sm": 20,
        "line-height-base": 24,
        "line-height-lg": 28,
        "line-height-xl": 28,
        "line-height-2xl": 32,
        "line-height-3xl": 36,
        "line-height-4xl": 40,
        "line-height-5xl": 48,
        "line-height-6xl": 60,
        "line-height-7xl": 72,
        "line-height-8xl": 96,
        "line-height-9xl": 128,
        "font-weight-thin": 100,
        "font-weight-extralight": 200,
        "font-weight-light": 300,
        "font-weight-normal": 400,
        "font-weight-medium": 500,
        "font-weight-semibold": 600,
        "font-weight-bold": 700,
        "font-weight-extrabold": 800,
        "font-weight-black": 900
      }
    },
    shadows: {
      Default: {
        "shadow-2xs-1-offset-x": 0,
        "shadow-2xs-1-offset-y": 1,
        "shadow-2xs-1-blur": 0,
        "shadow-2xs-1-spread": 0,
        "shadow-2xs-1-color": "#0000000D",
        "shadow-xs-1-offset-x": 0,
        "shadow-xs-1-offset-y": 1,
        "shadow-xs-1-blur": 2,
        "shadow-xs-1-spread": 0,
        "shadow-xs-1-color": "#0000000D",
        "shadow-sm-1-offset-x": 0,
        "shadow-sm-1-offset-y": 1,
        "shadow-sm-1-blur": 3,
        "shadow-sm-1-spread": 0,
        "shadow-sm-1-color": "#0000001A",
        "shadow-sm-2-offset-x": 0,
        "shadow-sm-2-offset-y": 1,
        "shadow-sm-2-blur": 2,
        "shadow-sm-2-spread": -1,
        "shadow-sm-2-color": "#0000001A",
        "shadow-md-1-offset-x": 0,
        "shadow-md-1-offset-y": 4,
        "shadow-md-1-blur": 6,
        "shadow-md-1-spread": -1,
        "shadow-md-1-color": "#0000001A",
        "shadow-md-2-offset-x": 0,
        "shadow-md-2-offset-y": 2,
        "shadow-md-2-blur": 4,
        "shadow-md-2-spread": -2,
        "shadow-md-2-color": "#0000001A",
        "shadow-lg-1-offset-x": 0,
        "shadow-lg-1-offset-y": 10,
        "shadow-lg-1-blur": 15,
        "shadow-lg-1-spread": -3,
        "shadow-lg-1-color": "#0000001A",
        "shadow-lg-2-offset-x": 0,
        "shadow-lg-2-offset-y": 4,
        "shadow-lg-2-blur": 6,
        "shadow-lg-2-spread": -4,
        "shadow-lg-2-color": "#0000001A",
        "shadow-xl-1-offset-x": 0,
        "shadow-xl-1-offset-y": 20,
        "shadow-xl-1-blur": 25,
        "shadow-xl-1-spread": -5,
        "shadow-xl-1-color": "#0000001A",
        "shadow-xl-2-offset-x": 0,
        "shadow-xl-2-offset-y": 8,
        "shadow-xl-2-blur": 10,
        "shadow-xl-2-spread": -6,
        "shadow-xl-2-color": "#0000001A",
        "shadow-2xl-1-offset-x": 0,
        "shadow-2xl-1-offset-y": 25,
        "shadow-2xl-1-blur": 50,
        "shadow-2xl-1-spread": -12,
        "shadow-2xl-1-color": "#00000040"
      }
    }
  };

  // unison-components/src/constants/colors.ts
  var COLORS = (() => {
    var _a, _b;
    const colors = {
      currentcolor: "currentColor",
      transparent: "transparent"
    };
    for (const [name, hex] of Object.entries(TOKENS.colors.Light)) {
      const [, hue, shade] = (_a = name.match(/^fill-([a-z]+)-(\d+)$/)) != null ? _a : [];
      if (hue) {
        const palette = (_b = colors[hue]) != null ? _b : {};
        palette[shade] = hex;
        colors[hue] = palette;
      } else {
        colors[name.replace(/^fill-/, "")] = hex;
      }
    }
    return colors;
  })();

  // unison-components/src/constants/units.ts
  var scale = (tokens, prefix) => Object.fromEntries(
    Object.entries(tokens).filter(([name]) => name.startsWith(prefix)).map(([name, value]) => [name.slice(prefix.length), value])
  );
  var UNITS = scale(TOKENS.units.Default, "spacing-");
  var UNITS_TAILWIND = Object.fromEntries(
    Object.keys(UNITS).filter((key) => /^\d+p\d+$/.test(key)).map((key) => [key, key.replace("p", ".")])
  );
  var UNITS_FIGMA = {
    /**
     * Represents a fill dimension (width or height) that should fill the available space.
     */
    fill: "fill",
    /**
     * Represents a hug dimension (width or height) that should hug the content.
     */
    hug: "hug"
  };
  var RADII = scale(TOKENS.units.Default, "radius-");
  var CONTAINERS = scale(TOKENS.units.Default, "container-");
  var SHADOWS = [
    ...new Set(Object.keys(TOKENS.shadows.Default).map((name) => name.split("-")[1]))
  ];
  var TEXT_SIZES = Object.keys(scale(TOKENS.typography.Default, "font-size-"));

  // src/utilities.ts
  var _toHex = (n) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16).toUpperCase();
    return hex.length === 1 ? "0".concat(hex) : hex;
  };
  var RGBToHEX = (rgb) => {
    const scale2 = rgb.r <= 1 && rgb.g <= 1 && rgb.b <= 1 ? 255 : 1;
    return "#".concat(_toHex(rgb.r * scale2)).concat(_toHex(rgb.g * scale2)).concat(_toHex(rgb.b * scale2));
  };
  var INDENT = " ".repeat(4);
  var META_KEYS = /* @__PURE__ */ new Set(["id", "type", "name", "children", "characters"]);
  var STRING_PROP_KEYS = {
    Vector: ["path", "viewBox", "fillRule"]
  };
  var PANEL_ORDER = [
    "autolayout-",
    "wrap",
    "width-",
    "height-",
    "alignment-",
    "gap-",
    "gap-horizontal-",
    "gap-vertical-",
    "padding-",
    "padding-horizontal-",
    "padding-vertical-",
    "padding-left-",
    "padding-top-",
    "padding-right-",
    "padding-bottom-",
    "corner-radius-",
    "corner-radius-top-left-",
    "corner-radius-top-right-",
    "corner-radius-bottom-right-",
    "corner-radius-bottom-left-",
    "border-radius-",
    "typography-",
    "typography-align-",
    "typography-decoration-",
    "fill-",
    "fill-hover-",
    "stroke-",
    "stroke-weight-",
    "stroke-style-",
    "stroke-hover-",
    "effect-"
  ];
  var _panelRank = (flag) => {
    let rank = PANEL_ORDER.length;
    let length = 0;
    for (const [i, prefix] of PANEL_ORDER.entries()) {
      if (flag.startsWith(prefix) && prefix.length > length) {
        rank = i;
        length = prefix.length;
      }
    }
    return rank;
  };
  var _byPanelOrder = (a, b) => _panelRank(a) - _panelRank(b) || a.localeCompare(b);
  var SKIP_WRAPPER_TYPES = /* @__PURE__ */ new Set(["INSTANCE", "COMPONENT", "SLOT"]);
  var _booleanPropKeys = (properties) => Object.keys(properties).filter((k) => !META_KEYS.has(k) && !k.startsWith("OVERRIDE_") && properties[k] === true);
  var _openTagPropKeys = (tag, properties) => {
    const keys = _booleanPropKeys(properties);
    if (tag !== "Frame") {
      return keys;
    }
    const t = properties.type;
    if (typeof t !== "string" || t.length === 0) {
      return keys;
    }
    const typeKey = "type-".concat(t.toLowerCase().replace(/_/g, "-"));
    const rest = keys.filter((k) => k !== typeKey);
    return [...rest];
  };
  var _formatOpenTag = (tag, properties, indentation, selfClosing) => {
    var _a;
    const flags = _openTagPropKeys(tag, properties).sort(_byPanelOrder);
    const attributes = ((_a = STRING_PROP_KEYS[tag]) != null ? _a : []).filter((k) => typeof properties[k] === "string").map((k) => "".concat(k, '="').concat(properties[k], '"'));
    const keys = [...flags, ...attributes];
    if (keys.length === 0) {
      return selfClosing ? "".concat(indentation, "<").concat(tag, " />") : "".concat(indentation, "<").concat(tag, ">");
    }
    const lines = ["".concat(indentation, "<").concat(tag)];
    for (const k of keys) {
      lines.push("".concat(indentation, "  ").concat(k));
    }
    lines.push(selfClosing ? "".concat(indentation, "/>") : "".concat(indentation, ">"));
    return lines.join("\n");
  };
  var _resolveTag = (properties) => {
    if (properties.type === "TEXT") return "Text";
    if (properties.type === "VECTOR") return "Vector";
    if (properties.type === "ELLIPSE") return "Ellipse";
    if (properties.type === "RECTANGLE") return "Rectangle";
    return "Frame";
  };
  var _renderComponentNode = (node, indentation) => {
    const { properties } = node;
    if ("EXCLUDE_FROM_OUTPUT" in properties && properties.EXCLUDE_FROM_OUTPUT === true) {
      return "";
    }
    const tag = _resolveTag(properties);
    const children = Array.isArray(properties.children) ? properties.children : [];
    const t = properties.type;
    if (typeof t === "string" && SKIP_WRAPPER_TYPES.has(t)) {
      if (children.length === 0) {
        return "";
      }
      const [first, ...rest] = children;
      const parts2 = [_renderComponentNode(first, indentation)];
      for (const child of rest) {
        parts2.push(_renderComponentNode(child, indentation));
      }
      return parts2.filter((p) => p.length > 0).join("\n");
    }
    const keys = _openTagPropKeys(tag, properties);
    if (tag === "Frame" && keys.length === 0) {
      if (children.length === 0) {
        return "";
      }
      const parts2 = [];
      for (const child of children) {
        parts2.push(_renderComponentNode(child, indentation));
      }
      return parts2.filter((p) => p.length > 0).join("\n");
    }
    const selfClosing = tag === "Ellipse" || tag === "Rectangle" || tag === "Vector";
    const open = _formatOpenTag(tag, properties, indentation, selfClosing);
    if (selfClosing) {
      return open;
    }
    if (tag === "Text") {
      return [open, "".concat(indentation).concat(INDENT).concat(properties.characters), "".concat(indentation, "</Text>")].join("\n");
    }
    const parts = [open];
    for (const child of children) {
      parts.push(_renderComponentNode(child, "".concat(indentation).concat(INDENT)));
    }
    parts.push("".concat(indentation, "</").concat(tag, ">"));
    return parts.join("\n");
  };
  var renderComponentCode = (json) => _renderComponentNode(json, "");
  var isHEX = (value) => value.startsWith("#");

  // src/maps.ts
  var isRgbHex = (value) => isHEX(value) && value.length === 7;
  var COLOR_TOKENS = /* @__PURE__ */ new Set();
  var HEX_OWNERS = /* @__PURE__ */ new Map();
  var addHexOwner = (hex, token) => {
    const owners = HEX_OWNERS.get(hex);
    if (owners) {
      owners.push(token);
      return;
    }
    HEX_OWNERS.set(hex, [token]);
  };
  for (const [name, value] of Object.entries(COLORS)) {
    if (typeof value === "string") {
      COLOR_TOKENS.add(name);
      if (isRgbHex(value)) {
        addHexOwner(value, name);
      }
      continue;
    }
    for (const [shade, hex] of Object.entries(value)) {
      COLOR_TOKENS.add("".concat(name, "-").concat(shade));
      if (isRgbHex(hex)) {
        addHexOwner(hex, "".concat(name, "-").concat(shade));
      }
    }
  }
  var UNIQUE_HEX_TO_TOKEN = {};
  for (const [hex, tokens] of HEX_OWNERS) {
    if (tokens.length === 1) {
      UNIQUE_HEX_TO_TOKEN[hex] = tokens[0];
    }
  }
  var normalizeColorName = (name) => name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/\//g, "-");
  var resolveColorToken = (variableName, hex) => {
    if (variableName) {
      const candidate = normalizeColorName(variableName);
      if (COLOR_TOKENS.has(candidate)) {
        return candidate;
      }
      const parts = candidate.split("-");
      for (let i = 1; i < parts.length; i++) {
        const suffix = parts.slice(i).join("-");
        if (COLOR_TOKENS.has(suffix)) {
          return suffix;
        }
      }
    }
    if (hex && UNIQUE_HEX_TO_TOKEN[hex]) {
      return UNIQUE_HEX_TO_TOKEN[hex];
    }
    return void 0;
  };
  var buildColorMap = (prefix) => {
    const map2 = {};
    for (const [hex, token] of Object.entries(UNIQUE_HEX_TO_TOKEN)) {
      map2[hex] = "".concat(prefix).concat(token);
    }
    return map2;
  };
  var resolveColorClass = (prefix, variableName, hex) => {
    const token = resolveColorToken(variableName, hex);
    return token ? "".concat(prefix).concat(token) : void 0;
  };
  var mapStrokeColor = buildColorMap("stroke-");
  var mapFillColor = buildColorMap("fill-");
  var UNIT_TOKENS = /* @__PURE__ */ new Set([...Object.keys(UNITS), ...Object.keys(UNITS_FIGMA)]);
  var PIXEL_TO_TOKEN = {};
  for (const [unit, pixels] of Object.entries(__spreadValues(__spreadValues({}, UNITS), UNITS_FIGMA))) {
    if (typeof pixels !== "number") {
      continue;
    }
    PIXEL_TO_TOKEN[pixels] = unit;
  }
  var normalizeUnitName = (name) => name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/(\d)\.(\d)/g, "$1p$2").replace(/\//g, "-").replace(/^05$/, "0p5").replace(/-05$/, "-0p5").replace(/(^|-)1px$/, "$1px");
  var resolveUnitToken = (variableName, pixels) => {
    if (variableName) {
      const candidate = normalizeUnitName(variableName);
      if (UNIT_TOKENS.has(candidate)) {
        return candidate;
      }
      const parts = candidate.split("-");
      for (let i = 1; i < parts.length; i++) {
        const suffix = parts.slice(i).join("-");
        if (UNIT_TOKENS.has(suffix)) {
          return suffix;
        }
      }
    }
    if (pixels !== void 0 && PIXEL_TO_TOKEN[pixels]) {
      return PIXEL_TO_TOKEN[pixels];
    }
    return void 0;
  };
  var resolveUnitClass = (prefix, variableName, pixels) => {
    const token = resolveUnitToken(variableName, pixels);
    return token ? "".concat(prefix).concat(token) : void 0;
  };
  var buildUnitMap = (prefix) => {
    const map2 = {};
    for (const [pixels, token] of Object.entries(PIXEL_TO_TOKEN)) {
      map2[Number(pixels)] = "".concat(prefix).concat(token);
    }
    return map2;
  };
  var buildSizingMap = (prefix) => {
    const map2 = {};
    for (const [unit, pixels] of Object.entries(__spreadValues(__spreadValues({}, UNITS), UNITS_FIGMA))) {
      if (typeof pixels === "number") {
        continue;
      }
      map2[unit.toUpperCase()] = "".concat(prefix).concat(unit);
    }
    return map2;
  };
  var mapAbsoluteWidth = buildUnitMap("width-");
  var mapAbsoluteHeight = buildUnitMap("height-");
  var mapWidth = buildSizingMap("width-");
  var mapHeight = buildSizingMap("height-");
  var mapGap = buildUnitMap("gap-");
  var mapPadding = buildUnitMap("padding-");
  var mapPaddingVertical = buildUnitMap("padding-vertical-");
  var mapPaddingHorizontal = buildUnitMap("padding-horizontal-");
  var mapPaddingLeft = buildUnitMap("padding-left-");
  var mapPaddingRight = buildUnitMap("padding-right-");
  var mapPaddingTop = buildUnitMap("padding-top-");
  var mapPaddingBottom = buildUnitMap("padding-bottom-");
  var RADIUS_TOKENS = new Set(Object.keys(RADII));
  var PIXEL_TO_RADIUS = {};
  for (const [name, pixels] of Object.entries(RADII)) {
    PIXEL_TO_RADIUS[pixels] = name;
  }
  var matchTokenSuffix = (candidate, tokens) => {
    if (tokens.has(candidate)) {
      return candidate;
    }
    const parts = candidate.split("-");
    for (let i = 1; i < parts.length; i++) {
      const suffix = parts.slice(i).join("-");
      if (tokens.has(suffix)) {
        return suffix;
      }
    }
    return void 0;
  };
  var normalizeStyleName = (name) => name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/\//g, "-");
  var resolveRadiusToken = (variableName, pixels) => {
    const named = variableName ? matchTokenSuffix(normalizeStyleName(variableName), RADIUS_TOKENS) : void 0;
    if (named) {
      return named;
    }
    return pixels !== void 0 ? PIXEL_TO_RADIUS[pixels] : void 0;
  };
  var resolveContainerToken = (variableName) => {
    var _a;
    const [, key] = (_a = normalizeStyleName(variableName != null ? variableName : "").match(/(?:^|-)container-(.+)$/)) != null ? _a : [];
    return key !== void 0 && key in CONTAINERS ? key : void 0;
  };
  var SHADOW_TOKENS = /* @__PURE__ */ new Set(["none", "small", "large", ...SHADOWS]);
  var resolveShadowToken = (styleName) => matchTokenSuffix(normalizeStyleName(styleName), SHADOW_TOKENS);

  // src/read/variable.ts
  var variableById = /* @__PURE__ */ new Map();
  var getVariable = (id) => {
    const existing = variableById.get(id);
    if (existing) {
      return existing;
    }
    const next = figma.variables.getVariableByIdAsync(id);
    variableById.set(id, next);
    return next;
  };

  // src/read/unit.ts
  var resolveBoundUnitClass = async (prefix, alias, pixels) => {
    const variable = (alias == null ? void 0 : alias.id) ? await getVariable(alias.id) : null;
    return resolveUnitClass(prefix, variable == null ? void 0 : variable.name, pixels);
  };
  var resolveBoundRadiusClass = async (prefix, alias, pixels) => {
    const variable = (alias == null ? void 0 : alias.id) ? await getVariable(alias.id) : null;
    const token = resolveRadiusToken(variable == null ? void 0 : variable.name, pixels);
    return token ? "".concat(prefix).concat(token) : void 0;
  };
  var resolveBoundWidthClass = async (alias, pixels) => {
    const variable = (alias == null ? void 0 : alias.id) ? await getVariable(alias.id) : null;
    const container = resolveContainerToken(variable == null ? void 0 : variable.name);
    return container ? "width-".concat(container) : resolveUnitClass("width-", variable == null ? void 0 : variable.name, pixels);
  };

  // src/read/dimensions.ts
  var readDimensions = async (node) => {
    var _a, _b;
    const properties = {};
    const errors = [];
    if (node.type !== "VECTOR") {
      const layoutSizingHorizontal = node.layoutSizingHorizontal;
      const layoutSizingVertical = node.layoutSizingVertical;
      if (node.layoutSizingHorizontal === "FIXED") {
        if ((_a = node.boundVariables) == null ? void 0 : _a.width) {
          const className = await resolveBoundWidthClass(node.boundVariables.width, node.width);
          if (className) {
            properties[className] = true;
          }
        } else {
          errors.push({
            nodeId: node.id,
            message: "Error @ ".concat(node.name, " \u2013 WIDTH value is not bound to a variable.")
          });
        }
      } else if (layoutSizingHorizontal !== "FILL" && layoutSizingHorizontal !== "HUG") {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, ' \u2013 WIDTH value must be "fill" or "hug".')
        });
      } else {
        properties[mapWidth[layoutSizingHorizontal]] = true;
      }
      if (node.layoutSizingVertical === "FIXED") {
        if ((_b = node.boundVariables) == null ? void 0 : _b.height) {
          const className = await resolveBoundUnitClass("height-", node.boundVariables.height, node.height);
          if (className) {
            properties[className] = true;
          }
        } else {
          errors.push({
            nodeId: node.id,
            message: "Error @ ".concat(node.name, " \u2013 HEIGHT value is not bound to a variable.")
          });
        }
      } else if (layoutSizingVertical !== "FILL" && layoutSizingVertical !== "HUG") {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, ' \u2013 HEIGHT value must be "fill" or "hug".')
        });
      } else {
        properties[mapHeight[layoutSizingVertical]] = true;
      }
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/color.ts
  var resolveBoundPaintColor = async (prefix, paint) => {
    var _a, _b, _c;
    const id = (_b = (_a = paint.boundVariables) == null ? void 0 : _a.color) == null ? void 0 : _b.id;
    const variable = id ? await getVariable(id) : null;
    const hex = RGBToHEX(paint.color);
    const className = resolveColorClass(prefix, variable == null ? void 0 : variable.name, hex);
    return { className, label: (_c = variable == null ? void 0 : variable.name) != null ? _c : hex };
  };

  // src/read/fill.ts
  var readFill = async (node) => {
    var _a, _b;
    const properties = {};
    const errors = [];
    const warnings = [];
    if (node.fills === figma.mixed) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 FILL mixed values are not supported.")
      });
    } else if (node.fills[0]) {
      const fill = (_a = node.fills) == null ? void 0 : _a[0];
      const type = fill.type;
      const visible = fill.visible;
      if (type !== "SOLID") {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 FILL only solid fill values are supported.")
        });
      } else {
        if (typeof ((_b = fill.boundVariables) == null ? void 0 : _b.color) === "undefined") {
          errors.push({
            nodeId: node.id,
            message: "Error @ ".concat(node.name, " \u2013 FILL value is not bound to a variable.")
          });
        } else {
          if (!visible) {
            warnings.push({
              nodeId: node.id,
              message: "Notice @ ".concat(node.name, " \u2013 FILL is hidden.")
            });
          } else {
            const { className, label } = await resolveBoundPaintColor("fill-", fill);
            if (className) {
              properties[className] = true;
            } else {
              errors.push({
                nodeId: node.id,
                message: "Error @ ".concat(node.name, ' \u2013 FILL color "').concat(label, '" is not a known color.')
              });
            }
          }
        }
      }
    }
    return { properties, errors, warnings };
  };

  // src/read/identity.ts
  var readIdentity = (node) => {
    return {
      id: node.id,
      type: node.type,
      name: node.name
    };
  };

  // src/read/stroke.ts
  var readStroke = async (node) => {
    var _a, _b, _c;
    const properties = {};
    const errors = [];
    const warnings = [];
    if (((_a = node.strokes) == null ? void 0 : _a.length) > 1) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 STROKE mixed values are not supported.")
      });
    } else if (node.strokes[0]) {
      const stroke = (_b = node.strokes) == null ? void 0 : _b[0];
      const type = stroke.type;
      const visible = stroke.visible;
      if (type !== "SOLID") {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 STROKE only solid stroke values are supported.")
        });
      } else {
        if (typeof ((_c = stroke.boundVariables) == null ? void 0 : _c.color) === "undefined") {
          errors.push({
            nodeId: node.id,
            message: "Error @ ".concat(node.name, " \u2013 STROKE value is not bound to a variable.")
          });
        } else {
          if (!visible) {
            warnings.push({
              nodeId: node.id,
              message: "Notice @ ".concat(node.name, " \u2013 STROKE is hidden.")
            });
          } else {
            const { className, label } = await resolveBoundPaintColor("stroke-", stroke);
            if (className) {
              properties[className] = true;
            } else {
              errors.push({
                nodeId: node.id,
                message: "Error @ ".concat(node.name, ' \u2013 STROKE color "').concat(label, '" is not a known color.')
              });
            }
          }
        }
      }
    }
    return { properties, errors, warnings };
  };

  // src/serialize/ellipse.ts
  var serializeEllipse = async (node) => {
    const dimensions = await readDimensions(node);
    const fill = await readFill(node);
    const stroke = await readStroke(node);
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), dimensions.properties), fill.properties), stroke.properties), {
        "corner-radius-full": true
      }),
      errors: [],
      warnings: []
    };
  };

  // src/read/alignment.ts
  var mapFrame = {
    HORIZONTAL_MIN_MIN: "alignment-top-left",
    HORIZONTAL_MIN_CENTER: "alignment-left",
    HORIZONTAL_MIN_MAX: "alignment-bottom-left",
    HORIZONTAL_MIN_BASELINE: "alignment-top-left",
    HORIZONTAL_CENTER_MIN: "alignment-top-center",
    HORIZONTAL_CENTER_CENTER: "alignment-center",
    HORIZONTAL_CENTER_MAX: "alignment-bottom-center",
    HORIZONTAL_CENTER_BASELINE: "alignment-top-center",
    HORIZONTAL_MAX_MIN: "alignment-top-right",
    HORIZONTAL_MAX_CENTER: "alignment-right",
    HORIZONTAL_MAX_MAX: "alignment-bottom-right",
    HORIZONTAL_MAX_BASELINE: "alignment-top-right",
    HORIZONTAL_SPACE_BETWEEN_MIN: "alignment-top-center",
    HORIZONTAL_SPACE_BETWEEN_CENTER: "alignment-center",
    HORIZONTAL_SPACE_BETWEEN_MAX: "alignment-bottom-center",
    HORIZONTAL_SPACE_BETWEEN_BASELINE: "alignment-top-center",
    VERTICAL_MIN_MIN: "alignment-top-left",
    VERTICAL_MIN_CENTER: "alignment-top-center",
    VERTICAL_MIN_MAX: "alignment-top-right",
    VERTICAL_MIN_BASELINE: "alignment-top-left",
    VERTICAL_CENTER_MIN: "alignment-left",
    VERTICAL_CENTER_CENTER: "alignment-center",
    VERTICAL_CENTER_MAX: "alignment-right",
    VERTICAL_CENTER_BASELINE: "alignment-left",
    VERTICAL_MAX_MIN: "alignment-bottom-left",
    VERTICAL_MAX_CENTER: "alignment-bottom-center",
    VERTICAL_MAX_MAX: "alignment-bottom-right",
    VERTICAL_MAX_BASELINE: "alignment-bottom-left",
    VERTICAL_SPACE_BETWEEN_MIN: "alignment-left",
    VERTICAL_SPACE_BETWEEN_CENTER: "alignment-center",
    VERTICAL_SPACE_BETWEEN_MAX: "alignment-right",
    VERTICAL_SPACE_BETWEEN_BASELINE: "alignment-left"
  };
  var readAlignmentFrame = (node) => {
    const properties = {};
    const errors = [];
    if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
      properties[mapFrame["".concat(node.layoutMode, "_").concat(node.primaryAxisAlignItems, "_").concat(node.counterAxisAlignItems)]] = true;
    }
    return { properties, errors, warnings: [] };
  };
  var mapText = {
    LEFT: "typography-align-left",
    CENTER: "typography-align-center",
    RIGHT: "typography-align-right"
  };
  var readAlignmentText = (node) => {
    const properties = {};
    const errors = [];
    if (node.textAlignHorizontal === "LEFT" || node.textAlignHorizontal === "CENTER" || node.textAlignHorizontal === "RIGHT") {
      properties[mapText[node.textAlignHorizontal]] = true;
    } else {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, ' \u2013 TEXT alignment must be "left", "center" or "right".')
      });
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/cornerRadius.ts
  var hasDiscreteCorners = (node) => "topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node;
  var unboundMessage = (node, label) => label ? "Error @ ".concat(node.name, " \u2013 CORNER RADIUS ").concat(label, " value is not bound to a variable.") : "Error @ ".concat(node.name, " \u2013 CORNER RADIUS value is not bound to a variable.");
  var emitCorner = async (node, prefix, value, bound, properties, errors, label) => {
    if (value > 0 && bound === void 0) {
      errors.push({
        nodeId: node.id,
        message: unboundMessage(node, label)
      });
      return;
    }
    const className = await resolveBoundRadiusClass(prefix, bound, value);
    if (className) {
      properties[className] = true;
      return;
    }
    errors.push({
      nodeId: node.id,
      message: label ? "Error @ ".concat(node.name, " \u2013 CORNER RADIUS ").concat(label, " value does not match a radius token.") : "Error @ ".concat(node.name, " \u2013 CORNER RADIUS value does not match a radius token.")
    });
  };
  var readDiscreteCorners = async (node) => {
    var _a, _b, _c, _d, _e;
    const properties = {};
    const errors = [];
    const corners = [
      {
        value: node.topLeftRadius,
        bound: (_a = node.boundVariables) == null ? void 0 : _a.topLeftRadius,
        prefix: "corner-radius-top-left-",
        label: "top left"
      },
      {
        value: node.topRightRadius,
        bound: (_b = node.boundVariables) == null ? void 0 : _b.topRightRadius,
        prefix: "corner-radius-top-right-",
        label: "top right"
      },
      {
        value: node.bottomLeftRadius,
        bound: (_c = node.boundVariables) == null ? void 0 : _c.bottomLeftRadius,
        prefix: "corner-radius-bottom-left-",
        label: "bottom left"
      },
      {
        value: node.bottomRightRadius,
        bound: (_d = node.boundVariables) == null ? void 0 : _d.bottomRightRadius,
        prefix: "corner-radius-bottom-right-",
        label: "bottom right"
      }
    ];
    const counts = /* @__PURE__ */ new Map();
    for (const corner of corners) {
      counts.set(corner.value, ((_e = counts.get(corner.value)) != null ? _e : 0) + 1);
    }
    let baseValue = corners[0].value;
    let baseCount = 0;
    for (const [value, count] of counts) {
      if (count > baseCount) {
        baseValue = value;
        baseCount = count;
      }
    }
    if (baseCount === 4) {
      if (baseValue > 0) {
        if (corners.some((corner) => corner.bound === void 0)) {
          errors.push({
            nodeId: node.id,
            message: unboundMessage(node)
          });
        } else {
          await emitCorner(node, "corner-radius-", baseValue, corners[0].bound, properties, errors);
        }
      }
      return { properties, errors, warnings: [] };
    }
    const base = corners.find((corner) => corner.value === baseValue);
    const useBase = baseCount >= 2 && baseValue > 0 && base !== void 0;
    if (useBase) {
      await emitCorner(node, "corner-radius-", baseValue, base.bound, properties, errors);
      for (const corner of corners) {
        if (corner.value === baseValue) {
          continue;
        }
        await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label);
      }
    } else {
      for (const corner of corners) {
        if (corner.value <= 0) {
          continue;
        }
        await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label);
      }
    }
    return { properties, errors, warnings: [] };
  };
  var readCornerRadius = async (node) => {
    var _a;
    if (hasDiscreteCorners(node)) {
      return readDiscreteCorners(node);
    }
    const properties = {};
    const errors = [];
    if (node.cornerRadius === figma.mixed) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 CORNER RADIUS values cannot be mixed.")
      });
    } else if (node.cornerRadius > 0) {
      await emitCorner(node, "corner-radius-", node.cornerRadius, (_a = node.boundVariables) == null ? void 0 : _a.topLeftRadius, properties, errors);
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/effect.ts
  var readEffect = async (node) => {
    var _a;
    const properties = {};
    const errors = [];
    const warnings = [];
    const visible = node.effects.filter((effect) => effect.visible);
    if (visible.length === 0) {
      return { properties, errors, warnings };
    }
    if (node.effectStyleId === "") {
      warnings.push({
        nodeId: node.id,
        message: "Notice @ ".concat(node.name, " \u2013 EFFECT is not bound to an effect style and is skipped.")
      });
      return { properties, errors, warnings };
    }
    const style = await figma.getStyleByIdAsync(node.effectStyleId);
    const token = style ? resolveShadowToken(style.name) : void 0;
    if (token === void 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, ' \u2013 EFFECT style "').concat((_a = style == null ? void 0 : style.name) != null ? _a : node.effectStyleId, '" does not match a shadow token.')
      });
    } else {
      properties["effect-shadow-".concat(token)] = true;
    }
    return { properties, errors, warnings };
  };

  // src/read/gap.ts
  var readSpacing = async (node, label, pixels, bound, errors) => {
    if (pixels === 1) return "px";
    if (bound === void 0) {
      errors.push({ nodeId: node.id, message: "Error @ ".concat(node.name, " \u2013 ").concat(label, " value is not bound to a variable.") });
      return void 0;
    }
    return resolveBoundUnitClass("", bound, pixels);
  };
  var readGap = async (node) => {
    var _a, _b;
    const properties = {};
    const errors = [];
    const items = node.itemSpacing > 0 ? await readSpacing(node, "GAP", node.itemSpacing, (_a = node.boundVariables) == null ? void 0 : _a.itemSpacing, errors) : void 0;
    const rowSpacing = node.layoutWrap === "WRAP" ? node.counterAxisSpacing : null;
    const rows = rowSpacing !== null && rowSpacing > 0 ? await readSpacing(node, "GAP vertical", rowSpacing, (_b = node.boundVariables) == null ? void 0 : _b.counterAxisSpacing, errors) : void 0;
    if (rows === void 0 || rows === items) {
      if (items !== void 0) properties["gap-".concat(items)] = true;
    } else {
      if (items !== void 0) properties["gap-horizontal-".concat(items)] = true;
      properties["gap-vertical-".concat(rows)] = true;
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/layout.ts
  var map = {
    HORIZONTAL: "autolayout-horizontal",
    VERTICAL: "autolayout-vertical"
  };
  var readLayout = (node) => {
    const properties = {};
    const errors = [];
    const flag = map[node.layoutMode];
    if (!flag) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 FRAME has no auto layout."),
        always: true
      });
    } else {
      properties[flag] = true;
      if (node.layoutMode === "HORIZONTAL" && node.layoutWrap === "WRAP") {
        properties.wrap = true;
      }
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/padding.ts
  var readPadding = async (node) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const properties = {};
    const errors = [];
    let paddingVertical = 0;
    let paddingHorizontal = 0;
    if (node.paddingLeft === node.paddingRight && node.paddingLeft > 0 && node.paddingRight > 0) {
      if (((_a = node.boundVariables) == null ? void 0 : _a.paddingLeft) === void 0 || ((_b = node.boundVariables) == null ? void 0 : _b.paddingRight) === void 0) {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 PADDING vertical value not bound to a variable.")
        });
      } else {
        paddingHorizontal = node.paddingLeft;
      }
    }
    if (node.paddingTop === node.paddingBottom && node.paddingTop > 0 && node.paddingBottom > 0) {
      if (((_c = node.boundVariables) == null ? void 0 : _c.paddingTop) === void 0 || ((_d = node.boundVariables) == null ? void 0 : _d.paddingBottom) === void 0) {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 PADDING horizontal value not bound to a variable.")
        });
      } else {
        paddingVertical = node.paddingTop;
      }
    }
    if (paddingHorizontal === 0 && node.paddingLeft > 0 && ((_e = node.boundVariables) == null ? void 0 : _e.paddingLeft) === void 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 PADDING left value is not bound to a variable.")
      });
    }
    if (paddingHorizontal === 0 && node.paddingRight > 0 && ((_f = node.boundVariables) == null ? void 0 : _f.paddingRight) === void 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 PADDING right value is not bound to a variable.")
      });
    }
    if (paddingVertical === 0 && node.paddingTop > 0 && ((_g = node.boundVariables) == null ? void 0 : _g.paddingTop) === void 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 PADDING top value is not bound to a variable.")
      });
    }
    if (paddingVertical === 0 && node.paddingBottom > 0 && ((_h = node.boundVariables) == null ? void 0 : _h.paddingBottom) === void 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 PADDING bottom value is not bound to a variable.")
      });
    }
    if (paddingHorizontal > 0 && paddingVertical > 0 && paddingHorizontal === paddingVertical) {
      const className = await resolveBoundUnitClass("padding-", (_i = node.boundVariables) == null ? void 0 : _i.paddingLeft, paddingHorizontal);
      if (className) {
        properties[className] = true;
      }
    } else {
      if (paddingHorizontal > 0) {
        const className = await resolveBoundUnitClass(
          "padding-horizontal-",
          (_j = node.boundVariables) == null ? void 0 : _j.paddingLeft,
          paddingHorizontal
        );
        if (className) {
          properties[className] = true;
        }
      } else {
        if (node.paddingLeft > 0) {
          const className = await resolveBoundUnitClass(
            "padding-left-",
            (_k = node.boundVariables) == null ? void 0 : _k.paddingLeft,
            node.paddingLeft
          );
          if (className) {
            properties[className] = true;
          }
        }
        if (node.paddingRight > 0) {
          const className = await resolveBoundUnitClass(
            "padding-right-",
            (_l = node.boundVariables) == null ? void 0 : _l.paddingRight,
            node.paddingRight
          );
          if (className) {
            properties[className] = true;
          }
        }
      }
      if (paddingVertical > 0) {
        const className = await resolveBoundUnitClass(
          "padding-vertical-",
          (_m = node.boundVariables) == null ? void 0 : _m.paddingTop,
          paddingVertical
        );
        if (className) {
          properties[className] = true;
        }
      } else {
        if (node.paddingTop > 0) {
          const className = await resolveBoundUnitClass("padding-top-", (_n = node.boundVariables) == null ? void 0 : _n.paddingTop, node.paddingTop);
          if (className) {
            properties[className] = true;
          }
        }
        if (node.paddingBottom > 0) {
          const className = await resolveBoundUnitClass(
            "padding-bottom-",
            (_o = node.boundVariables) == null ? void 0 : _o.paddingBottom,
            node.paddingBottom
          );
          if (className) {
            properties[className] = true;
          }
        }
      }
    }
    return {
      properties,
      errors,
      warnings: []
    };
  };

  // src/serialize/frame.ts
  var serializeFrame = async (node) => {
    const alignment = readAlignmentFrame(node);
    const cornerRadius = await readCornerRadius(node);
    const dimensions = await readDimensions(node);
    const effect = await readEffect(node);
    const fill = await readFill(node);
    const gap = await readGap(node);
    const layout = readLayout(node);
    const padding = await readPadding(node);
    const stroke = await readStroke(node);
    const errors = [
      ...layout.errors,
      ...dimensions.errors,
      ...alignment.errors,
      ...gap.errors,
      ...padding.errors,
      ...cornerRadius.errors,
      ...fill.errors,
      ...stroke.errors,
      ...effect.errors
    ];
    const warnings = [
      ...layout.warnings,
      ...dimensions.warnings,
      ...alignment.warnings,
      ...gap.warnings,
      ...padding.warnings,
      ...cornerRadius.warnings,
      ...fill.warnings,
      ...stroke.warnings,
      ...effect.warnings
    ];
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), alignment.properties), cornerRadius.properties), dimensions.properties), effect.properties), fill.properties), gap.properties), layout.properties), padding.properties), stroke.properties), {
        children: node.children
      }),
      errors,
      warnings
    };
  };

  // src/serialize/group.ts
  var serializeGroup = (node) => {
    return {
      properties: __spreadProps(__spreadValues({}, readIdentity(node)), {
        "autolayout-vertical": true,
        "width-fill": true,
        "height-fill": true,
        "alignment-top-left": true,
        children: node.children
      }),
      errors: [],
      warnings: [
        {
          nodeId: node.id,
          message: 'Notice @ "'.concat(node.name, '" \u2013 GROUP converted to frame.')
        }
      ]
    };
  };

  // src/serialize/rectangle.ts
  var serializeRectangle = async (node) => {
    const dimensions = await readDimensions(node);
    const fill = await readFill(node);
    const stroke = await readStroke(node);
    const cornerRadius = await readCornerRadius(node);
    return {
      properties: __spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), dimensions.properties), fill.properties), stroke.properties), cornerRadius.properties),
      errors: [],
      warnings: []
    };
  };

  // src/read/typography.ts
  var readTypography = async (node) => {
    var _a;
    const properties = {};
    const errors = [];
    if (node.textStyleId === void 0) {
      errors.push({
        nodeId: node.id,
        message: 'Error @ "'.concat(node.name, '" \u2013 TYPOGRAPHY not bound to a text style.')
      });
    } else if (node.textStyleId === figma.mixed) {
      errors.push({
        nodeId: node.id,
        message: 'Error @ "'.concat(node.name, '" \u2013 TYPOGRAPHY mixed.')
      });
    } else {
      const textStyle = await figma.getStyleByIdAsync(node.textStyleId);
      if (textStyle) {
        const size = (_a = textStyle.name.match(/^text-(.+)$/)) == null ? void 0 : _a[1];
        properties["typography-".concat(size != null ? size : textStyle.name)] = true;
      }
    }
    return { properties, errors, warnings: [] };
  };

  // src/serialize/text.ts
  var serializeText = async (node) => {
    const fill = await readFill(node);
    const alignment = readAlignmentText(node);
    const typography = await readTypography(node);
    const errors = [...typography.errors, ...alignment.errors, ...fill.errors];
    const characters = node.characters;
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), alignment.properties), fill.properties), typography.properties), {
        characters
      }),
      errors,
      warnings: [...typography.warnings, ...alignment.warnings, ...fill.warnings]
    };
  };

  // src/serialize/unknown.ts
  var serializeUnknown = async (node) => {
    const alignment = readAlignmentFrame(node);
    const cornerRadius = await readCornerRadius(node);
    const dimensions = await readDimensions(node);
    const fill = await readFill(node);
    const gap = await readGap(node);
    const layout = readLayout(node);
    const padding = await readPadding(node);
    const stroke = await readStroke(node);
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), alignment.properties), cornerRadius.properties), dimensions.properties), fill.properties), gap.properties), layout.properties), padding.properties), stroke.properties), {
        children: "children" in node ? node.children : []
      }),
      // Components, instances and other frame-like layers need auto layout too (reported by readLayout).
      errors: "layoutMode" in node ? layout.errors : [],
      warnings: [
        {
          nodeId: node.id,
          message: 'Notice @ "'.concat(node.name, '" \u2013 unknown layer type.')
        }
      ]
    };
  };

  // src/serialize/vector.ts
  var _round = (n) => String(Math.round(n * 100) / 100);
  var _roundPath = (data) => data.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => _round(Number(n)));
  var serializeVector = async (node, box = node) => {
    const fill = await readFill(node);
    const errors = [...fill.errors];
    const geometry = node.fillGeometry.length > 0 ? node.fillGeometry : node.vectorPaths;
    if (geometry.length === 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 VECTOR has no path data.")
      });
    }
    const bound = "boundVariables" in box ? box.boundVariables : void 0;
    const width = (bound == null ? void 0 : bound.width) ? await resolveBoundUnitClass("width-", bound.width, box.width) : void 0;
    const height = (bound == null ? void 0 : bound.height) ? await resolveBoundUnitClass("height-", bound.height, box.height) : void 0;
    if (!(bound == null ? void 0 : bound.width)) {
      errors.push({
        nodeId: box.id,
        message: "Error @ ".concat(box.name, " \u2013 WIDTH value is not bound to a variable.")
      });
    } else if (width === void 0) {
      errors.push({
        nodeId: box.id,
        message: "Error @ ".concat(box.name, " \u2013 WIDTH variable does not match a unit token.")
      });
    }
    if (!(bound == null ? void 0 : bound.height)) {
      errors.push({
        nodeId: box.id,
        message: "Error @ ".concat(box.name, " \u2013 HEIGHT value is not bound to a variable.")
      });
    } else if (height === void 0) {
      errors.push({
        nodeId: box.id,
        message: "Error @ ".concat(box.name, " \u2013 HEIGHT variable does not match a unit token.")
      });
    }
    const minX = box === node ? 0 : box.x - node.x;
    const minY = box === node ? 0 : box.y - node.y;
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), fill.properties), width ? { [width]: true } : {}), height ? { [height]: true } : {}), {
        path: geometry.map((g) => _roundPath(g.data)).join(" "),
        viewBox: [minX, minY, box.width, box.height].map(_round).join(" "),
        fillRule: geometry.some((g) => g.windingRule === "EVENODD") ? "evenodd" : void 0
      }),
      errors,
      warnings: fill.warnings
    };
  };

  // src/serialize/node.ts
  var shouldExcludeFromOutput = async (node, annotationCategories, getMainComponentCached) => {
    if (!node.visible) {
      return true;
    }
    if (hasExcludeFromOutputAnnotation(node.annotations, annotationCategories)) {
      return true;
    }
    if (node.type === "INSTANCE") {
      const main = await getMainComponentCached(node);
      if (main !== null && hasExcludeFromOutputAnnotation(main.annotations, annotationCategories)) {
        return true;
      }
    }
    const definitionLayer = await getMainDefinitionLayerForNode(node, getMainComponentCached);
    if (definitionLayer !== null && "annotations" in definitionLayer && hasExcludeFromOutputAnnotation(definitionLayer.annotations, annotationCategories)) {
      return true;
    }
    return false;
  };
  var collectNodesById = (root) => {
    const map2 = /* @__PURE__ */ new Map();
    const visit = (n) => {
      map2.set(n.id, n);
      if ("children" in n) {
        for (const c of n.children) {
          visit(c);
        }
      }
    };
    visit(root);
    return map2;
  };
  var isInFrame = (node) => node.parent !== null && node.parent.type !== "PAGE" && node.parent.type !== "SECTION" && node.parent.type !== "DOCUMENT";
  var asNotice = (error) => __spreadProps(__spreadValues({}, error), {
    message: error.message.replace(/^Error @/, "Notice @")
  });
  var _node = async (node) => {
    var _a, _b, _c, _d;
    switch (node.type) {
      case "FRAME":
        return serializeFrame(node);
      case "GROUP": {
        if (((_a = node.children[0]) == null ? void 0 : _a.name) === "Bounding box" && ((_b = node.children[1]) == null ? void 0 : _b.type) === "VECTOR") {
          return serializeVector(node.children[1], node);
        }
        if (node.children.length === 2 && ((_c = node.children[0]) == null ? void 0 : _c.type) === "VECTOR" && ((_d = node.children[1]) == null ? void 0 : _d.type) === "RECTANGLE") {
          return serializeVector(node.children[0], node);
        }
        return serializeGroup(node);
      }
      case "VECTOR":
        return serializeVector(node);
      case "RECTANGLE":
        return serializeRectangle(node);
      case "ELLIPSE":
        return serializeEllipse(node);
      case "TEXT":
        return await serializeText(node);
      default:
        return serializeUnknown(
          node
        );
    }
  };
  var serializeNode = async (root) => {
    const nodesById = collectNodesById(root);
    const annotationCategories = await figma.annotations.getAnnotationCategoriesAsync();
    const mainComponentByInstanceId = /* @__PURE__ */ new Map();
    const getMainComponentCached = (instance) => {
      const existing = mainComponentByInstanceId.get(instance.id);
      if (existing) {
        return existing;
      }
      const p = instance.getMainComponentAsync();
      mainComponentByInstanceId.set(instance.id, p);
      return p;
    };
    const serializeWithMap = async (node) => {
      if (await shouldExcludeFromOutput(node, annotationCategories, getMainComponentCached)) {
        return {
          properties: {
            EXCLUDE_FROM_OUTPUT: true
          },
          errors: [],
          warnings: []
        };
      }
      const r2 = await _node(node);
      if (!isInFrame(node) && r2.errors.length > 0) {
        r2.warnings = [...r2.errors.filter((error) => !error.always).map(asNotice), ...r2.warnings];
        r2.errors = r2.errors.filter((error) => error.always);
      }
      const children = "children" in node ? node.children : [];
      if (r2.properties.type !== "VECTOR" && children.length > 0 && !("OVERRIDE_TEXT_CONTENT" in r2.properties)) {
        r2.properties.children = await Promise.all(
          children.map((child) => {
            const id = child.id;
            const fullNode = id !== null ? nodesById.get(id) : null;
            const target = fullNode != null ? fullNode : child;
            return serializeWithMap(target);
          })
        );
      }
      return {
        properties: r2.properties,
        errors: r2.errors,
        warnings: r2.warnings
      };
    };
    const r = await serializeWithMap(root);
    return r;
  };

  // src/index.ts
  figma.root.setRelaunchData({ run: "Export a selected frame as React component code" });
  figma.currentPage.setRelaunchData({ run: "Export a selected frame as React component code" });
  figma.showUI(__html__, { width: 480, height: 640, title: "Frame Plugin", themeColors: true });
  var showOutput = true;
  var hint = (text, duration = 1500) => figma.ui.postMessage({ hint: { text, duration } });
  var selectionHistory = [];
  var currentSelectionId = null;
  var restoringSelection = false;
  var focusNode = async (id) => {
    const node = await figma.getNodeByIdAsync(id);
    if (node && "visible" in node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
      return true;
    }
    return false;
  };
  var recordSelection = () => {
    var _a, _b;
    const id = (_b = (_a = figma.currentPage.selection[0]) == null ? void 0 : _a.id) != null ? _b : null;
    if (restoringSelection) {
      restoringSelection = false;
      currentSelectionId = id;
      return;
    }
    if (id === currentSelectionId) return;
    if (currentSelectionId) {
      selectionHistory.push(currentSelectionId);
    }
    currentSelectionId = id;
  };
  recordSelection();
  figma.ui.onmessage = async (msg) => {
    var _a, _b;
    if (msg.type === "toggleOutput") {
      showOutput = (_a = msg.showOutput) != null ? _a : true;
      runner();
      return;
    }
    if (msg.type === "import") {
      const messages = [];
      try {
        messages.push(await importVariables(msg.tokens));
        messages.push(await createShadowStyles());
        messages.push(await createTextStyles());
        figma.notify(messages.join(" "), { timeout: 6e3 });
        hint("Imported", 3e3);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        figma.notify("".concat(messages.join(" "), " Import failed: ").concat(reason).trim(), { error: true, timeout: 1e4 });
        hint("Import failed", 3e3);
      }
      runner();
      return;
    }
    if (msg.type === "refresh") {
      await runner();
      hint("Refreshed");
      return;
    }
    if (msg.type === "back") {
      while (selectionHistory.length > 0) {
        const previousId = selectionHistory.pop();
        if (!previousId) break;
        restoringSelection = true;
        if (await focusNode(previousId)) {
          currentSelectionId = previousId;
          hint("Back to previous layer");
          return;
        }
        restoringSelection = false;
      }
      runner();
      hint("No previous layer");
      return;
    }
    const id = msg.selectNode;
    if (!id || id === "") return;
    const alreadySelected = ((_b = figma.currentPage.selection[0]) == null ? void 0 : _b.id) === id;
    await focusNode(id);
    if (alreadySelected) {
      runner();
    }
  };
  var latestRun = 0;
  var runner = async () => {
    const run = ++latestRun;
    figma.ui.postMessage({ loading: true });
    const node = figma.currentPage.selection[0];
    if (!node) {
      figma.ui.postMessage({ output: placeholder, warnings: [], errors: [] });
      return;
    }
    try {
      const warnings = [];
      const errors = [];
      const json = await serializeNode(node);
      const collectMessages = (p) => {
        if (p.warnings.length > 0) {
          warnings.push(...p.warnings);
        }
        if (p.errors.length > 0) {
          errors.push(...p.errors);
        }
        const children = "children" in p.properties ? p.properties.children : [];
        if (children) {
          for (const child of children) {
            collectMessages(child);
          }
        }
      };
      collectMessages(json);
      const output = showOutput ? renderComponentCode(json) : "";
      if (run !== latestRun) return;
      figma.ui.postMessage({ output, warnings, errors });
    } catch (error) {
      if (run !== latestRun) return;
      const reason = error instanceof Error ? error.message : String(error);
      figma.ui.postMessage({
        output: "",
        warnings: [],
        errors: [{ nodeId: node.id, message: "Error @ ".concat(node.name, " \u2013 ").concat(reason) }]
      });
    }
  };
  figma.on("selectionchange", () => {
    recordSelection();
    runner();
  });
  figma.loadAllPagesAsync().then(() => {
    figma.on("documentchange", runner);
  });
})();
