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
    var _a3, _b, _c, _d, _e, _f;
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
      const collection = (_b = (_a3 = collections.find((existing) => existing.name === name)) != null ? _a3 : collections.find((existing) => canonicalName(existing.name) === canonicalName(name))) != null ? _b : figma.variables.createVariableCollection(name);
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

  // src/utilities.ts
  var _toHex = (n) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)));
    const hex = clamped.toString(16).toUpperCase();
    return hex.length === 1 ? "0".concat(hex) : hex;
  };
  var RGBToHEX = (rgb) => {
    const scale = rgb.r <= 1 && rgb.g <= 1 && rgb.b <= 1 ? 255 : 1;
    return "#".concat(_toHex(rgb.r * scale)).concat(_toHex(rgb.g * scale)).concat(_toHex(rgb.b * scale));
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
    var _a3;
    const flags = _openTagPropKeys(tag, properties).sort(_byPanelOrder);
    const attributes = ((_a3 = STRING_PROP_KEYS[tag]) != null ? _a3 : []).filter((k) => typeof properties[k] === "string").map((k) => "".concat(k, '="').concat(properties[k], '"'));
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
  var UNIT_TOKENS = /* @__PURE__ */ new Set([...Object.keys(SPACING), ...SIZE_MODES]);
  var PIXEL_TO_TOKEN = {};
  for (const [unit, pixels] of Object.entries(SPACING)) {
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
    for (const mode of SIZE_MODES) {
      map2[mode.toUpperCase()] = "".concat(prefix).concat(mode);
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
  var RADIUS_TOKENS = new Set(Object.keys(RADIUS));
  var PIXEL_TO_RADIUS = {};
  for (const [name, pixels] of Object.entries(RADIUS)) {
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
    var _a3;
    const [, key] = (_a3 = normalizeStyleName(variableName != null ? variableName : "").match(/(?:^|-)container-(.+)$/)) != null ? _a3 : [];
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
    var _a3, _b;
    const properties = {};
    const errors = [];
    if (node.type !== "VECTOR") {
      const layoutSizingHorizontal = node.layoutSizingHorizontal;
      const layoutSizingVertical = node.layoutSizingVertical;
      if (node.layoutSizingHorizontal === "FIXED") {
        if ((_a3 = node.boundVariables) == null ? void 0 : _a3.width) {
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
    var _a3, _b, _c;
    const id = (_b = (_a3 = paint.boundVariables) == null ? void 0 : _a3.color) == null ? void 0 : _b.id;
    const variable = id ? await getVariable(id) : null;
    const hex = RGBToHEX(paint.color);
    const className = resolveColorClass(prefix, variable == null ? void 0 : variable.name, hex);
    return { className, label: (_c = variable == null ? void 0 : variable.name) != null ? _c : hex };
  };

  // src/read/fill.ts
  var readFill = async (node) => {
    var _a3, _b;
    const properties = {};
    const errors = [];
    const warnings = [];
    if (node.fills === figma.mixed) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 FILL mixed values are not supported.")
      });
    } else if (node.fills[0]) {
      const fill = (_a3 = node.fills) == null ? void 0 : _a3[0];
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
    var _a3, _b, _c;
    const properties = {};
    const errors = [];
    const warnings = [];
    if (((_a3 = node.strokes) == null ? void 0 : _a3.length) > 1) {
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
    var _a3, _b, _c, _d, _e;
    const properties = {};
    const errors = [];
    const corners = [
      {
        value: node.topLeftRadius,
        bound: (_a3 = node.boundVariables) == null ? void 0 : _a3.topLeftRadius,
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
    var _a3;
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
      await emitCorner(node, "corner-radius-", node.cornerRadius, (_a3 = node.boundVariables) == null ? void 0 : _a3.topLeftRadius, properties, errors);
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/effect.ts
  var readEffect = async (node) => {
    var _a3;
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
        message: "Error @ ".concat(node.name, ' \u2013 EFFECT style "').concat((_a3 = style == null ? void 0 : style.name) != null ? _a3 : node.effectStyleId, '" does not match a shadow token.')
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
    var _a3, _b;
    const properties = {};
    const errors = [];
    const items = node.itemSpacing > 0 ? await readSpacing(node, "GAP", node.itemSpacing, (_a3 = node.boundVariables) == null ? void 0 : _a3.itemSpacing, errors) : void 0;
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
    var _a3, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o;
    const properties = {};
    const errors = [];
    let paddingVertical = 0;
    let paddingHorizontal = 0;
    if (node.paddingLeft === node.paddingRight && node.paddingLeft > 0 && node.paddingRight > 0) {
      if (((_a3 = node.boundVariables) == null ? void 0 : _a3.paddingLeft) === void 0 || ((_b = node.boundVariables) == null ? void 0 : _b.paddingRight) === void 0) {
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
    var _a3;
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
        const size = (_a3 = textStyle.name.match(/^text-(.+)$/)) == null ? void 0 : _a3[1];
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
