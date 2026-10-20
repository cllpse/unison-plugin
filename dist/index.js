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
    var _a3, _b;
    if (figma.editorType !== "figma") {
      return "Shadow styles need the Figma editor.";
    }
    const shadows = /* @__PURE__ */ new Map();
    for (const variable of await figma.variables.getLocalVariablesAsync()) {
      const match = variable.name.match(SHADOW_VARIABLE);
      if (!match) continue;
      const [, name, index, field] = match;
      const layers = (_a3 = shadows.get(name)) != null ? _a3 : /* @__PURE__ */ new Map();
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
      const existing = styles.find((style2) => style2.name === "shadow-".concat(name));
      const style = existing != null ? existing : figma.createEffectStyle();
      style.name = "shadow-".concat(name);
      style.effects = [...layers.entries()].sort(([a], [b]) => a - b).map(([, layer]) => buildEffect(layer));
      if (previous) figma.moveLocalEffectStyleAfter(style, previous);
      previous = style;
      if (existing) {
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
    var _a3, _b;
    if (figma.editorType !== "figma") {
      return "Text styles need the Figma editor.";
    }
    const sizes = /* @__PURE__ */ new Map();
    for (const variable of await figma.variables.getLocalVariablesAsync("FLOAT")) {
      const match = variable.name.match(TYPOGRAPHY_VARIABLE);
      if (!match) continue;
      const [, field, name] = match;
      const size = (_a3 = sizes.get(name)) != null ? _a3 : {};
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
      const existing = styles.find((style2) => style2.name === "text-".concat(name));
      const style = existing != null ? existing : figma.createTextStyle();
      style.name = "text-".concat(name);
      await figma.loadFontAsync(existing ? style.fontName : DEFAULT_FONT);
      if (!existing) {
        style.fontName = DEFAULT_FONT;
      }
      style.setBoundVariable("fontSize", fontSize);
      style.setBoundVariable("lineHeight", (_b = size["line-height"]) != null ? _b : null);
      if (previous) figma.moveLocalTextStyleAfter(style, previous);
      previous = style;
      if (existing) {
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
      scales.filter((scale) => children.every(([key, node]) => scaleOf(key) !== scale || isNumberToken(node)))
    );
    children.sort(([keyA, a], [keyB, b]) => {
      const scale = scales.indexOf(scaleOf(keyA)) - scales.indexOf(scaleOf(keyB));
      if (scale !== 0 || !numberScales.has(scaleOf(keyA))) return scale;
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
    var _a3, _b, _c, _d;
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
      throw new Error("not a design tokens file.");
    }
    const collectionsInFile = [...file].map(([name, modes]) => ({
      name,
      modes: modes instanceof Map ? [...modes.values()].filter((mode) => mode instanceof Map) : []
    }));
    if (collectionsInFile.length === 0 || collectionsInFile.some(({ modes }) => modes.length === 0)) {
      throw new Error("not a design tokens file.");
    }
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();
    let created = 0;
    let updated = 0;
    for (const { name, modes } of collectionsInFile) {
      const collection = (_a3 = collections.find((existing) => existing.name === name)) != null ? _a3 : figma.variables.createVariableCollection(name);
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
        let variable = byName.get(variableName);
        if (variable && variable.resolvedType !== type) {
          variable.remove();
          variable = void 0;
        }
        if (variable) {
          updated++;
        } else {
          variable = figma.variables.createVariable(variableName, collection, type);
          created++;
        }
        variable.scopes = (_c = (_b = token.$extensions) == null ? void 0 : _b["com.figma.scopes"]) != null ? _c : ["ALL_SCOPES"];
        for (const [i, tokens] of tokensByMode.entries()) {
          variable.setValueForMode(modeIds[i], valueOfToken((_d = tokens.get(variableName)) != null ? _d : token));
        }
      }
    }
    return "Variables: ".concat(created, " created, ").concat(updated, " updated.");
  };

  // src/serialize/annotationExclude.ts
  var EXCLUDE_MARK = "EXCLUDE_FROM_OUTPUT";
  var normalizeExcludeToken = (s) => (s != null ? s : "").trim().toUpperCase();
  var annotationMatchesExcludeFromOutput = (a, annotationCategories) => {
    if (normalizeExcludeToken(a.label) === EXCLUDE_MARK) return true;
    if (a.labelMarkdown && normalizeExcludeToken(a.labelMarkdown.replace(/<[^>]+>/g, " ")) === EXCLUDE_MARK) return true;
    if (a.categoryId === void 0) return false;
    return (annotationCategories != null ? annotationCategories : []).some(
      (c) => c.id === a.categoryId && normalizeExcludeToken(c.label) === EXCLUDE_MARK
    );
  };
  var hasExcludeFromOutputAnnotation = (annotations, annotationCategories) => (annotations != null ? annotations : []).some((a) => annotationMatchesExcludeFromOutput(a, annotationCategories));
  var findNearestInstanceAncestor = (node) => {
    let walk = node;
    while (walk) {
      if (walk.type === "INSTANCE") return walk;
      walk = walk.parent;
    }
    return null;
  };
  var getMainDefinitionLayerForNode = async (node, getMainComponent) => {
    const instance = findNearestInstanceAncestor(node);
    if (instance === null) return null;
    if (node === instance) return getMainComponent(instance);
    const path = [];
    let current = node;
    while (true) {
      const parent = current.parent;
      if (parent === null) return null;
      if (!("children" in parent)) return null;
      const siblings = parent.children;
      const index = siblings.indexOf(current);
      if (index < 0) return null;
      path.unshift(index);
      if (parent === instance) break;
      current = parent;
    }
    const main = await getMainComponent(instance);
    if (main === null) return null;
    let definition = main;
    for (const i of path) {
      if (!("children" in definition)) return null;
      const nextChildren = definition.children;
      if (i >= nextChildren.length) return null;
      definition = nextChildren[i];
    }
    return definition;
  };

  // unison-components/dist/design-tokens.ts
  var COLORS = {
    currentcolor: "currentColor",
    transparent: "transparent",
    red: {
      "50": "#FEF2F2",
      "100": "#FFE2E2",
      "200": "#FFC9C9",
      "300": "#FFA2A2",
      "400": "#FF6467",
      "500": "#FB2C36",
      "600": "#E7000B",
      "700": "#C10007",
      "800": "#9F0712",
      "900": "#82181A"
    },
    orange: {
      "50": "#FFF7ED",
      "100": "#FFEDD4",
      "200": "#FFD6A7",
      "300": "#FFB86A",
      "400": "#FF8904",
      "500": "#FF6900",
      "600": "#F54900",
      "700": "#CA3500",
      "800": "#9F2D00",
      "900": "#7E2A0C"
    },
    amber: {
      "50": "#FFFBEB",
      "100": "#FEF3C6",
      "200": "#FEE685",
      "300": "#FFD230",
      "400": "#FFB900",
      "500": "#FE9A00",
      "600": "#E17100",
      "700": "#BB4D00",
      "800": "#973C00",
      "900": "#7B3306"
    },
    yellow: {
      "50": "#FEFCE8",
      "100": "#FEF9C2",
      "200": "#FFF085",
      "300": "#FFDF20",
      "400": "#FDC700",
      "500": "#F0B100",
      "600": "#D08700",
      "700": "#A65F00",
      "800": "#894B00",
      "900": "#733E0A"
    },
    lime: {
      "50": "#F7FEE7",
      "100": "#ECFCCA",
      "200": "#D8F999",
      "300": "#BBF451",
      "400": "#9AE600",
      "500": "#7CCF00",
      "600": "#5EA500",
      "700": "#497D00",
      "800": "#3C6300",
      "900": "#35530E"
    },
    green: {
      "50": "#F0FDF4",
      "100": "#DCFCE7",
      "200": "#B9F8CF",
      "300": "#7BF1A8",
      "400": "#05DF72",
      "500": "#00C950",
      "600": "#00A63E",
      "700": "#008236",
      "800": "#016630",
      "900": "#0D542B"
    },
    emerald: {
      "50": "#ECFDF5",
      "100": "#D0FAE5",
      "200": "#A4F4CF",
      "300": "#5EE9B5",
      "400": "#00D492",
      "500": "#00BC7D",
      "600": "#009966",
      "700": "#007A55",
      "800": "#006045",
      "900": "#004F3B"
    },
    teal: {
      "50": "#F0FDFA",
      "100": "#CBFBF1",
      "200": "#96F7E4",
      "300": "#46ECD5",
      "400": "#00D5BE",
      "500": "#00BBA7",
      "600": "#009689",
      "700": "#00786F",
      "800": "#005F5A",
      "900": "#0B4F4A"
    },
    cyan: {
      "50": "#ECFEFF",
      "100": "#CEFAFE",
      "200": "#A2F4FD",
      "300": "#53EAFD",
      "400": "#00D3F2",
      "500": "#00B8DB",
      "600": "#0092B8",
      "700": "#007595",
      "800": "#005F78",
      "900": "#104E64"
    },
    sky: {
      "50": "#F0F9FF",
      "100": "#DFF2FE",
      "200": "#B8E6FE",
      "300": "#74D4FF",
      "400": "#00BCFF",
      "500": "#00A6F4",
      "600": "#0084D1",
      "700": "#0069A8",
      "800": "#00598A",
      "900": "#024A70"
    },
    blue: {
      "50": "#EFF6FF",
      "100": "#DBEAFE",
      "200": "#BEDBFF",
      "300": "#8EC5FF",
      "400": "#51A2FF",
      "500": "#2B7FFF",
      "600": "#155DFC",
      "700": "#1447E6",
      "800": "#193CB8",
      "900": "#1C398E"
    },
    indigo: {
      "50": "#EEF2FF",
      "100": "#E0E7FF",
      "200": "#C6D2FF",
      "300": "#A3B3FF",
      "400": "#7C86FF",
      "500": "#615FFF",
      "600": "#4F39F6",
      "700": "#432DD7",
      "800": "#372AAC",
      "900": "#312C85"
    },
    violet: {
      "50": "#F5F3FF",
      "100": "#EDE9FE",
      "200": "#DDD6FF",
      "300": "#C4B4FF",
      "400": "#A684FF",
      "500": "#8E51FF",
      "600": "#7F22FE",
      "700": "#7008E7",
      "800": "#5D0EC0",
      "900": "#4D179A"
    },
    purple: {
      "50": "#FAF5FF",
      "100": "#F3E8FF",
      "200": "#E9D4FF",
      "300": "#DAB2FF",
      "400": "#C27AFF",
      "500": "#AD46FF",
      "600": "#9810FA",
      "700": "#8200DB",
      "800": "#6E11B0",
      "900": "#59168B"
    },
    fuchsia: {
      "50": "#FDF4FF",
      "100": "#FAE8FF",
      "200": "#F6CFFF",
      "300": "#F4A8FF",
      "400": "#ED6AFF",
      "500": "#E12AFB",
      "600": "#C800DE",
      "700": "#A800B7",
      "800": "#8A0194",
      "900": "#721378"
    },
    pink: {
      "50": "#FDF2F8",
      "100": "#FCE7F3",
      "200": "#FCCEE8",
      "300": "#FDA5D5",
      "400": "#FB64B6",
      "500": "#F6339A",
      "600": "#E60076",
      "700": "#C6005C",
      "800": "#A3004C",
      "900": "#861043"
    },
    rose: {
      "50": "#FFF1F2",
      "100": "#FFE4E6",
      "200": "#FFCCD3",
      "300": "#FFA1AD",
      "400": "#FF637E",
      "500": "#FF2056",
      "600": "#EC003F",
      "700": "#C70036",
      "800": "#A50036",
      "900": "#8B0836"
    },
    slate: {
      "50": "#F8FAFC",
      "100": "#F1F5F9",
      "200": "#E2E8F0",
      "300": "#CAD5E2",
      "400": "#90A1B9",
      "500": "#62748E",
      "600": "#45556C",
      "700": "#314158",
      "800": "#1D293D",
      "900": "#0F172B"
    },
    gray: {
      "50": "#F9FAFB",
      "100": "#F3F4F6",
      "200": "#E5E7EB",
      "300": "#D1D5DC",
      "400": "#99A1AF",
      "500": "#6A7282",
      "600": "#4A5565",
      "700": "#364153",
      "800": "#1E2939",
      "900": "#101828"
    },
    zinc: {
      "50": "#FAFAFA",
      "100": "#F4F4F5",
      "200": "#E4E4E7",
      "300": "#D4D4D8",
      "400": "#9F9FA9",
      "500": "#71717B",
      "600": "#52525C",
      "700": "#3F3F46",
      "800": "#27272A",
      "900": "#18181B"
    },
    neutral: {
      "50": "#F9F9F9",
      "100": "#F5F5F5",
      "200": "#E5E5E5",
      "300": "#D4D4D4",
      "400": "#A1A1A1",
      "500": "#737373",
      "600": "#525252",
      "700": "#404040",
      "800": "#262626",
      "900": "#111111"
    },
    stone: {
      "50": "#FAFAF9",
      "100": "#F5F5F4",
      "200": "#E7E5E4",
      "300": "#D6D3D1",
      "400": "#A6A09B",
      "500": "#79716B",
      "600": "#57534D",
      "700": "#44403B",
      "800": "#292524",
      "900": "#1C1917"
    },
    white: "#FFFFFF",
    black: "#000000"
  };
  var SPACING = {
    "0": 0,
    px: 1,
    "0p5": 2,
    "1": 4,
    "1p5": 6,
    "2": 8,
    "2p5": 10,
    "3": 12,
    "3p5": 14,
    "4": 16,
    "5": 20,
    "6": 24,
    "7": 28,
    "8": 32,
    "9": 36,
    "10": 40,
    "11": 44,
    "12": 48,
    "14": 56,
    "16": 64,
    "20": 80,
    "24": 96,
    "28": 112,
    "32": 128,
    "36": 144,
    "40": 160,
    "44": 176,
    "48": 192,
    "52": 208,
    "56": 224,
    "60": 240,
    "64": 256,
    "72": 288,
    "80": 320,
    "96": 384,
    full: 999
  };
  var SPACING_TAILWIND = {
    "0p5": "0.5",
    "1p5": "1.5",
    "2p5": "2.5",
    "3p5": "3.5"
  };
  var RADIUS = {
    none: 0,
    xs: 2,
    sm: 4,
    md: 6,
    lg: 8,
    xl: 12,
    "2xl": 16,
    "3xl": 24,
    "4xl": 32,
    full: 999
  };
  var CONTAINERS = {
    "3xs": 256,
    "2xs": 288,
    xs: 320,
    sm: 384,
    md: 448,
    lg: 512,
    xl: 576,
    "2xl": 672,
    "3xl": 768,
    "4xl": 896,
    "5xl": 1024,
    "6xl": 1152,
    "7xl": 1280
  };
  var SHADOWS = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];
  var TEXT_SIZES = [
    "xs",
    "sm",
    "base",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl",
    "6xl",
    "7xl",
    "8xl",
    "9xl"
  ];

  // unison-components/maps/index.ts
  var SPACING_GROUPS = [
    ["padding", "p"],
    ["padding-vertical", "py"],
    ["padding-horizontal", "px"],
    ["padding-left", "pl"],
    ["padding-right", "pr"],
    ["padding-top", "pt"],
    ["padding-bottom", "pb"],
    ["gap", "gap"],
    ["gap-horizontal", "gap-x"],
    ["gap-vertical", "gap-y"]
  ];
  var RADIUS_GROUPS = [
    ["corner-radius", "rounded"],
    ["corner-radius-top-left", "rounded-tl"],
    ["corner-radius-top-right", "rounded-tr"],
    ["corner-radius-bottom-left", "rounded-bl"],
    ["corner-radius-bottom-right", "rounded-br"]
  ];
  var COLOR_GROUPS = ["fill", "fill-hover", "stroke", "stroke-hover"];
  var SIZE_MODES = ["fill", "hug"];
  var NAMED_FLAGS = {
    autolayout: ["autolayout-horizontal", "autolayout-vertical"],
    alignment: [
      "alignment-top-left",
      "alignment-top-center",
      "alignment-top-right",
      "alignment-left",
      "alignment-center",
      "alignment-right",
      "alignment-bottom-left",
      "alignment-bottom-center",
      "alignment-bottom-right"
    ],
    "effect-shadow": ["effect-shadow-none"],
    "stroke-style": ["stroke-style-dashed", "stroke-style-solid"],
    "typography-align": ["typography-align-left", "typography-align-center", "typography-align-right"],
    "typography-decoration": ["typography-decoration-underline"],
    "pointer-events": ["pointer-events-none", "pointer-events-auto"]
  };
  var table = /* @__PURE__ */ new Map();
  var add = (name, flag) => table.set(name, Object.freeze(flag));
  var _a;
  for (const [group, prefix] of SPACING_GROUPS) {
    for (const key of Object.keys(SPACING)) {
      add("".concat(group, "-").concat(key), { group, className: "".concat(prefix, "-").concat((_a = SPACING_TAILWIND[key]) != null ? _a : key) });
    }
  }
  for (const [group, prefix] of RADIUS_GROUPS) {
    for (const key of Object.keys(RADIUS)) {
      add("".concat(group, "-").concat(key), { group, className: "".concat(prefix, "-").concat(key) });
    }
  }
  for (const name of SHADOWS) add("effect-shadow-".concat(name), { group: "effect-shadow", className: "shadow-".concat(name) });
  for (const size of TEXT_SIZES) add("typography-".concat(size), { group: "typography", className: "text-".concat(size) });
  var _a2;
  for (const axis of ["width", "height"]) {
    for (const key of Object.keys(SPACING)) {
      add("".concat(axis, "-").concat(key), { group: axis, mode: "exact", unit: (_a2 = SPACING_TAILWIND[key]) != null ? _a2 : key, container: false });
    }
    for (const mode of SIZE_MODES) add("".concat(axis, "-").concat(mode), { group: "".concat(axis, "-mode"), mode });
  }
  for (const key of Object.keys(CONTAINERS))
    add("width-".concat(key), { group: "width", mode: "exact", unit: key, container: true });
  for (const [color, value] of Object.entries(COLORS)) {
    for (const group of COLOR_GROUPS) {
      if (typeof value === "string") {
        add("".concat(group, "-").concat(color), { group, name: color, color, value });
        continue;
      }
      for (const [shade, hex] of Object.entries(value)) {
        const name = "".concat(color, "-").concat(shade);
        add("".concat(group, "-").concat(name), { group, name, color, shade, value: hex });
      }
    }
  }
  for (const name of Object.values(NAMED_FLAGS).flat()) add(name, { group: "other" });
  var FLAG_PREFIXES = new Set([...table.keys()].map((name) => name.split("-")[0]));

  // src/maps.ts
  var matchToken = (name, prefix, tokens) => {
    if (name === void 0 || !name.startsWith(prefix)) return void 0;
    const token = name.slice(prefix.length);
    return tokens.has(token) ? token : void 0;
  };
  var COLOR_TOKENS = /* @__PURE__ */ new Set();
  for (const [name, value] of Object.entries(COLORS)) {
    if (typeof value === "string") {
      COLOR_TOKENS.add(name);
      continue;
    }
    for (const shade of Object.keys(value)) {
      COLOR_TOKENS.add("".concat(name, "-").concat(shade));
    }
  }
  var SPACING_TOKENS = new Set(Object.keys(SPACING));
  var RADIUS_TOKENS = new Set(Object.keys(RADIUS));
  var CONTAINER_TOKENS = new Set(Object.keys(CONTAINERS));
  var SHADOW_TOKENS = /* @__PURE__ */ new Set(["none", ...SHADOWS]);
  var TEXT_SIZE_TOKENS = new Set(TEXT_SIZES);
  var resolveColorToken = (variableName) => matchToken(variableName, "fill-", COLOR_TOKENS);
  var resolveSpacingToken = (variableName) => matchToken(variableName, "spacing-", SPACING_TOKENS);
  var resolveRadiusToken = (variableName) => matchToken(variableName, "radius-", RADIUS_TOKENS);
  var resolveContainerToken = (variableName) => matchToken(variableName, "container-", CONTAINER_TOKENS);
  var resolveShadowToken = (styleName) => matchToken(styleName, "shadow-", SHADOW_TOKENS);
  var resolveTextSizeToken = (styleName) => matchToken(styleName, "text-", TEXT_SIZE_TOKENS);
  var buildSizingMap = (prefix) => {
    const map = {};
    for (const mode of SIZE_MODES) {
      map[mode.toUpperCase()] = "".concat(prefix).concat(mode);
    }
    return map;
  };
  var WIDTH_SIZING = buildSizingMap("width-");
  var HEIGHT_SIZING = buildSizingMap("height-");

  // src/utilities.ts
  var toHex = (n) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16).toUpperCase();
    return hex.length === 1 ? "0".concat(hex) : hex;
  };
  var RGBToHEX = (rgb) => "#".concat(toHex(rgb.r * 255)).concat(toHex(rgb.g * 255)).concat(toHex(rgb.b * 255));
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
    "typography-",
    "typography-align-",
    "typography-decoration-",
    "fill-",
    "fill-hover-",
    "stroke-",
    "stroke-style-",
    "stroke-hover-",
    "effect-"
  ];
  var getPanelRank = (flag) => {
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
  var compareByPanelOrder = (a, b) => getPanelRank(a) - getPanelRank(b) || a.localeCompare(b);
  var SKIP_WRAPPER_TYPES = /* @__PURE__ */ new Set(["INSTANCE", "COMPONENT", "SLOT"]);
  var getFlagKeys = (properties) => Object.keys(properties).filter((k) => !META_KEYS.has(k) && properties[k] === true);
  var formatOpenTag = (tag, properties, indentation, selfClosing) => {
    var _a3;
    const flags = getFlagKeys(properties).sort(compareByPanelOrder);
    const attributes = ((_a3 = STRING_PROP_KEYS[tag]) != null ? _a3 : []).filter((k) => typeof properties[k] === "string").map((k) => "".concat(k, '="').concat(properties[k], '"'));
    const keys = [...flags, ...attributes];
    if (keys.length === 0) return selfClosing ? "".concat(indentation, "<").concat(tag, " />") : "".concat(indentation, "<").concat(tag, ">");
    const lines = [
      "".concat(indentation, "<").concat(tag),
      ...keys.map((k) => "".concat(indentation, "  ").concat(k)),
      selfClosing ? "".concat(indentation, "/>") : "".concat(indentation, ">")
    ];
    return lines.join("\n");
  };
  var resolveTag = (properties) => {
    if (properties.type === "TEXT") return "Text";
    if (properties.type === "VECTOR") return "Vector";
    if (properties.type === "ELLIPSE") return "Ellipse";
    if (properties.type === "RECTANGLE") return "Rectangle";
    return "Frame";
  };
  var renderChildren = (children, indentation) => children.map((child) => renderNode(child, indentation)).filter((part) => part.length > 0).join("\n");
  var renderNode = (node, indentation) => {
    var _a3;
    const { properties } = node;
    if (properties.EXCLUDE_FROM_OUTPUT === true) return "";
    const tag = resolveTag(properties);
    const children = (_a3 = properties.children) != null ? _a3 : [];
    const type = properties.type;
    if (typeof type === "string" && SKIP_WRAPPER_TYPES.has(type)) return renderChildren(children, indentation);
    if (tag === "Frame" && getFlagKeys(properties).length === 0) return renderChildren(children, indentation);
    const selfClosing = tag === "Ellipse" || tag === "Rectangle" || tag === "Vector";
    const open = formatOpenTag(tag, properties, indentation, selfClosing);
    if (selfClosing) return open;
    if (tag === "Text")
      return [open, "".concat(indentation).concat(INDENT).concat(properties.characters), "".concat(indentation, "</Text>")].join("\n");
    const parts = [
      open,
      ...children.map((child) => renderNode(child, "".concat(indentation).concat(INDENT))),
      "".concat(indentation, "</").concat(tag, ">")
    ];
    return parts.join("\n");
  };
  var renderComponentCode = (json) => renderNode(json, "");
  var MAX_NAME_LENGTH = 15;
  var truncateName = (name) => name.length > MAX_NAME_LENGTH ? "".concat(name.slice(0, MAX_NAME_LENGTH), "\u2026") : name;

  // src/read/variable.ts
  var VARIABLE_BY_ID_CACHE = /* @__PURE__ */ new Map();
  var getVariable = (id) => {
    const existing = VARIABLE_BY_ID_CACHE.get(id);
    if (existing) return existing;
    const next = figma.variables.getVariableByIdAsync(id);
    VARIABLE_BY_ID_CACHE.set(id, next);
    return next;
  };

  // src/read/unit.ts
  var getVariableName = async (alias) => {
    const variable = (alias == null ? void 0 : alias.id) ? await getVariable(alias.id) : null;
    return variable == null ? void 0 : variable.name;
  };
  var resolveBoundUnitClass = async (prefix, alias) => {
    const token = resolveSpacingToken(await getVariableName(alias));
    return token === void 0 ? void 0 : "".concat(prefix).concat(token);
  };
  var resolveBoundRadiusClass = async (prefix, alias) => {
    const token = resolveRadiusToken(await getVariableName(alias));
    return token === void 0 ? void 0 : "".concat(prefix).concat(token);
  };
  var resolveBoundWidthClass = async (alias) => {
    const name = await getVariableName(alias);
    const container = resolveContainerToken(name);
    const spacing = resolveSpacingToken(name);
    if (container !== void 0) return "width-".concat(container);
    return spacing === void 0 ? void 0 : "width-".concat(spacing);
  };

  // src/read/dimensions.ts
  var readSize = async (node, label, sizing, bound, resolveFixedClass, sizingFlags, errors) => {
    if (sizing === "FIXED" && bound) {
      const className = await resolveFixedClass(bound);
      if (className === void 0) {
        errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "".concat(label), problem: "not a token" });
      }
      return className;
    }
    if (sizing === "FIXED") {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "".concat(label), problem: "not bound" });
      return void 0;
    }
    if (sizing !== "FILL" && sizing !== "HUG") {
      errors.push({
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "".concat(label),
        problem: "must be fill or hug"
      });
      return void 0;
    }
    return sizingFlags[sizing];
  };
  var readDimensions = async (node) => {
    var _a3, _b;
    const properties = {};
    const errors = [];
    const width = await readSize(
      node,
      "WIDTH",
      node.layoutSizingHorizontal,
      (_a3 = node.boundVariables) == null ? void 0 : _a3.width,
      resolveBoundWidthClass,
      WIDTH_SIZING,
      errors
    );
    const height = await readSize(
      node,
      "HEIGHT",
      node.layoutSizingVertical,
      (_b = node.boundVariables) == null ? void 0 : _b.height,
      (bound) => resolveBoundUnitClass("height-", bound),
      HEIGHT_SIZING,
      errors
    );
    if (width) properties[width] = true;
    if (height) properties[height] = true;
    return { properties, errors, warnings: [] };
  };

  // src/read/color.ts
  var resolveBoundPaintColor = async (prefix, paint) => {
    var _a3, _b, _c;
    const id = (_b = (_a3 = paint.boundVariables) == null ? void 0 : _a3.color) == null ? void 0 : _b.id;
    const variable = id ? await getVariable(id) : null;
    const token = resolveColorToken(variable == null ? void 0 : variable.name);
    const className = token === void 0 ? void 0 : "".concat(prefix).concat(token);
    return { className, label: (_c = variable == null ? void 0 : variable.name) != null ? _c : RGBToHEX(paint.color) };
  };
  var readPaint = async (node, kind, paint) => {
    var _a3;
    const name = kind.toLowerCase();
    if (paint === void 0) return { properties: {}, errors: [], warnings: [] };
    if (paint.type !== "SOLID") {
      return {
        properties: {},
        errors: [
          {
            nodeId: node.id,
            layer: truncateName(node.name),
            property: "".concat(kind),
            problem: "unsupported (".concat(paint.type, ")")
          }
        ],
        warnings: []
      };
    }
    if (((_a3 = paint.boundVariables) == null ? void 0 : _a3.color) === void 0) {
      return {
        properties: {},
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "".concat(kind), problem: "not bound" }],
        warnings: []
      };
    }
    if (!paint.visible) {
      return {
        properties: {},
        errors: [],
        warnings: [{ nodeId: node.id, layer: truncateName(node.name), property: "".concat(kind), problem: "hidden" }]
      };
    }
    const { className, label } = await resolveBoundPaintColor("".concat(name, "-"), paint);
    if (className) return { properties: { [className]: true }, errors: [], warnings: [] };
    return {
      properties: {},
      errors: [
        { nodeId: node.id, layer: truncateName(node.name), property: "".concat(kind), problem: "not a token (".concat(label, ")") }
      ],
      warnings: []
    };
  };

  // src/read/fill.ts
  var readFill = async (node) => {
    if (node.fills === figma.mixed) {
      return {
        properties: {},
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "FILL", problem: "mixed" }],
        warnings: []
      };
    }
    return readPaint(node, "FILL", node.fills[0]);
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
    if (node.strokes.length > 1) {
      return {
        properties: {},
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "STROKE", problem: "mixed" }],
        warnings: []
      };
    }
    return readPaint(node, "STROKE", node.strokes[0]);
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
      errors: [...dimensions.errors, ...fill.errors, ...stroke.errors],
      warnings: [...dimensions.warnings, ...fill.warnings, ...stroke.warnings]
    };
  };

  // src/read/alignment.ts
  var FRAME_ALIGNMENT = {
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
      properties[FRAME_ALIGNMENT["".concat(node.layoutMode, "_").concat(node.primaryAxisAlignItems, "_").concat(node.counterAxisAlignItems)]] = true;
    }
    return { properties, errors, warnings: [] };
  };
  var TEXT_ALIGNMENT = {
    LEFT: "typography-align-left",
    CENTER: "typography-align-center",
    RIGHT: "typography-align-right"
  };
  var readAlignmentText = (node) => {
    const alignment = node.textAlignHorizontal;
    if (alignment === "LEFT" || alignment === "CENTER" || alignment === "RIGHT") {
      return { properties: { [TEXT_ALIGNMENT[alignment]]: true }, errors: [], warnings: [] };
    }
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "TEXT ALIGNMENT",
          problem: "must be left, center or right"
        }
      ],
      warnings: []
    };
  };

  // src/read/cornerRadius.ts
  var hasDiscreteCorners = (node) => "topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node;
  var getCornerError = (node, problem, label) => ({
    nodeId: node.id,
    layer: truncateName(node.name),
    property: label ? "CORNER RADIUS ".concat(label) : "CORNER RADIUS",
    problem
  });
  var emitCorner = async (node, prefix, value, bound, properties, errors, label) => {
    if (value > 0 && bound === void 0) {
      errors.push(getCornerError(node, "not bound", label));
      return;
    }
    if (value === 0 && bound === void 0) {
      properties["".concat(prefix, "none")] = true;
      return;
    }
    const className = await resolveBoundRadiusClass(prefix, bound);
    if (className) {
      properties[className] = true;
      return;
    }
    errors.push(getCornerError(node, "not a token", label));
  };
  var readDiscreteCorners = async (node) => {
    var _a3, _b, _c, _d, _e;
    const properties = {};
    const errors = [];
    const corners = [
      {
        value: node.topLeftRadius,
        bound: (_a3 = node.boundVariables) == null ? void 0 : _a3.topLeftRadius,
        prefix: "corner-radius-top-left-",
        label: "TOP LEFT"
      },
      {
        value: node.topRightRadius,
        bound: (_b = node.boundVariables) == null ? void 0 : _b.topRightRadius,
        prefix: "corner-radius-top-right-",
        label: "TOP RIGHT"
      },
      {
        value: node.bottomLeftRadius,
        bound: (_c = node.boundVariables) == null ? void 0 : _c.bottomLeftRadius,
        prefix: "corner-radius-bottom-left-",
        label: "BOTTOM LEFT"
      },
      {
        value: node.bottomRightRadius,
        bound: (_d = node.boundVariables) == null ? void 0 : _d.bottomRightRadius,
        prefix: "corner-radius-bottom-right-",
        label: "BOTTOM RIGHT"
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
    if (baseCount === 4 && baseValue <= 0) return { properties, errors, warnings: [] };
    if (baseCount === 4 && corners.some((corner) => corner.bound === void 0)) {
      errors.push(getCornerError(node, "not bound"));
      return { properties, errors, warnings: [] };
    }
    if (baseCount === 4) {
      await emitCorner(node, "corner-radius-", baseValue, corners[0].bound, properties, errors);
      return { properties, errors, warnings: [] };
    }
    const base = corners.find((corner) => corner.value === baseValue);
    const useBase = baseCount >= 2 && baseValue > 0 && base !== void 0;
    if (useBase) {
      await emitCorner(node, "corner-radius-", baseValue, base.bound, properties, errors);
      for (const corner of corners) {
        if (corner.value === baseValue) continue;
        await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label);
      }
      return { properties, errors, warnings: [] };
    }
    for (const corner of corners) {
      if (corner.value <= 0) continue;
      await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label);
    }
    return { properties, errors, warnings: [] };
  };
  var readCornerRadius = async (node) => {
    var _a3;
    if (hasDiscreteCorners(node)) return readDiscreteCorners(node);
    if (node.cornerRadius === figma.mixed) {
      return {
        properties: {},
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "CORNER RADIUS", problem: "mixed" }],
        warnings: []
      };
    }
    const properties = {};
    const errors = [];
    if (node.cornerRadius > 0) {
      await emitCorner(node, "corner-radius-", node.cornerRadius, (_a3 = node.boundVariables) == null ? void 0 : _a3.topLeftRadius, properties, errors);
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/effect.ts
  var readEffect = async (node) => {
    var _a3;
    if (!node.effects.some((effect) => effect.visible)) return { properties: {}, errors: [], warnings: [] };
    if (node.effectStyleId === "") {
      return {
        properties: {},
        errors: [],
        warnings: [
          { nodeId: node.id, layer: truncateName(node.name), property: "EFFECT", problem: "not bound, skipped" }
        ]
      };
    }
    const style = await figma.getStyleByIdAsync(node.effectStyleId);
    const token = style ? resolveShadowToken(style.name) : void 0;
    if (token === void 0) {
      return {
        properties: {},
        errors: [
          {
            nodeId: node.id,
            layer: truncateName(node.name),
            property: "EFFECT",
            problem: "not a token (".concat((_a3 = style == null ? void 0 : style.name) != null ? _a3 : node.effectStyleId, ")")
          }
        ],
        warnings: []
      };
    }
    return { properties: { ["effect-shadow-".concat(token)]: true }, errors: [], warnings: [] };
  };

  // src/read/gap.ts
  var readSpacing = async (node, label, bound, errors) => {
    if (bound === void 0) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "".concat(label), problem: "not bound" });
      return void 0;
    }
    const suffix = await resolveBoundUnitClass("", bound);
    if (suffix === void 0) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "".concat(label), problem: "not a token" });
    }
    return suffix;
  };
  var readGap = async (node) => {
    var _a3, _b;
    const properties = {};
    const errors = [];
    const items = node.itemSpacing > 0 ? await readSpacing(node, "GAP", (_a3 = node.boundVariables) == null ? void 0 : _a3.itemSpacing, errors) : void 0;
    const rowSpacing = node.layoutWrap === "WRAP" ? node.counterAxisSpacing : null;
    const rows = rowSpacing !== null && rowSpacing > 0 ? await readSpacing(node, "GAP VERTICAL", (_b = node.boundVariables) == null ? void 0 : _b.counterAxisSpacing, errors) : void 0;
    const sameSpacing = rows === void 0 || rows === items;
    if (sameSpacing && items !== void 0) properties["gap-".concat(items)] = true;
    if (!sameSpacing && items !== void 0) properties["gap-horizontal-".concat(items)] = true;
    if (!sameSpacing) properties["gap-vertical-".concat(rows)] = true;
    return { properties, errors, warnings: [] };
  };

  // src/read/layout.ts
  var LAYOUT_MODE_FLAGS = {
    HORIZONTAL: "autolayout-horizontal",
    VERTICAL: "autolayout-vertical"
  };
  var readLayout = (node) => {
    const flag = LAYOUT_MODE_FLAGS[node.layoutMode];
    if (!flag) {
      return {
        properties: {},
        errors: [
          { nodeId: node.id, layer: truncateName(node.name), property: "AUTO LAYOUT", problem: "missing", always: true }
        ],
        warnings: []
      };
    }
    const properties = { [flag]: true };
    if (node.layoutMode === "HORIZONTAL" && node.layoutWrap === "WRAP") properties.wrap = true;
    return { properties, errors: [], warnings: [] };
  };

  // src/read/padding.ts
  var readPadding = async (node) => {
    const properties = {};
    const errors = [];
    const { paddingLeft: left, paddingRight: right, paddingTop: top, paddingBottom: bottom } = node;
    const bound = node.boundVariables;
    const addClass = async (prefix, label, alias) => {
      if (alias === void 0) return;
      const className = await resolveBoundUnitClass(prefix, alias);
      if (className) {
        properties[className] = true;
        return;
      }
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "".concat(label), problem: "not a token" });
    };
    const horizontalPair = left === right && left > 0;
    const horizontalBound = (bound == null ? void 0 : bound.paddingLeft) !== void 0 && (bound == null ? void 0 : bound.paddingRight) !== void 0;
    const verticalPair = top === bottom && top > 0;
    const verticalBound = (bound == null ? void 0 : bound.paddingTop) !== void 0 && (bound == null ? void 0 : bound.paddingBottom) !== void 0;
    const paddingHorizontal = horizontalPair && horizontalBound ? left : 0;
    const paddingVertical = verticalPair && verticalBound ? top : 0;
    if (horizontalPair && !horizontalBound) {
      errors.push({
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "PADDING HORIZONTAL",
        problem: "not bound"
      });
    }
    if (verticalPair && !verticalBound) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "PADDING VERTICAL", problem: "not bound" });
    }
    if (paddingHorizontal === 0 && left > 0 && (bound == null ? void 0 : bound.paddingLeft) === void 0) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "PADDING LEFT", problem: "not bound" });
    }
    if (paddingHorizontal === 0 && right > 0 && (bound == null ? void 0 : bound.paddingRight) === void 0) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "PADDING RIGHT", problem: "not bound" });
    }
    if (paddingVertical === 0 && top > 0 && (bound == null ? void 0 : bound.paddingTop) === void 0) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "PADDING TOP", problem: "not bound" });
    }
    if (paddingVertical === 0 && bottom > 0 && (bound == null ? void 0 : bound.paddingBottom) === void 0) {
      errors.push({ nodeId: node.id, layer: truncateName(node.name), property: "PADDING BOTTOM", problem: "not bound" });
    }
    if (paddingHorizontal > 0 && paddingHorizontal === paddingVertical) {
      await addClass("padding-", "PADDING", bound == null ? void 0 : bound.paddingLeft);
      return { properties, errors, warnings: [] };
    }
    if (paddingHorizontal > 0) await addClass("padding-horizontal-", "PADDING HORIZONTAL", bound == null ? void 0 : bound.paddingLeft);
    if (paddingHorizontal === 0 && left > 0) await addClass("padding-left-", "PADDING LEFT", bound == null ? void 0 : bound.paddingLeft);
    if (paddingHorizontal === 0 && right > 0) await addClass("padding-right-", "PADDING RIGHT", bound == null ? void 0 : bound.paddingRight);
    if (paddingVertical > 0) await addClass("padding-vertical-", "PADDING VERTICAL", bound == null ? void 0 : bound.paddingTop);
    if (paddingVertical === 0 && top > 0) await addClass("padding-top-", "PADDING TOP", bound == null ? void 0 : bound.paddingTop);
    if (paddingVertical === 0 && bottom > 0) await addClass("padding-bottom-", "PADDING BOTTOM", bound == null ? void 0 : bound.paddingBottom);
    return { properties, errors, warnings: [] };
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
          layer: truncateName(node.name),
          property: "GROUP",
          problem: "converted to frame"
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
      // In the order of Figma's right panel, like the rendered flags.
      errors: [...dimensions.errors, ...cornerRadius.errors, ...fill.errors, ...stroke.errors],
      warnings: [...dimensions.warnings, ...cornerRadius.warnings, ...fill.warnings, ...stroke.warnings]
    };
  };

  // src/read/typography.ts
  var readTypography = async (node) => {
    var _a3;
    if (node.textStyleId === "") {
      return {
        properties: {},
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "TYPOGRAPHY", problem: "not bound" }],
        warnings: []
      };
    }
    if (node.textStyleId === figma.mixed) {
      return {
        properties: {},
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "TYPOGRAPHY", problem: "mixed" }],
        warnings: []
      };
    }
    const style = await figma.getStyleByIdAsync(node.textStyleId);
    const size = style ? resolveTextSizeToken(style.name) : void 0;
    if (size === void 0) {
      return {
        properties: {},
        errors: [
          {
            nodeId: node.id,
            layer: truncateName(node.name),
            property: "TYPOGRAPHY",
            problem: "not a token (".concat((_a3 = style == null ? void 0 : style.name) != null ? _a3 : node.textStyleId, ")")
          }
        ],
        warnings: []
      };
    }
    return { properties: { ["typography-".concat(size)]: true }, errors: [], warnings: [] };
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
      // Components, instances and other frame-like layers need auto layout too (reported by readLayout); other layers
      // have none to report. The rest is in the order of Figma's right panel, like the rendered flags.
      errors: [
        ..."layoutMode" in node ? layout.errors : [],
        ...dimensions.errors,
        ...alignment.errors,
        ...gap.errors,
        ...padding.errors,
        ...cornerRadius.errors,
        ...fill.errors,
        ...stroke.errors
      ],
      warnings: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "LAYER",
          problem: "unsupported (".concat(node.type, ")")
        },
        ...layout.warnings,
        ...dimensions.warnings,
        ...alignment.warnings,
        ...gap.warnings,
        ...padding.warnings,
        ...cornerRadius.warnings,
        ...fill.warnings,
        ...stroke.warnings
      ]
    };
  };

  // src/serialize/vector.ts
  var round = (n) => String(Math.round(n * 100) / 100);
  var roundPath = (data) => data.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => round(Number(n)));
  var serializeVector = async (node, box = node) => {
    const fill = await readFill(node);
    const errors = [...fill.errors];
    const geometry = node.fillGeometry.length > 0 ? node.fillGeometry : node.vectorPaths;
    if (geometry.length === 0) {
      errors.push({
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "VECTOR PATH",
        problem: "missing"
      });
    }
    const bound = "boundVariables" in box ? box.boundVariables : void 0;
    const width = (bound == null ? void 0 : bound.width) ? await resolveBoundUnitClass("width-", bound.width) : void 0;
    const height = (bound == null ? void 0 : bound.height) ? await resolveBoundUnitClass("height-", bound.height) : void 0;
    if (!(bound == null ? void 0 : bound.width)) {
      errors.push({
        nodeId: box.id,
        layer: truncateName(box.name),
        property: "WIDTH",
        problem: "not bound"
      });
    } else if (width === void 0) {
      errors.push({
        nodeId: box.id,
        layer: truncateName(box.name),
        property: "WIDTH",
        problem: "not a token"
      });
    }
    if (!(bound == null ? void 0 : bound.height)) {
      errors.push({
        nodeId: box.id,
        layer: truncateName(box.name),
        property: "HEIGHT",
        problem: "not bound"
      });
    } else if (height === void 0) {
      errors.push({
        nodeId: box.id,
        layer: truncateName(box.name),
        property: "HEIGHT",
        problem: "not a token"
      });
    }
    const minX = box === node ? 0 : box.x - node.x;
    const minY = box === node ? 0 : box.y - node.y;
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), fill.properties), width ? { [width]: true } : {}), height ? { [height]: true } : {}), {
        path: geometry.map((g) => roundPath(g.data)).join(" "),
        viewBox: [minX, minY, box.width, box.height].map(round).join(" "),
        fillRule: geometry.some((g) => g.windingRule === "EVENODD") ? "evenodd" : void 0
      }),
      errors,
      warnings: fill.warnings
    };
  };

  // src/serialize/node.ts
  var shouldExcludeFromOutput = async (node, annotationCategories, getMainComponentCached) => {
    if (!node.visible) return true;
    if (hasExcludeFromOutputAnnotation(node.annotations, annotationCategories)) return true;
    const definitionLayer = await getMainDefinitionLayerForNode(node, getMainComponentCached);
    return definitionLayer !== null && "annotations" in definitionLayer && hasExcludeFromOutputAnnotation(definitionLayer.annotations, annotationCategories);
  };
  var isInFrame = (node) => node.parent !== null && node.parent.type !== "PAGE" && node.parent.type !== "SECTION" && node.parent.type !== "DOCUMENT";
  var serializeLayer = async (node) => {
    var _a3, _b, _c, _d;
    switch (node.type) {
      case "FRAME":
        return serializeFrame(node);
      case "GROUP": {
        if (((_a3 = node.children[0]) == null ? void 0 : _a3.name) === "Bounding box" && ((_b = node.children[1]) == null ? void 0 : _b.type) === "VECTOR") {
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
        return serializeText(node);
      default:
        return serializeUnknown(
          node
        );
    }
  };
  var serializeNode = async (root) => {
    const annotationCategories = await figma.annotations.getAnnotationCategoriesAsync();
    const mainComponentByInstanceId = /* @__PURE__ */ new Map();
    const getMainComponentCached = (instance) => {
      const existing = mainComponentByInstanceId.get(instance.id);
      if (existing) return existing;
      const main = instance.getMainComponentAsync();
      mainComponentByInstanceId.set(instance.id, main);
      return main;
    };
    const serializeTree = async (node) => {
      if (await shouldExcludeFromOutput(node, annotationCategories, getMainComponentCached)) {
        return {
          properties: {
            EXCLUDE_FROM_OUTPUT: true
          },
          errors: [],
          warnings: []
        };
      }
      const r = await serializeLayer(node);
      if (!isInFrame(node) && r.errors.length > 0) {
        r.warnings = [...r.errors.filter((error) => !error.always), ...r.warnings];
        r.errors = r.errors.filter((error) => error.always);
      }
      const children = "children" in node ? node.children : [];
      if (r.properties.type !== "VECTOR" && children.length > 0) {
        r.properties.children = await Promise.all(
          children.map((child) => serializeTree(child))
        );
      }
      return r;
    };
    return serializeTree(root);
  };

  // src/index.ts
  figma.root.setRelaunchData({ run: "Generate Unison component code from a selected frame" });
  figma.currentPage.setRelaunchData({ run: "Generate Unison component code from a selected frame" });
  figma.showUI(__html__, { width: 480, height: 640, title: "Unison", themeColors: true });
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
    var _a3, _b;
    const id = (_b = (_a3 = figma.currentPage.selection[0]) == null ? void 0 : _a3.id) != null ? _b : null;
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
    var _a3, _b;
    if (msg.type === "toggleOutput") {
      showOutput = (_a3 = msg.showOutput) != null ? _a3 : true;
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
        hint("Imported design tokens", 3e3);
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
      hint("Regenerated component code");
      return;
    }
    if (msg.type === "back") {
      while (selectionHistory.length > 0) {
        const previousId = selectionHistory.pop();
        if (!previousId) break;
        restoringSelection = true;
        if (await focusNode(previousId)) {
          currentSelectionId = previousId;
          hint("Selected previous layer");
          return;
        }
        restoringSelection = false;
      }
      runner();
      hint("No previous layer");
      return;
    }
    const id = msg.selectNode;
    if (!id) return;
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
      figma.ui.postMessage({ empty: true });
      return;
    }
    try {
      const warnings = [];
      const errors = [];
      const json = await serializeNode(node);
      const collectMessages = (p) => {
        var _a3;
        warnings.push(...p.warnings);
        errors.push(...p.errors);
        for (const child of (_a3 = p.properties.children) != null ? _a3 : []) {
          collectMessages(child);
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
        errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "CODE", problem: reason }]
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
