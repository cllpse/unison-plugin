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

  // unison-components/dist/tokens.json
  var tokens_default = {
    colors: {
      Light: {
        "fill-red-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9490196078431372,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#FEF2F2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8862745098039215,
              0.8862745098039215
            ],
            alpha: 1,
            hex: "#FFE2E2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.788235294117647,
              0.788235294117647
            ],
            alpha: 1,
            hex: "#FFC9C9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.6352941176470588,
              0.6352941176470588
            ],
            alpha: 1,
            hex: "#FFA2A2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.39215686274509803,
              0.403921568627451
            ],
            alpha: 1,
            hex: "#FF6467"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.984313725490196,
              0.17254901960784313,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#FB2C36"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9058823529411765,
              0,
              0.043137254901960784
            ],
            alpha: 1,
            hex: "#E7000B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7568627450980392,
              0,
              0.027450980392156862
            ],
            alpha: 1,
            hex: "#C10007"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6235294117647059,
              0.027450980392156862,
              0.07058823529411765
            ],
            alpha: 1,
            hex: "#9F0712"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5098039215686274,
              0.09411764705882353,
              0.10196078431372549
            ],
            alpha: 1,
            hex: "#82181A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27450980392156865,
              0.03137254901960784,
              0.03529411764705882
            ],
            alpha: 1,
            hex: "#460809"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9686274509803922,
              0.9294117647058824
            ],
            alpha: 1,
            hex: "#FFF7ED"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9294117647058824,
              0.8313725490196079
            ],
            alpha: 1,
            hex: "#FFEDD4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8392156862745098,
              0.6549019607843137
            ],
            alpha: 1,
            hex: "#FFD6A7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.7215686274509804,
              0.41568627450980394
            ],
            alpha: 1,
            hex: "#FFB86A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.5372549019607843,
              0.01568627450980392
            ],
            alpha: 1,
            hex: "#FF8904"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.4117647058823529,
              0
            ],
            alpha: 1,
            hex: "#FF6900"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.28627450980392155,
              0
            ],
            alpha: 1,
            hex: "#F54900"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.792156862745098,
              0.20784313725490197,
              0
            ],
            alpha: 1,
            hex: "#CA3500"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6235294117647059,
              0.17647058823529413,
              0
            ],
            alpha: 1,
            hex: "#9F2D00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.49411764705882355,
              0.16470588235294117,
              0.047058823529411764
            ],
            alpha: 1,
            hex: "#7E2A0C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.26666666666666666,
              0.07450980392156863,
              0.023529411764705882
            ],
            alpha: 1,
            hex: "#441306"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.984313725490196,
              0.9215686274509803
            ],
            alpha: 1,
            hex: "#FFFBEB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9529411764705882,
              0.7764705882352941
            ],
            alpha: 1,
            hex: "#FEF3C6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9019607843137255,
              0.5215686274509804
            ],
            alpha: 1,
            hex: "#FEE685"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8235294117647058,
              0.18823529411764706
            ],
            alpha: 1,
            hex: "#FFD230"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.7254901960784313,
              0
            ],
            alpha: 1,
            hex: "#FFB900"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.6039215686274509,
              0
            ],
            alpha: 1,
            hex: "#FE9A00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8823529411764706,
              0.44313725490196076,
              0
            ],
            alpha: 1,
            hex: "#E17100"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7333333333333333,
              0.30196078431372547,
              0
            ],
            alpha: 1,
            hex: "#BB4D00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.592156862745098,
              0.23529411764705882,
              0
            ],
            alpha: 1,
            hex: "#973C00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4823529411764706,
              0.2,
              0.023529411764705882
            ],
            alpha: 1,
            hex: "#7B3306"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27450980392156865,
              0.09803921568627451,
              0.00392156862745098
            ],
            alpha: 1,
            hex: "#461901"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9882352941176471,
              0.9098039215686274
            ],
            alpha: 1,
            hex: "#FEFCE8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9764705882352941,
              0.7607843137254902
            ],
            alpha: 1,
            hex: "#FEF9C2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9411764705882353,
              0.5215686274509804
            ],
            alpha: 1,
            hex: "#FFF085"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8745098039215686,
              0.12549019607843137
            ],
            alpha: 1,
            hex: "#FFDF20"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.7803921568627451,
              0
            ],
            alpha: 1,
            hex: "#FDC700"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.6941176470588235,
              0
            ],
            alpha: 1,
            hex: "#F0B100"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8156862745098039,
              0.5294117647058824,
              0
            ],
            alpha: 1,
            hex: "#D08700"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6509803921568628,
              0.37254901960784315,
              0
            ],
            alpha: 1,
            hex: "#A65F00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5372549019607843,
              0.29411764705882354,
              0
            ],
            alpha: 1,
            hex: "#894B00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.45098039215686275,
              0.24313725490196078,
              0.0392156862745098
            ],
            alpha: 1,
            hex: "#733E0A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.2627450980392157,
              0.12549019607843137,
              0.01568627450980392
            ],
            alpha: 1,
            hex: "#432004"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9686274509803922,
              0.996078431372549,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#F7FEE7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0.9882352941176471,
              0.792156862745098
            ],
            alpha: 1,
            hex: "#ECFCCA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8470588235294118,
              0.9764705882352941,
              0.6
            ],
            alpha: 1,
            hex: "#D8F999"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7333333333333333,
              0.9568627450980393,
              0.3176470588235294
            ],
            alpha: 1,
            hex: "#BBF451"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6039215686274509,
              0.9019607843137255,
              0
            ],
            alpha: 1,
            hex: "#9AE600"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.48627450980392156,
              0.8117647058823529,
              0
            ],
            alpha: 1,
            hex: "#7CCF00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3686274509803922,
              0.6470588235294118,
              0
            ],
            alpha: 1,
            hex: "#5EA500"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.28627450980392155,
              0.49019607843137253,
              0
            ],
            alpha: 1,
            hex: "#497D00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.23529411764705882,
              0.38823529411764707,
              0
            ],
            alpha: 1,
            hex: "#3C6300"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.20784313725490197,
              0.3254901960784314,
              0.054901960784313725
            ],
            alpha: 1,
            hex: "#35530E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.09803921568627451,
              0.1803921568627451,
              0.011764705882352941
            ],
            alpha: 1,
            hex: "#192E03"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.9921568627450981,
              0.9568627450980393
            ],
            alpha: 1,
            hex: "#F0FDF4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8627450980392157,
              0.9882352941176471,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#DCFCE7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7254901960784313,
              0.9725490196078431,
              0.8117647058823529
            ],
            alpha: 1,
            hex: "#B9F8CF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4823529411764706,
              0.9450980392156862,
              0.6588235294117647
            ],
            alpha: 1,
            hex: "#7BF1A8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0196078431372549,
              0.8745098039215686,
              0.4470588235294118
            ],
            alpha: 1,
            hex: "#05DF72"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.788235294117647,
              0.3137254901960784
            ],
            alpha: 1,
            hex: "#00C950"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.6509803921568628,
              0.24313725490196078
            ],
            alpha: 1,
            hex: "#00A63E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5098039215686274,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#008236"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00392156862745098,
              0.4,
              0.18823529411764706
            ],
            alpha: 1,
            hex: "#016630"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.050980392156862744,
              0.32941176470588235,
              0.16862745098039217
            ],
            alpha: 1,
            hex: "#0D542B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.011764705882352941,
              0.1803921568627451,
              0.08235294117647059
            ],
            alpha: 1,
            hex: "#032E15"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0.9921568627450981,
              0.9607843137254902
            ],
            alpha: 1,
            hex: "#ECFDF5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8156862745098039,
              0.9803921568627451,
              0.8980392156862745
            ],
            alpha: 1,
            hex: "#D0FAE5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6431372549019608,
              0.9568627450980393,
              0.8117647058823529
            ],
            alpha: 1,
            hex: "#A4F4CF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3686274509803922,
              0.9137254901960784,
              0.7098039215686275
            ],
            alpha: 1,
            hex: "#5EE9B5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.8313725490196079,
              0.5725490196078431
            ],
            alpha: 1,
            hex: "#00D492"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7372549019607844,
              0.49019607843137253
            ],
            alpha: 1,
            hex: "#00BC7D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.6,
              0.4
            ],
            alpha: 1,
            hex: "#009966"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.47843137254901963,
              0.3333333333333333
            ],
            alpha: 1,
            hex: "#007A55"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.3764705882352941,
              0.27058823529411763
            ],
            alpha: 1,
            hex: "#006045"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.30980392156862746,
              0.23137254901960785
            ],
            alpha: 1,
            hex: "#004F3B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.17254901960784313,
              0.13333333333333333
            ],
            alpha: 1,
            hex: "#002C22"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.9921568627450981,
              0.9803921568627451
            ],
            alpha: 1,
            hex: "#F0FDFA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.796078431372549,
              0.984313725490196,
              0.9450980392156862
            ],
            alpha: 1,
            hex: "#CBFBF1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5882352941176471,
              0.9686274509803922,
              0.8941176470588236
            ],
            alpha: 1,
            hex: "#96F7E4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27450980392156865,
              0.9254901960784314,
              0.8352941176470589
            ],
            alpha: 1,
            hex: "#46ECD5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.8352941176470589,
              0.7450980392156863
            ],
            alpha: 1,
            hex: "#00D5BE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7333333333333333,
              0.6549019607843137
            ],
            alpha: 1,
            hex: "#00BBA7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5882352941176471,
              0.5372549019607843
            ],
            alpha: 1,
            hex: "#009689"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.47058823529411764,
              0.43529411764705883
            ],
            alpha: 1,
            hex: "#00786F"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.37254901960784315,
              0.35294117647058826
            ],
            alpha: 1,
            hex: "#005F5A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.043137254901960784,
              0.30980392156862746,
              0.2901960784313726
            ],
            alpha: 1,
            hex: "#0B4F4A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00784313725490196,
              0.1843137254901961,
              0.1803921568627451
            ],
            alpha: 1,
            hex: "#022F2E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0.996078431372549,
              1
            ],
            alpha: 1,
            hex: "#ECFEFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.807843137254902,
              0.9803921568627451,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#CEFAFE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6352941176470588,
              0.9568627450980393,
              0.9921568627450981
            ],
            alpha: 1,
            hex: "#A2F4FD"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3254901960784314,
              0.9176470588235294,
              0.9921568627450981
            ],
            alpha: 1,
            hex: "#53EAFD"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.8274509803921568,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#00D3F2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7215686274509804,
              0.8588235294117647
            ],
            alpha: 1,
            hex: "#00B8DB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5725490196078431,
              0.7215686274509804
            ],
            alpha: 1,
            hex: "#0092B8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.4588235294117647,
              0.5843137254901961
            ],
            alpha: 1,
            hex: "#007595"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.37254901960784315,
              0.47058823529411764
            ],
            alpha: 1,
            hex: "#005F78"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.06274509803921569,
              0.3058823529411765,
              0.39215686274509803
            ],
            alpha: 1,
            hex: "#104E64"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0196078431372549,
              0.2,
              0.27058823529411763
            ],
            alpha: 1,
            hex: "#053345"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.9764705882352941,
              1
            ],
            alpha: 1,
            hex: "#F0F9FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8745098039215686,
              0.9490196078431372,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#DFF2FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7215686274509804,
              0.9019607843137255,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#B8E6FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4549019607843137,
              0.8313725490196079,
              1
            ],
            alpha: 1,
            hex: "#74D4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7372549019607844,
              1
            ],
            alpha: 1,
            hex: "#00BCFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.6509803921568628,
              0.9568627450980393
            ],
            alpha: 1,
            hex: "#00A6F4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5176470588235295,
              0.8196078431372549
            ],
            alpha: 1,
            hex: "#0084D1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.4117647058823529,
              0.6588235294117647
            ],
            alpha: 1,
            hex: "#0069A8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.34901960784313724,
              0.5411764705882353
            ],
            alpha: 1,
            hex: "#00598A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00784313725490196,
              0.2901960784313726,
              0.4392156862745098
            ],
            alpha: 1,
            hex: "#024A70"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0196078431372549,
              0.1843137254901961,
              0.2901960784313726
            ],
            alpha: 1,
            hex: "#052F4A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9372549019607843,
              0.9647058823529412,
              1
            ],
            alpha: 1,
            hex: "#EFF6FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8588235294117647,
              0.9176470588235294,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#DBEAFE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7450980392156863,
              0.8588235294117647,
              1
            ],
            alpha: 1,
            hex: "#BEDBFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5568627450980392,
              0.7725490196078432,
              1
            ],
            alpha: 1,
            hex: "#8EC5FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3176470588235294,
              0.6352941176470588,
              1
            ],
            alpha: 1,
            hex: "#51A2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.16862745098039217,
              0.4980392156862745,
              1
            ],
            alpha: 1,
            hex: "#2B7FFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.08235294117647059,
              0.36470588235294116,
              0.9882352941176471
            ],
            alpha: 1,
            hex: "#155DFC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0784313725490196,
              0.2784313725490196,
              0.9019607843137255
            ],
            alpha: 1,
            hex: "#1447E6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.09803921568627451,
              0.23529411764705882,
              0.7215686274509804
            ],
            alpha: 1,
            hex: "#193CB8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.10980392156862745,
              0.2235294117647059,
              0.5568627450980392
            ],
            alpha: 1,
            hex: "#1C398E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.08627450980392157,
              0.1411764705882353,
              0.33725490196078434
            ],
            alpha: 1,
            hex: "#162456"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9333333333333333,
              0.9490196078431372,
              1
            ],
            alpha: 1,
            hex: "#EEF2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8784313725490196,
              0.9058823529411765,
              1
            ],
            alpha: 1,
            hex: "#E0E7FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7764705882352941,
              0.8235294117647058,
              1
            ],
            alpha: 1,
            hex: "#C6D2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6392156862745098,
              0.7019607843137254,
              1
            ],
            alpha: 1,
            hex: "#A3B3FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.48627450980392156,
              0.5254901960784314,
              1
            ],
            alpha: 1,
            hex: "#7C86FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3803921568627451,
              0.37254901960784315,
              1
            ],
            alpha: 1,
            hex: "#615FFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.30980392156862746,
              0.2235294117647059,
              0.9647058823529412
            ],
            alpha: 1,
            hex: "#4F39F6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.2627450980392157,
              0.17647058823529413,
              0.8431372549019608
            ],
            alpha: 1,
            hex: "#432DD7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.21568627450980393,
              0.16470588235294117,
              0.6745098039215687
            ],
            alpha: 1,
            hex: "#372AAC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.19215686274509805,
              0.17254901960784313,
              0.5215686274509804
            ],
            alpha: 1,
            hex: "#312C85"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.11764705882352941,
              0.10196078431372549,
              0.30196078431372547
            ],
            alpha: 1,
            hex: "#1E1A4D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.9529411764705882,
              1
            ],
            alpha: 1,
            hex: "#F5F3FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9294117647058824,
              0.9137254901960784,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#EDE9FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8666666666666667,
              0.8392156862745098,
              1
            ],
            alpha: 1,
            hex: "#DDD6FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7686274509803922,
              0.7058823529411765,
              1
            ],
            alpha: 1,
            hex: "#C4B4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6509803921568628,
              0.5176470588235295,
              1
            ],
            alpha: 1,
            hex: "#A684FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5568627450980392,
              0.3176470588235294,
              1
            ],
            alpha: 1,
            hex: "#8E51FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4980392156862745,
              0.13333333333333333,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#7F22FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4392156862745098,
              0.03137254901960784,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#7008E7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.36470588235294116,
              0.054901960784313725,
              0.7529411764705882
            ],
            alpha: 1,
            hex: "#5D0EC0"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.30196078431372547,
              0.09019607843137255,
              0.6039215686274509
            ],
            alpha: 1,
            hex: "#4D179A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.1843137254901961,
              0.050980392156862744,
              0.40784313725490196
            ],
            alpha: 1,
            hex: "#2F0D68"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9607843137254902,
              1
            ],
            alpha: 1,
            hex: "#FAF5FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9529411764705882,
              0.9098039215686274,
              1
            ],
            alpha: 1,
            hex: "#F3E8FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9137254901960784,
              0.8313725490196079,
              1
            ],
            alpha: 1,
            hex: "#E9D4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8549019607843137,
              0.6980392156862745,
              1
            ],
            alpha: 1,
            hex: "#DAB2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7607843137254902,
              0.47843137254901963,
              1
            ],
            alpha: 1,
            hex: "#C27AFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6784313725490196,
              0.27450980392156865,
              1
            ],
            alpha: 1,
            hex: "#AD46FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.596078431372549,
              0.06274509803921569,
              0.9803921568627451
            ],
            alpha: 1,
            hex: "#9810FA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5098039215686274,
              0,
              0.8588235294117647
            ],
            alpha: 1,
            hex: "#8200DB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.43137254901960786,
              0.06666666666666667,
              0.6901960784313725
            ],
            alpha: 1,
            hex: "#6E11B0"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.34901960784313724,
              0.08627450980392157,
              0.5450980392156862
            ],
            alpha: 1,
            hex: "#59168B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.23529411764705882,
              0.011764705882352941,
              0.4
            ],
            alpha: 1,
            hex: "#3C0366"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.9568627450980393,
              1
            ],
            alpha: 1,
            hex: "#FDF4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9098039215686274,
              1
            ],
            alpha: 1,
            hex: "#FAE8FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9647058823529412,
              0.8117647058823529,
              1
            ],
            alpha: 1,
            hex: "#F6CFFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9568627450980393,
              0.6588235294117647,
              1
            ],
            alpha: 1,
            hex: "#F4A8FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9294117647058824,
              0.41568627450980394,
              1
            ],
            alpha: 1,
            hex: "#ED6AFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8823529411764706,
              0.16470588235294117,
              0.984313725490196
            ],
            alpha: 1,
            hex: "#E12AFB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7843137254901961,
              0,
              0.8705882352941177
            ],
            alpha: 1,
            hex: "#C800DE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6588235294117647,
              0,
              0.7176470588235294
            ],
            alpha: 1,
            hex: "#A800B7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5411764705882353,
              0.00392156862745098,
              0.5803921568627451
            ],
            alpha: 1,
            hex: "#8A0194"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4470588235294118,
              0.07450980392156863,
              0.47058823529411764
            ],
            alpha: 1,
            hex: "#721378"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.29411764705882354,
              0,
              0.30980392156862746
            ],
            alpha: 1,
            hex: "#4B004F"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.9490196078431372,
              0.9725490196078431
            ],
            alpha: 1,
            hex: "#FDF2F8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9882352941176471,
              0.9058823529411765,
              0.9529411764705882
            ],
            alpha: 1,
            hex: "#FCE7F3"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9882352941176471,
              0.807843137254902,
              0.9098039215686274
            ],
            alpha: 1,
            hex: "#FCCEE8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.6470588235294118,
              0.8352941176470589
            ],
            alpha: 1,
            hex: "#FDA5D5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.984313725490196,
              0.39215686274509803,
              0.7137254901960784
            ],
            alpha: 1,
            hex: "#FB64B6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9647058823529412,
              0.2,
              0.6039215686274509
            ],
            alpha: 1,
            hex: "#F6339A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9019607843137255,
              0,
              0.4627450980392157
            ],
            alpha: 1,
            hex: "#E60076"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7764705882352941,
              0,
              0.3607843137254902
            ],
            alpha: 1,
            hex: "#C6005C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6392156862745098,
              0,
              0.2980392156862745
            ],
            alpha: 1,
            hex: "#A3004C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5254901960784314,
              0.06274509803921569,
              0.2627450980392157
            ],
            alpha: 1,
            hex: "#861043"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3176470588235294,
              0.01568627450980392,
              0.1411764705882353
            ],
            alpha: 1,
            hex: "#510424"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9450980392156862,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#FFF1F2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8941176470588236,
              0.9019607843137255
            ],
            alpha: 1,
            hex: "#FFE4E6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8,
              0.8274509803921568
            ],
            alpha: 1,
            hex: "#FFCCD3"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.6313725490196078,
              0.6784313725490196
            ],
            alpha: 1,
            hex: "#FFA1AD"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.38823529411764707,
              0.49411764705882355
            ],
            alpha: 1,
            hex: "#FF637E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.12549019607843137,
              0.33725490196078434
            ],
            alpha: 1,
            hex: "#FF2056"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0,
              0.24705882352941178
            ],
            alpha: 1,
            hex: "#EC003F"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7803921568627451,
              0,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#C70036"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6470588235294118,
              0,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#A50036"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5450980392156862,
              0.03137254901960784,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#8B0836"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.30196078431372547,
              0.00784313725490196,
              0.09411764705882353
            ],
            alpha: 1,
            hex: "#4D0218"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9725490196078431,
              0.9803921568627451,
              0.9882352941176471
            ],
            alpha: 1,
            hex: "#F8FAFC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9450980392156862,
              0.9607843137254902,
              0.9764705882352941
            ],
            alpha: 1,
            hex: "#F1F5F9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8862745098039215,
              0.9098039215686274,
              0.9411764705882353
            ],
            alpha: 1,
            hex: "#E2E8F0"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.792156862745098,
              0.8352941176470589,
              0.8862745098039215
            ],
            alpha: 1,
            hex: "#CAD5E2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5647058823529412,
              0.6313725490196078,
              0.7254901960784313
            ],
            alpha: 1,
            hex: "#90A1B9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3843137254901961,
              0.4549019607843137,
              0.5568627450980392
            ],
            alpha: 1,
            hex: "#62748E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27058823529411763,
              0.3333333333333333,
              0.4235294117647059
            ],
            alpha: 1,
            hex: "#45556C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.19215686274509805,
              0.2549019607843137,
              0.34509803921568627
            ],
            alpha: 1,
            hex: "#314158"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.11372549019607843,
              0.1607843137254902,
              0.23921568627450981
            ],
            alpha: 1,
            hex: "#1D293D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.058823529411764705,
              0.09019607843137255,
              0.16862745098039217
            ],
            alpha: 1,
            hex: "#0F172B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00784313725490196,
              0.023529411764705882,
              0.09411764705882353
            ],
            alpha: 1,
            hex: "#020618"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9764705882352941,
              0.9803921568627451,
              0.984313725490196
            ],
            alpha: 1,
            hex: "#F9FAFB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9529411764705882,
              0.9568627450980393,
              0.9647058823529412
            ],
            alpha: 1,
            hex: "#F3F4F6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8980392156862745,
              0.9058823529411765,
              0.9215686274509803
            ],
            alpha: 1,
            hex: "#E5E7EB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8196078431372549,
              0.8352941176470589,
              0.8627450980392157
            ],
            alpha: 1,
            hex: "#D1D5DC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6,
              0.6313725490196078,
              0.6862745098039216
            ],
            alpha: 1,
            hex: "#99A1AF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.41568627450980394,
              0.4470588235294118,
              0.5098039215686274
            ],
            alpha: 1,
            hex: "#6A7282"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.2901960784313726,
              0.3333333333333333,
              0.396078431372549
            ],
            alpha: 1,
            hex: "#4A5565"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.21176470588235294,
              0.2549019607843137,
              0.3254901960784314
            ],
            alpha: 1,
            hex: "#364153"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.11764705882352941,
              0.1607843137254902,
              0.2235294117647059
            ],
            alpha: 1,
            hex: "#1E2939"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.06274509803921569,
              0.09411764705882353,
              0.1568627450980392
            ],
            alpha: 1,
            hex: "#101828"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.011764705882352941,
              0.027450980392156862,
              0.07058823529411765
            ],
            alpha: 1,
            hex: "#030712"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9803921568627451,
              0.9803921568627451
            ],
            alpha: 1,
            hex: "#FAFAFA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9568627450980393,
              0.9568627450980393,
              0.9607843137254902
            ],
            alpha: 1,
            hex: "#F4F4F5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8941176470588236,
              0.8941176470588236,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#E4E4E7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8313725490196079,
              0.8313725490196079,
              0.8470588235294118
            ],
            alpha: 1,
            hex: "#D4D4D8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6235294117647059,
              0.6235294117647059,
              0.6627450980392157
            ],
            alpha: 1,
            hex: "#9F9FA9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.44313725490196076,
              0.44313725490196076,
              0.4823529411764706
            ],
            alpha: 1,
            hex: "#71717B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3215686274509804,
              0.3215686274509804,
              0.3607843137254902
            ],
            alpha: 1,
            hex: "#52525C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.24705882352941178,
              0.24705882352941178,
              0.27450980392156865
            ],
            alpha: 1,
            hex: "#3F3F46"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.15294117647058825,
              0.15294117647058825,
              0.16470588235294117
            ],
            alpha: 1,
            hex: "#27272A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.09411764705882353,
              0.09411764705882353,
              0.10588235294117647
            ],
            alpha: 1,
            hex: "#18181B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.03529411764705882,
              0.03529411764705882,
              0.043137254901960784
            ],
            alpha: 1,
            hex: "#09090B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9764705882352941,
              0.9764705882352941,
              0.9764705882352941
            ],
            alpha: 1,
            hex: "#F9F9F9"
          },
          $extensions: {
            "com.figma.variableId": "VariableID:1:4",
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.9607843137254902,
              0.9607843137254902
            ],
            alpha: 1,
            hex: "#F5F5F5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8980392156862745,
              0.8980392156862745,
              0.8980392156862745
            ],
            alpha: 1,
            hex: "#E5E5E5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8313725490196079,
              0.8313725490196079,
              0.8313725490196079
            ],
            alpha: 1,
            hex: "#D4D4D4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6313725490196078,
              0.6313725490196078,
              0.6313725490196078
            ],
            alpha: 1,
            hex: "#A1A1A1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.45098039215686275,
              0.45098039215686275,
              0.45098039215686275
            ],
            alpha: 1,
            hex: "#737373"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3215686274509804,
              0.3215686274509804,
              0.3215686274509804
            ],
            alpha: 1,
            hex: "#525252"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.25098039215686274,
              0.25098039215686274,
              0.25098039215686274
            ],
            alpha: 1,
            hex: "#404040"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.14901960784313725,
              0.14901960784313725,
              0.14901960784313725
            ],
            alpha: 1,
            hex: "#262626"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.06666666666666667,
              0.06666666666666667,
              0.06666666666666667
            ],
            alpha: 1,
            hex: "#111111"
          },
          $extensions: {
            "com.figma.variableId": "VariableID:3:2",
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0392156862745098,
              0.0392156862745098,
              0.0392156862745098
            ],
            alpha: 1,
            hex: "#0A0A0A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9803921568627451,
              0.9764705882352941
            ],
            alpha: 1,
            hex: "#FAFAF9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.9607843137254902,
              0.9568627450980393
            ],
            alpha: 1,
            hex: "#F5F5F4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9058823529411765,
              0.8980392156862745,
              0.8941176470588236
            ],
            alpha: 1,
            hex: "#E7E5E4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8392156862745098,
              0.8274509803921568,
              0.8196078431372549
            ],
            alpha: 1,
            hex: "#D6D3D1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6509803921568628,
              0.6274509803921569,
              0.6078431372549019
            ],
            alpha: 1,
            hex: "#A6A09B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4745098039215686,
              0.44313725490196076,
              0.4196078431372549
            ],
            alpha: 1,
            hex: "#79716B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3411764705882353,
              0.3254901960784314,
              0.30196078431372547
            ],
            alpha: 1,
            hex: "#57534D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.26666666666666666,
              0.25098039215686274,
              0.23137254901960785
            ],
            alpha: 1,
            hex: "#44403B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.1607843137254902,
              0.1450980392156863,
              0.1411764705882353
            ],
            alpha: 1,
            hex: "#292524"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.10980392156862745,
              0.09803921568627451,
              0.09019607843137255
            ],
            alpha: 1,
            hex: "#1C1917"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.047058823529411764,
              0.0392156862745098,
              0.03529411764705882
            ],
            alpha: 1,
            hex: "#0C0A09"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-white": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              1,
              1
            ],
            alpha: 1,
            hex: "#FFFFFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-black": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        $extensions: {
          "com.figma.modeName": "Light"
        }
      },
      Dark: {
        "fill-red-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27450980392156865,
              0.03137254901960784,
              0.03529411764705882
            ],
            alpha: 1,
            hex: "#460809"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5098039215686274,
              0.09411764705882353,
              0.10196078431372549
            ],
            alpha: 1,
            hex: "#82181A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6235294117647059,
              0.027450980392156862,
              0.07058823529411765
            ],
            alpha: 1,
            hex: "#9F0712"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7568627450980392,
              0,
              0.027450980392156862
            ],
            alpha: 1,
            hex: "#C10007"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9058823529411765,
              0,
              0.043137254901960784
            ],
            alpha: 1,
            hex: "#E7000B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.984313725490196,
              0.17254901960784313,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#FB2C36"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.39215686274509803,
              0.403921568627451
            ],
            alpha: 1,
            hex: "#FF6467"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.6352941176470588,
              0.6352941176470588
            ],
            alpha: 1,
            hex: "#FFA2A2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.788235294117647,
              0.788235294117647
            ],
            alpha: 1,
            hex: "#FFC9C9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8862745098039215,
              0.8862745098039215
            ],
            alpha: 1,
            hex: "#FFE2E2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-red-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9490196078431372,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#FEF2F2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.26666666666666666,
              0.07450980392156863,
              0.023529411764705882
            ],
            alpha: 1,
            hex: "#441306"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.49411764705882355,
              0.16470588235294117,
              0.047058823529411764
            ],
            alpha: 1,
            hex: "#7E2A0C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6235294117647059,
              0.17647058823529413,
              0
            ],
            alpha: 1,
            hex: "#9F2D00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.792156862745098,
              0.20784313725490197,
              0
            ],
            alpha: 1,
            hex: "#CA3500"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.28627450980392155,
              0
            ],
            alpha: 1,
            hex: "#F54900"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.4117647058823529,
              0
            ],
            alpha: 1,
            hex: "#FF6900"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.5372549019607843,
              0.01568627450980392
            ],
            alpha: 1,
            hex: "#FF8904"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.7215686274509804,
              0.41568627450980394
            ],
            alpha: 1,
            hex: "#FFB86A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8392156862745098,
              0.6549019607843137
            ],
            alpha: 1,
            hex: "#FFD6A7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9294117647058824,
              0.8313725490196079
            ],
            alpha: 1,
            hex: "#FFEDD4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-orange-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9686274509803922,
              0.9294117647058824
            ],
            alpha: 1,
            hex: "#FFF7ED"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27450980392156865,
              0.09803921568627451,
              0.00392156862745098
            ],
            alpha: 1,
            hex: "#461901"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4823529411764706,
              0.2,
              0.023529411764705882
            ],
            alpha: 1,
            hex: "#7B3306"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.592156862745098,
              0.23529411764705882,
              0
            ],
            alpha: 1,
            hex: "#973C00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7333333333333333,
              0.30196078431372547,
              0
            ],
            alpha: 1,
            hex: "#BB4D00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8823529411764706,
              0.44313725490196076,
              0
            ],
            alpha: 1,
            hex: "#E17100"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.6039215686274509,
              0
            ],
            alpha: 1,
            hex: "#FE9A00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.7254901960784313,
              0
            ],
            alpha: 1,
            hex: "#FFB900"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8235294117647058,
              0.18823529411764706
            ],
            alpha: 1,
            hex: "#FFD230"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9019607843137255,
              0.5215686274509804
            ],
            alpha: 1,
            hex: "#FEE685"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9529411764705882,
              0.7764705882352941
            ],
            alpha: 1,
            hex: "#FEF3C6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-amber-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.984313725490196,
              0.9215686274509803
            ],
            alpha: 1,
            hex: "#FFFBEB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.2627450980392157,
              0.12549019607843137,
              0.01568627450980392
            ],
            alpha: 1,
            hex: "#432004"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.45098039215686275,
              0.24313725490196078,
              0.0392156862745098
            ],
            alpha: 1,
            hex: "#733E0A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5372549019607843,
              0.29411764705882354,
              0
            ],
            alpha: 1,
            hex: "#894B00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6509803921568628,
              0.37254901960784315,
              0
            ],
            alpha: 1,
            hex: "#A65F00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8156862745098039,
              0.5294117647058824,
              0
            ],
            alpha: 1,
            hex: "#D08700"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.6941176470588235,
              0
            ],
            alpha: 1,
            hex: "#F0B100"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.7803921568627451,
              0
            ],
            alpha: 1,
            hex: "#FDC700"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8745098039215686,
              0.12549019607843137
            ],
            alpha: 1,
            hex: "#FFDF20"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9411764705882353,
              0.5215686274509804
            ],
            alpha: 1,
            hex: "#FFF085"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9764705882352941,
              0.7607843137254902
            ],
            alpha: 1,
            hex: "#FEF9C2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-yellow-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.996078431372549,
              0.9882352941176471,
              0.9098039215686274
            ],
            alpha: 1,
            hex: "#FEFCE8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.09803921568627451,
              0.1803921568627451,
              0.011764705882352941
            ],
            alpha: 1,
            hex: "#192E03"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.20784313725490197,
              0.3254901960784314,
              0.054901960784313725
            ],
            alpha: 1,
            hex: "#35530E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.23529411764705882,
              0.38823529411764707,
              0
            ],
            alpha: 1,
            hex: "#3C6300"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.28627450980392155,
              0.49019607843137253,
              0
            ],
            alpha: 1,
            hex: "#497D00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3686274509803922,
              0.6470588235294118,
              0
            ],
            alpha: 1,
            hex: "#5EA500"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.48627450980392156,
              0.8117647058823529,
              0
            ],
            alpha: 1,
            hex: "#7CCF00"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6039215686274509,
              0.9019607843137255,
              0
            ],
            alpha: 1,
            hex: "#9AE600"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7333333333333333,
              0.9568627450980393,
              0.3176470588235294
            ],
            alpha: 1,
            hex: "#BBF451"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8470588235294118,
              0.9764705882352941,
              0.6
            ],
            alpha: 1,
            hex: "#D8F999"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0.9882352941176471,
              0.792156862745098
            ],
            alpha: 1,
            hex: "#ECFCCA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-lime-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9686274509803922,
              0.996078431372549,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#F7FEE7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.011764705882352941,
              0.1803921568627451,
              0.08235294117647059
            ],
            alpha: 1,
            hex: "#032E15"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.050980392156862744,
              0.32941176470588235,
              0.16862745098039217
            ],
            alpha: 1,
            hex: "#0D542B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00392156862745098,
              0.4,
              0.18823529411764706
            ],
            alpha: 1,
            hex: "#016630"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5098039215686274,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#008236"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.6509803921568628,
              0.24313725490196078
            ],
            alpha: 1,
            hex: "#00A63E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.788235294117647,
              0.3137254901960784
            ],
            alpha: 1,
            hex: "#00C950"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0196078431372549,
              0.8745098039215686,
              0.4470588235294118
            ],
            alpha: 1,
            hex: "#05DF72"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4823529411764706,
              0.9450980392156862,
              0.6588235294117647
            ],
            alpha: 1,
            hex: "#7BF1A8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7254901960784313,
              0.9725490196078431,
              0.8117647058823529
            ],
            alpha: 1,
            hex: "#B9F8CF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8627450980392157,
              0.9882352941176471,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#DCFCE7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-green-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.9921568627450981,
              0.9568627450980393
            ],
            alpha: 1,
            hex: "#F0FDF4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.17254901960784313,
              0.13333333333333333
            ],
            alpha: 1,
            hex: "#002C22"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.30980392156862746,
              0.23137254901960785
            ],
            alpha: 1,
            hex: "#004F3B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.3764705882352941,
              0.27058823529411763
            ],
            alpha: 1,
            hex: "#006045"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.47843137254901963,
              0.3333333333333333
            ],
            alpha: 1,
            hex: "#007A55"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.6,
              0.4
            ],
            alpha: 1,
            hex: "#009966"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7372549019607844,
              0.49019607843137253
            ],
            alpha: 1,
            hex: "#00BC7D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.8313725490196079,
              0.5725490196078431
            ],
            alpha: 1,
            hex: "#00D492"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3686274509803922,
              0.9137254901960784,
              0.7098039215686275
            ],
            alpha: 1,
            hex: "#5EE9B5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6431372549019608,
              0.9568627450980393,
              0.8117647058823529
            ],
            alpha: 1,
            hex: "#A4F4CF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8156862745098039,
              0.9803921568627451,
              0.8980392156862745
            ],
            alpha: 1,
            hex: "#D0FAE5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-emerald-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0.9921568627450981,
              0.9607843137254902
            ],
            alpha: 1,
            hex: "#ECFDF5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00784313725490196,
              0.1843137254901961,
              0.1803921568627451
            ],
            alpha: 1,
            hex: "#022F2E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.043137254901960784,
              0.30980392156862746,
              0.2901960784313726
            ],
            alpha: 1,
            hex: "#0B4F4A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.37254901960784315,
              0.35294117647058826
            ],
            alpha: 1,
            hex: "#005F5A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.47058823529411764,
              0.43529411764705883
            ],
            alpha: 1,
            hex: "#00786F"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5882352941176471,
              0.5372549019607843
            ],
            alpha: 1,
            hex: "#009689"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7333333333333333,
              0.6549019607843137
            ],
            alpha: 1,
            hex: "#00BBA7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.8352941176470589,
              0.7450980392156863
            ],
            alpha: 1,
            hex: "#00D5BE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27450980392156865,
              0.9254901960784314,
              0.8352941176470589
            ],
            alpha: 1,
            hex: "#46ECD5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5882352941176471,
              0.9686274509803922,
              0.8941176470588236
            ],
            alpha: 1,
            hex: "#96F7E4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.796078431372549,
              0.984313725490196,
              0.9450980392156862
            ],
            alpha: 1,
            hex: "#CBFBF1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-teal-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.9921568627450981,
              0.9803921568627451
            ],
            alpha: 1,
            hex: "#F0FDFA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0196078431372549,
              0.2,
              0.27058823529411763
            ],
            alpha: 1,
            hex: "#053345"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.06274509803921569,
              0.3058823529411765,
              0.39215686274509803
            ],
            alpha: 1,
            hex: "#104E64"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.37254901960784315,
              0.47058823529411764
            ],
            alpha: 1,
            hex: "#005F78"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.4588235294117647,
              0.5843137254901961
            ],
            alpha: 1,
            hex: "#007595"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5725490196078431,
              0.7215686274509804
            ],
            alpha: 1,
            hex: "#0092B8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7215686274509804,
              0.8588235294117647
            ],
            alpha: 1,
            hex: "#00B8DB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.8274509803921568,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#00D3F2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3254901960784314,
              0.9176470588235294,
              0.9921568627450981
            ],
            alpha: 1,
            hex: "#53EAFD"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6352941176470588,
              0.9568627450980393,
              0.9921568627450981
            ],
            alpha: 1,
            hex: "#A2F4FD"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.807843137254902,
              0.9803921568627451,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#CEFAFE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-cyan-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0.996078431372549,
              1
            ],
            alpha: 1,
            hex: "#ECFEFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0196078431372549,
              0.1843137254901961,
              0.2901960784313726
            ],
            alpha: 1,
            hex: "#052F4A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00784313725490196,
              0.2901960784313726,
              0.4392156862745098
            ],
            alpha: 1,
            hex: "#024A70"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.34901960784313724,
              0.5411764705882353
            ],
            alpha: 1,
            hex: "#00598A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.4117647058823529,
              0.6588235294117647
            ],
            alpha: 1,
            hex: "#0069A8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.5176470588235295,
              0.8196078431372549
            ],
            alpha: 1,
            hex: "#0084D1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.6509803921568628,
              0.9568627450980393
            ],
            alpha: 1,
            hex: "#00A6F4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0.7372549019607844,
              1
            ],
            alpha: 1,
            hex: "#00BCFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4549019607843137,
              0.8313725490196079,
              1
            ],
            alpha: 1,
            hex: "#74D4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7215686274509804,
              0.9019607843137255,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#B8E6FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8745098039215686,
              0.9490196078431372,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#DFF2FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-sky-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9411764705882353,
              0.9764705882352941,
              1
            ],
            alpha: 1,
            hex: "#F0F9FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.08627450980392157,
              0.1411764705882353,
              0.33725490196078434
            ],
            alpha: 1,
            hex: "#162456"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.10980392156862745,
              0.2235294117647059,
              0.5568627450980392
            ],
            alpha: 1,
            hex: "#1C398E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.09803921568627451,
              0.23529411764705882,
              0.7215686274509804
            ],
            alpha: 1,
            hex: "#193CB8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.0784313725490196,
              0.2784313725490196,
              0.9019607843137255
            ],
            alpha: 1,
            hex: "#1447E6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.08235294117647059,
              0.36470588235294116,
              0.9882352941176471
            ],
            alpha: 1,
            hex: "#155DFC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.16862745098039217,
              0.4980392156862745,
              1
            ],
            alpha: 1,
            hex: "#2B7FFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3176470588235294,
              0.6352941176470588,
              1
            ],
            alpha: 1,
            hex: "#51A2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5568627450980392,
              0.7725490196078432,
              1
            ],
            alpha: 1,
            hex: "#8EC5FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7450980392156863,
              0.8588235294117647,
              1
            ],
            alpha: 1,
            hex: "#BEDBFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8588235294117647,
              0.9176470588235294,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#DBEAFE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-blue-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9372549019607843,
              0.9647058823529412,
              1
            ],
            alpha: 1,
            hex: "#EFF6FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.11764705882352941,
              0.10196078431372549,
              0.30196078431372547
            ],
            alpha: 1,
            hex: "#1E1A4D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.19215686274509805,
              0.17254901960784313,
              0.5215686274509804
            ],
            alpha: 1,
            hex: "#312C85"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.21568627450980393,
              0.16470588235294117,
              0.6745098039215687
            ],
            alpha: 1,
            hex: "#372AAC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.2627450980392157,
              0.17647058823529413,
              0.8431372549019608
            ],
            alpha: 1,
            hex: "#432DD7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.30980392156862746,
              0.2235294117647059,
              0.9647058823529412
            ],
            alpha: 1,
            hex: "#4F39F6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3803921568627451,
              0.37254901960784315,
              1
            ],
            alpha: 1,
            hex: "#615FFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.48627450980392156,
              0.5254901960784314,
              1
            ],
            alpha: 1,
            hex: "#7C86FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6392156862745098,
              0.7019607843137254,
              1
            ],
            alpha: 1,
            hex: "#A3B3FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7764705882352941,
              0.8235294117647058,
              1
            ],
            alpha: 1,
            hex: "#C6D2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8784313725490196,
              0.9058823529411765,
              1
            ],
            alpha: 1,
            hex: "#E0E7FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-indigo-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9333333333333333,
              0.9490196078431372,
              1
            ],
            alpha: 1,
            hex: "#EEF2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.1843137254901961,
              0.050980392156862744,
              0.40784313725490196
            ],
            alpha: 1,
            hex: "#2F0D68"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.30196078431372547,
              0.09019607843137255,
              0.6039215686274509
            ],
            alpha: 1,
            hex: "#4D179A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.36470588235294116,
              0.054901960784313725,
              0.7529411764705882
            ],
            alpha: 1,
            hex: "#5D0EC0"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4392156862745098,
              0.03137254901960784,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#7008E7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4980392156862745,
              0.13333333333333333,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#7F22FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5568627450980392,
              0.3176470588235294,
              1
            ],
            alpha: 1,
            hex: "#8E51FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6509803921568628,
              0.5176470588235295,
              1
            ],
            alpha: 1,
            hex: "#A684FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7686274509803922,
              0.7058823529411765,
              1
            ],
            alpha: 1,
            hex: "#C4B4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8666666666666667,
              0.8392156862745098,
              1
            ],
            alpha: 1,
            hex: "#DDD6FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9294117647058824,
              0.9137254901960784,
              0.996078431372549
            ],
            alpha: 1,
            hex: "#EDE9FE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-violet-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.9529411764705882,
              1
            ],
            alpha: 1,
            hex: "#F5F3FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.23529411764705882,
              0.011764705882352941,
              0.4
            ],
            alpha: 1,
            hex: "#3C0366"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.34901960784313724,
              0.08627450980392157,
              0.5450980392156862
            ],
            alpha: 1,
            hex: "#59168B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.43137254901960786,
              0.06666666666666667,
              0.6901960784313725
            ],
            alpha: 1,
            hex: "#6E11B0"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5098039215686274,
              0,
              0.8588235294117647
            ],
            alpha: 1,
            hex: "#8200DB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.596078431372549,
              0.06274509803921569,
              0.9803921568627451
            ],
            alpha: 1,
            hex: "#9810FA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6784313725490196,
              0.27450980392156865,
              1
            ],
            alpha: 1,
            hex: "#AD46FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7607843137254902,
              0.47843137254901963,
              1
            ],
            alpha: 1,
            hex: "#C27AFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8549019607843137,
              0.6980392156862745,
              1
            ],
            alpha: 1,
            hex: "#DAB2FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9137254901960784,
              0.8313725490196079,
              1
            ],
            alpha: 1,
            hex: "#E9D4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9529411764705882,
              0.9098039215686274,
              1
            ],
            alpha: 1,
            hex: "#F3E8FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-purple-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9607843137254902,
              1
            ],
            alpha: 1,
            hex: "#FAF5FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.29411764705882354,
              0,
              0.30980392156862746
            ],
            alpha: 1,
            hex: "#4B004F"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4470588235294118,
              0.07450980392156863,
              0.47058823529411764
            ],
            alpha: 1,
            hex: "#721378"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5411764705882353,
              0.00392156862745098,
              0.5803921568627451
            ],
            alpha: 1,
            hex: "#8A0194"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6588235294117647,
              0,
              0.7176470588235294
            ],
            alpha: 1,
            hex: "#A800B7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7843137254901961,
              0,
              0.8705882352941177
            ],
            alpha: 1,
            hex: "#C800DE"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8823529411764706,
              0.16470588235294117,
              0.984313725490196
            ],
            alpha: 1,
            hex: "#E12AFB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9294117647058824,
              0.41568627450980394,
              1
            ],
            alpha: 1,
            hex: "#ED6AFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9568627450980393,
              0.6588235294117647,
              1
            ],
            alpha: 1,
            hex: "#F4A8FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9647058823529412,
              0.8117647058823529,
              1
            ],
            alpha: 1,
            hex: "#F6CFFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9098039215686274,
              1
            ],
            alpha: 1,
            hex: "#FAE8FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-fuchsia-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.9568627450980393,
              1
            ],
            alpha: 1,
            hex: "#FDF4FF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3176470588235294,
              0.01568627450980392,
              0.1411764705882353
            ],
            alpha: 1,
            hex: "#510424"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5254901960784314,
              0.06274509803921569,
              0.2627450980392157
            ],
            alpha: 1,
            hex: "#861043"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6392156862745098,
              0,
              0.2980392156862745
            ],
            alpha: 1,
            hex: "#A3004C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7764705882352941,
              0,
              0.3607843137254902
            ],
            alpha: 1,
            hex: "#C6005C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9019607843137255,
              0,
              0.4627450980392157
            ],
            alpha: 1,
            hex: "#E60076"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9647058823529412,
              0.2,
              0.6039215686274509
            ],
            alpha: 1,
            hex: "#F6339A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.984313725490196,
              0.39215686274509803,
              0.7137254901960784
            ],
            alpha: 1,
            hex: "#FB64B6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.6470588235294118,
              0.8352941176470589
            ],
            alpha: 1,
            hex: "#FDA5D5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9882352941176471,
              0.807843137254902,
              0.9098039215686274
            ],
            alpha: 1,
            hex: "#FCCEE8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9882352941176471,
              0.9058823529411765,
              0.9529411764705882
            ],
            alpha: 1,
            hex: "#FCE7F3"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-pink-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9921568627450981,
              0.9490196078431372,
              0.9725490196078431
            ],
            alpha: 1,
            hex: "#FDF2F8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.30196078431372547,
              0.00784313725490196,
              0.09411764705882353
            ],
            alpha: 1,
            hex: "#4D0218"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5450980392156862,
              0.03137254901960784,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#8B0836"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6470588235294118,
              0,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#A50036"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.7803921568627451,
              0,
              0.21176470588235294
            ],
            alpha: 1,
            hex: "#C70036"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9254901960784314,
              0,
              0.24705882352941178
            ],
            alpha: 1,
            hex: "#EC003F"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.12549019607843137,
              0.33725490196078434
            ],
            alpha: 1,
            hex: "#FF2056"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.38823529411764707,
              0.49411764705882355
            ],
            alpha: 1,
            hex: "#FF637E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.6313725490196078,
              0.6784313725490196
            ],
            alpha: 1,
            hex: "#FFA1AD"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8,
              0.8274509803921568
            ],
            alpha: 1,
            hex: "#FFCCD3"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.8941176470588236,
              0.9019607843137255
            ],
            alpha: 1,
            hex: "#FFE4E6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-rose-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              0.9450980392156862,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#FFF1F2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.00784313725490196,
              0.023529411764705882,
              0.09411764705882353
            ],
            alpha: 1,
            hex: "#020618"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.058823529411764705,
              0.09019607843137255,
              0.16862745098039217
            ],
            alpha: 1,
            hex: "#0F172B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.11372549019607843,
              0.1607843137254902,
              0.23921568627450981
            ],
            alpha: 1,
            hex: "#1D293D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.19215686274509805,
              0.2549019607843137,
              0.34509803921568627
            ],
            alpha: 1,
            hex: "#314158"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.27058823529411763,
              0.3333333333333333,
              0.4235294117647059
            ],
            alpha: 1,
            hex: "#45556C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3843137254901961,
              0.4549019607843137,
              0.5568627450980392
            ],
            alpha: 1,
            hex: "#62748E"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.5647058823529412,
              0.6313725490196078,
              0.7254901960784313
            ],
            alpha: 1,
            hex: "#90A1B9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.792156862745098,
              0.8352941176470589,
              0.8862745098039215
            ],
            alpha: 1,
            hex: "#CAD5E2"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8862745098039215,
              0.9098039215686274,
              0.9411764705882353
            ],
            alpha: 1,
            hex: "#E2E8F0"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9450980392156862,
              0.9607843137254902,
              0.9764705882352941
            ],
            alpha: 1,
            hex: "#F1F5F9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-slate-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9725490196078431,
              0.9803921568627451,
              0.9882352941176471
            ],
            alpha: 1,
            hex: "#F8FAFC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.011764705882352941,
              0.027450980392156862,
              0.07058823529411765
            ],
            alpha: 1,
            hex: "#030712"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.06274509803921569,
              0.09411764705882353,
              0.1568627450980392
            ],
            alpha: 1,
            hex: "#101828"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.11764705882352941,
              0.1607843137254902,
              0.2235294117647059
            ],
            alpha: 1,
            hex: "#1E2939"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.21176470588235294,
              0.2549019607843137,
              0.3254901960784314
            ],
            alpha: 1,
            hex: "#364153"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.2901960784313726,
              0.3333333333333333,
              0.396078431372549
            ],
            alpha: 1,
            hex: "#4A5565"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.41568627450980394,
              0.4470588235294118,
              0.5098039215686274
            ],
            alpha: 1,
            hex: "#6A7282"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6,
              0.6313725490196078,
              0.6862745098039216
            ],
            alpha: 1,
            hex: "#99A1AF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8196078431372549,
              0.8352941176470589,
              0.8627450980392157
            ],
            alpha: 1,
            hex: "#D1D5DC"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8980392156862745,
              0.9058823529411765,
              0.9215686274509803
            ],
            alpha: 1,
            hex: "#E5E7EB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9529411764705882,
              0.9568627450980393,
              0.9647058823529412
            ],
            alpha: 1,
            hex: "#F3F4F6"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-gray-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9764705882352941,
              0.9803921568627451,
              0.984313725490196
            ],
            alpha: 1,
            hex: "#F9FAFB"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.03529411764705882,
              0.03529411764705882,
              0.043137254901960784
            ],
            alpha: 1,
            hex: "#09090B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.09411764705882353,
              0.09411764705882353,
              0.10588235294117647
            ],
            alpha: 1,
            hex: "#18181B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.15294117647058825,
              0.15294117647058825,
              0.16470588235294117
            ],
            alpha: 1,
            hex: "#27272A"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.24705882352941178,
              0.24705882352941178,
              0.27450980392156865
            ],
            alpha: 1,
            hex: "#3F3F46"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3215686274509804,
              0.3215686274509804,
              0.3607843137254902
            ],
            alpha: 1,
            hex: "#52525C"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.44313725490196076,
              0.44313725490196076,
              0.4823529411764706
            ],
            alpha: 1,
            hex: "#71717B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6235294117647059,
              0.6235294117647059,
              0.6627450980392157
            ],
            alpha: 1,
            hex: "#9F9FA9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8313725490196079,
              0.8313725490196079,
              0.8470588235294118
            ],
            alpha: 1,
            hex: "#D4D4D8"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8941176470588236,
              0.8941176470588236,
              0.9058823529411765
            ],
            alpha: 1,
            hex: "#E4E4E7"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9568627450980393,
              0.9568627450980393,
              0.9607843137254902
            ],
            alpha: 1,
            hex: "#F4F4F5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-zinc-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9803921568627451,
              0.9803921568627451
            ],
            alpha: 1,
            hex: "#FAFAFA"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.08627450980392157,
              0.08627450980392157,
              0.08627450980392157
            ],
            alpha: 1,
            hex: "#161616"
          },
          $extensions: {
            "com.figma.variableId": "VariableID:1:4",
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.06666666666666667,
              0.06666666666666667,
              0.06666666666666667
            ],
            alpha: 1,
            hex: "#111111"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.14901960784313725,
              0.14901960784313725,
              0.14901960784313725
            ],
            alpha: 1,
            hex: "#262626"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.25098039215686274,
              0.25098039215686274,
              0.25098039215686274
            ],
            alpha: 1,
            hex: "#404040"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3215686274509804,
              0.3215686274509804,
              0.3215686274509804
            ],
            alpha: 1,
            hex: "#525252"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.45098039215686275,
              0.45098039215686275,
              0.45098039215686275
            ],
            alpha: 1,
            hex: "#737373"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6313725490196078,
              0.6313725490196078,
              0.6313725490196078
            ],
            alpha: 1,
            hex: "#A1A1A1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8313725490196079,
              0.8313725490196079,
              0.8313725490196079
            ],
            alpha: 1,
            hex: "#D4D4D4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8980392156862745,
              0.8980392156862745,
              0.8980392156862745
            ],
            alpha: 1,
            hex: "#E5E5E5"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9490196078431372,
              0.9490196078431372,
              0.9490196078431372
            ],
            alpha: 1,
            hex: "#F2F2F2"
          },
          $extensions: {
            "com.figma.variableId": "VariableID:3:2",
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-neutral-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9764705882352941,
              0.9764705882352941,
              0.9764705882352941
            ],
            alpha: 1,
            hex: "#F9F9F9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-50": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.047058823529411764,
              0.0392156862745098,
              0.03529411764705882
            ],
            alpha: 1,
            hex: "#0C0A09"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-100": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.10980392156862745,
              0.09803921568627451,
              0.09019607843137255
            ],
            alpha: 1,
            hex: "#1C1917"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-200": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.1607843137254902,
              0.1450980392156863,
              0.1411764705882353
            ],
            alpha: 1,
            hex: "#292524"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-300": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.26666666666666666,
              0.25098039215686274,
              0.23137254901960785
            ],
            alpha: 1,
            hex: "#44403B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-400": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.3411764705882353,
              0.3254901960784314,
              0.30196078431372547
            ],
            alpha: 1,
            hex: "#57534D"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-500": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.4745098039215686,
              0.44313725490196076,
              0.4196078431372549
            ],
            alpha: 1,
            hex: "#79716B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-600": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.6509803921568628,
              0.6274509803921569,
              0.6078431372549019
            ],
            alpha: 1,
            hex: "#A6A09B"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-700": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.8392156862745098,
              0.8274509803921568,
              0.8196078431372549
            ],
            alpha: 1,
            hex: "#D6D3D1"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-800": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9058823529411765,
              0.8980392156862745,
              0.8941176470588236
            ],
            alpha: 1,
            hex: "#E7E5E4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-900": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9607843137254902,
              0.9607843137254902,
              0.9568627450980393
            ],
            alpha: 1,
            hex: "#F5F5F4"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-stone-950": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0.9803921568627451,
              0.9803921568627451,
              0.9764705882352941
            ],
            alpha: 1,
            hex: "#FAFAF9"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-white": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        "fill-black": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              1,
              1,
              1
            ],
            alpha: 1,
            hex: "#FFFFFF"
          },
          $extensions: {
            "com.figma.scopes": [
              "ALL_FILLS",
              "STROKE_COLOR",
              "EFFECT_COLOR"
            ]
          }
        },
        $extensions: {
          "com.figma.modeName": "Dark"
        }
      }
    },
    units: {
      Default: {
        "spacing-0": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-px": {
          $type: "number",
          $value: 1,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-0p5": {
          $type: "number",
          $value: 2,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-1": {
          $type: "number",
          $value: 4,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-1p5": {
          $type: "number",
          $value: 6,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-2": {
          $type: "number",
          $value: 8,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-2p5": {
          $type: "number",
          $value: 10,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-3": {
          $type: "number",
          $value: 12,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-3p5": {
          $type: "number",
          $value: 14,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-4": {
          $type: "number",
          $value: 16,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-5": {
          $type: "number",
          $value: 20,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-6": {
          $type: "number",
          $value: 24,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-7": {
          $type: "number",
          $value: 28,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-8": {
          $type: "number",
          $value: 32,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-9": {
          $type: "number",
          $value: 36,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-10": {
          $type: "number",
          $value: 40,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-11": {
          $type: "number",
          $value: 44,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-12": {
          $type: "number",
          $value: 48,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-14": {
          $type: "number",
          $value: 56,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-16": {
          $type: "number",
          $value: 64,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-20": {
          $type: "number",
          $value: 80,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-24": {
          $type: "number",
          $value: 96,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-28": {
          $type: "number",
          $value: 112,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-32": {
          $type: "number",
          $value: 128,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-36": {
          $type: "number",
          $value: 144,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-40": {
          $type: "number",
          $value: 160,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-44": {
          $type: "number",
          $value: 176,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-48": {
          $type: "number",
          $value: 192,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-52": {
          $type: "number",
          $value: 208,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-56": {
          $type: "number",
          $value: 224,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-60": {
          $type: "number",
          $value: 240,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-64": {
          $type: "number",
          $value: 256,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-72": {
          $type: "number",
          $value: 288,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-80": {
          $type: "number",
          $value: 320,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-96": {
          $type: "number",
          $value: 384,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "spacing-full": {
          $type: "number",
          $value: 999,
          $extensions: {
            "com.figma.scopes": [
              "WIDTH_HEIGHT",
              "GAP"
            ]
          }
        },
        "radius-none": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-xs": {
          $type: "number",
          $value: 2,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-sm": {
          $type: "number",
          $value: 4,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-md": {
          $type: "number",
          $value: 6,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-lg": {
          $type: "number",
          $value: 8,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-xl": {
          $type: "number",
          $value: 12,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-2xl": {
          $type: "number",
          $value: 16,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-3xl": {
          $type: "number",
          $value: 24,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-4xl": {
          $type: "number",
          $value: 32,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        "radius-full": {
          $type: "number",
          $value: 999,
          $extensions: {
            "com.figma.scopes": [
              "CORNER_RADIUS"
            ]
          }
        },
        $extensions: {
          "com.figma.modeName": "Default"
        }
      }
    },
    typography: {
      Default: {
        "font-size-xs": {
          $type: "number",
          $value: 12,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-sm": {
          $type: "number",
          $value: 14,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-base": {
          $type: "number",
          $value: 16,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-lg": {
          $type: "number",
          $value: 18,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-xl": {
          $type: "number",
          $value: 20,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-2xl": {
          $type: "number",
          $value: 24,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-3xl": {
          $type: "number",
          $value: 30,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-4xl": {
          $type: "number",
          $value: 36,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-5xl": {
          $type: "number",
          $value: 48,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-6xl": {
          $type: "number",
          $value: 60,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-7xl": {
          $type: "number",
          $value: 72,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-8xl": {
          $type: "number",
          $value: 96,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "font-size-9xl": {
          $type: "number",
          $value: 128,
          $extensions: {
            "com.figma.scopes": [
              "FONT_SIZE"
            ]
          }
        },
        "line-height-xs": {
          $type: "number",
          $value: 16,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-sm": {
          $type: "number",
          $value: 20,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-base": {
          $type: "number",
          $value: 24,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-lg": {
          $type: "number",
          $value: 28,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-xl": {
          $type: "number",
          $value: 28,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-2xl": {
          $type: "number",
          $value: 32,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-3xl": {
          $type: "number",
          $value: 36,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-4xl": {
          $type: "number",
          $value: 40,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-5xl": {
          $type: "number",
          $value: 48,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-6xl": {
          $type: "number",
          $value: 60,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-7xl": {
          $type: "number",
          $value: 72,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-8xl": {
          $type: "number",
          $value: 96,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "line-height-9xl": {
          $type: "number",
          $value: 128,
          $extensions: {
            "com.figma.scopes": [
              "LINE_HEIGHT"
            ]
          }
        },
        "font-weight-thin": {
          $type: "number",
          $value: 100,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-extralight": {
          $type: "number",
          $value: 200,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-light": {
          $type: "number",
          $value: 300,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-normal": {
          $type: "number",
          $value: 400,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-medium": {
          $type: "number",
          $value: 500,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-semibold": {
          $type: "number",
          $value: 600,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-bold": {
          $type: "number",
          $value: 700,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-extrabold": {
          $type: "number",
          $value: 800,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        "font-weight-black": {
          $type: "number",
          $value: 900,
          $extensions: {
            "com.figma.scopes": [
              "FONT_WEIGHT"
            ]
          }
        },
        $extensions: {
          "com.figma.modeName": "Default"
        }
      }
    },
    shadows: {
      Default: {
        "shadow-2xs-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xs-1-offset-y": {
          $type: "number",
          $value: 1,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xs-1-blur": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xs-1-spread": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xs-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.05,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-xs-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xs-1-offset-y": {
          $type: "number",
          $value: 1,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xs-1-blur": {
          $type: "number",
          $value: 2,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xs-1-spread": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xs-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.05,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-sm-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-1-offset-y": {
          $type: "number",
          $value: 1,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-1-blur": {
          $type: "number",
          $value: 3,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-1-spread": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-sm-2-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-2-offset-y": {
          $type: "number",
          $value: 1,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-2-blur": {
          $type: "number",
          $value: 2,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-2-spread": {
          $type: "number",
          $value: -1,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-sm-2-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-md-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-1-offset-y": {
          $type: "number",
          $value: 4,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-1-blur": {
          $type: "number",
          $value: 6,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-1-spread": {
          $type: "number",
          $value: -1,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-md-2-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-2-offset-y": {
          $type: "number",
          $value: 2,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-2-blur": {
          $type: "number",
          $value: 4,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-2-spread": {
          $type: "number",
          $value: -2,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-md-2-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-lg-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-1-offset-y": {
          $type: "number",
          $value: 10,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-1-blur": {
          $type: "number",
          $value: 15,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-1-spread": {
          $type: "number",
          $value: -3,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-lg-2-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-2-offset-y": {
          $type: "number",
          $value: 4,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-2-blur": {
          $type: "number",
          $value: 6,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-2-spread": {
          $type: "number",
          $value: -4,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-lg-2-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-xl-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-1-offset-y": {
          $type: "number",
          $value: 20,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-1-blur": {
          $type: "number",
          $value: 25,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-1-spread": {
          $type: "number",
          $value: -5,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-xl-2-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-2-offset-y": {
          $type: "number",
          $value: 8,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-2-blur": {
          $type: "number",
          $value: 10,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-2-spread": {
          $type: "number",
          $value: -6,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-xl-2-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.1,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        "shadow-2xl-1-offset-x": {
          $type: "number",
          $value: 0,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xl-1-offset-y": {
          $type: "number",
          $value: 25,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xl-1-blur": {
          $type: "number",
          $value: 50,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xl-1-spread": {
          $type: "number",
          $value: -12,
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_FLOAT"
            ]
          }
        },
        "shadow-2xl-1-color": {
          $type: "color",
          $value: {
            colorSpace: "srgb",
            components: [
              0,
              0,
              0
            ],
            alpha: 0.25,
            hex: "#000000"
          },
          $extensions: {
            "com.figma.scopes": [
              "EFFECT_COLOR"
            ]
          }
        },
        $extensions: {
          "com.figma.modeName": "Default"
        }
      }
    }
  };

  // unison-components/src/constants/colors.ts
  var UNISON_COLORS = {
    currentcolor: "currentColor",
    transparent: "transparent",
    black: "#000000",
    white: "#FFFFFF",
    // purple
    primary: {
      0: "#FFFFFF00",
      brand: "#9225FF",
      900: "#4A00B0",
      800: "#6B12D6",
      700: "#9225FF",
      600: "#A852FF",
      500: "#BD7FFF",
      400: "#D1A3FF",
      300: "#E1C4FF",
      200: "#EEDEFF",
      100: "#F6EFFF",
      50: "#FAF7FF"
    },
    // pink
    secondary: {
      0: "#FFFFFF00",
      brand: "#E93BCC",
      900: "#9E1287",
      800: "#D117B2",
      700: "#E93BCC",
      600: "#EE63D7",
      500: "#F28CE1",
      400: "#F6ACEA",
      300: "#F9CAF1",
      200: "#FCE1F7",
      100: "#FDF1FB",
      50: "#FEF8FD"
    },
    // blue
    tertiary: {
      0: "#FFFFFF00",
      brand: "#39A4EB",
      900: "#1066A0",
      800: "#1587D3",
      700: "#39A4EB",
      600: "#62B7EF",
      500: "#8BC9F3",
      400: "#ABD9F7",
      300: "#C9E6FA",
      200: "#E1F1FC",
      100: "#F0F8FE",
      50: "#F8FCFE"
    },
    // yellow
    tentative: {
      0: "#FFFFFF00",
      brand: "#FFC900",
      900: "#514100",
      800: "#6C5700",
      700: "#8E7200",
      600: "#9E7F00",
      500: "#A48600",
      400: "#BD9E00",
      300: "#D0B900",
      200: "#E0D25D",
      100: "#F1E9B8",
      50: "#F8F4E3"
    },
    // green
    positive: {
      0: "#F1FFF5",
      brand: "#1C8744",
      900: "#004D20",
      800: "#00682A",
      700: "#008737",
      600: "#009645",
      500: "#009E52",
      400: "#00B965",
      300: "#61CE8E",
      200: "#9DDEB6",
      100: "#CEF1D9",
      50: "#E4F8EA"
    },
    // red
    negative: {
      0: "#FFFFFF00",
      brand: "#F94D3F",
      900: "#7E1F02",
      800: "#AA2900",
      700: "#DF2F03",
      600: "#EA4921",
      500: "#E45F3D",
      400: "#F28260",
      300: "#FFA086",
      200: "#FFBDA9",
      100: "#FFDBD1",
      50: "#FFEDE8"
    },
    // gray
    neutral: {
      0: "#FFFFFF00",
      brand: "#1A1A1A",
      900: "#000000",
      800: "#0D0D0D",
      700: "#1A1A1A",
      600: "#808080",
      500: "#969696",
      400: "#BDBDBD",
      300: "#E5E5E5",
      200: "#EDEDED",
      100: "#F5F5F5",
      50: "#F7F7F7"
    },
    // gray surface
    neutralsurface: {
      0: "#FFFFFF00",
      brand: "#FFFFFF",
      900: "#575757",
      800: "#707070",
      700: "#8F8F8F",
      600: "#A6A6A6",
      500: "#BDBDBD",
      400: "#CFCFCF",
      300: "#DEDEDE",
      200: "#E8E8E8",
      100: "#F2F2F2",
      50: "#F7F7F7"
    },
    // text
    text: {
      0: "#FFFFFF00",
      brand: "#FFFFFF",
      900: "#FFFFFF",
      800: "#000000",
      700: "#222222",
      600: "#FFFFFF",
      500: "#BDBDBD",
      400: "#C9C9C9",
      300: "#FFFFFF",
      200: "#FFFFFF",
      100: "#FFFFFF",
      50: "#FFFFFF"
    }
  };
  var TAILWIND_COLORS = (() => {
    var _a, _b;
    const palette = {};
    for (const [name, token] of Object.entries(tokens_default.colors.Light)) {
      const [, hue, shade] = (_a = name.match(/^fill-([a-z]+)-(\d+)$/)) != null ? _a : [];
      if (!hue || hue === "neutral" || !("$value" in token)) continue;
      (_b = palette[hue]) != null ? _b : palette[hue] = {};
      palette[hue][shade] = token.$value.hex;
    }
    return palette;
  })();
  var COLORS = __spreadValues(__spreadValues({}, UNISON_COLORS), TAILWIND_COLORS);

  // unison-components/src/constants/units.ts
  var UNITS = {
    /**
     * 0, 0rem, 0px
     */
    0: 0,
    /**
     * px, 1px
     */
    px: 1,
    /**
     * 1px
     * @deprecated Use `px` instead.
     */
    "1px": 1,
    /**
     * 05, 0.125rem, 2px
     * @deprecated Use `0p5` instead.
     */
    "05": 2,
    /**
     * 0p5, 0.125rem, 2px
     */
    "0p5": 2,
    /**
     * 1, 0.25rem, 4px
     */
    1: 4,
    /**
     * 1p5, 0.375rem, 6px
     */
    "1p5": 6,
    /**
     * 2, 0.5rem, 8px
     */
    2: 8,
    /**
     * 2p5, 0.625rem, 10px
     */
    "2p5": 10,
    /**
     * 3, 0.75rem, 12px
     */
    3: 12,
    /**
     * 3p5, 0.875rem, 14px
     */
    "3p5": 14,
    /**
     * 4, 1rem, 16px
     */
    4: 16,
    /**
     * 5, 1.25rem, 20px
     */
    5: 20,
    /**
     * 6, 1.5rem, 24px
     */
    6: 24,
    /**
     * 7, 1.75rem, 28px
     */
    7: 28,
    /**
     * 8, 2rem, 32px
     */
    8: 32,
    /**
     * 9, 2.25rem, 36px
     */
    9: 36,
    /**
     * 10, 2.5rem, 40px
     */
    10: 40,
    /**
     * 11, 2.75rem, 44px
     */
    11: 44,
    /**
     * 12, 3rem, 48px
     */
    12: 48,
    /**
     * 14, 3.5rem, 56px
     */
    14: 56,
    /**
     * 16, 4rem, 64px
     */
    16: 64,
    /**
     * 20, 5rem, 80px
     */
    20: 80,
    /**
     * 24, 6rem, 96px
     */
    24: 96,
    /**
     * 28, 7rem, 112px
     */
    28: 112,
    /**
     * 32, 8rem, 128px
     */
    32: 128,
    /**
     * 36, 9rem, 144px
     */
    36: 144,
    /**
     * 40, 10rem, 160px
     */
    40: 160,
    /**
     * 44, 11rem, 176px
     */
    44: 176,
    /**
     * 48, 12rem, 192px
     */
    48: 192,
    /**
     * 52, 13rem, 208px
     */
    52: 208,
    /**
     * 56, 14rem, 224px
     */
    56: 224,
    /**
     * 60, 15rem, 240px
     */
    60: 240,
    /**
     * 64, 16rem, 256px
     */
    64: 256,
    /**
     * 72, 18rem, 288px
     */
    72: 288,
    /**
     * 80, 20rem, 320px
     */
    80: 320,
    /**
     * 96, 24rem, 384px
     */
    96: 384,
    /**
     * 999px
     */
    full: 999
  };
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
  var RADII = {
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
  var SHADOWS = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];

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
    const paletteHexes = /* @__PURE__ */ new Set();
    for (const [shade, hex] of Object.entries(value)) {
      COLOR_TOKENS.add("".concat(name, "-").concat(shade));
      if (shade === "0" || shade === "brand" || !isRgbHex(hex)) {
        continue;
      }
      addHexOwner(hex, "".concat(name, "-").concat(shade));
      paletteHexes.add(hex);
    }
    if ("brand" in value && isRgbHex(value.brand) && !paletteHexes.has(value.brand)) {
      addHexOwner(value.brand, "".concat(name, "-brand"));
    }
  }
  var UNIQUE_HEX_TO_TOKEN = {};
  for (const [hex, tokens] of HEX_OWNERS) {
    if (tokens.length === 1) {
      UNIQUE_HEX_TO_TOKEN[hex] = tokens[0];
    }
  }
  var normalizeColorName = (name) => name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/\//g, "-").replace(/neutral-surface/g, "neutralsurface");
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
  var DEPRECATED_UNITS = /* @__PURE__ */ new Set(["05", "1px"]);
  var UNIT_TOKENS = new Set(
    [...Object.keys(UNITS), ...Object.keys(UNITS_FIGMA)].filter((unit) => !DEPRECATED_UNITS.has(unit))
  );
  var PIXEL_TO_TOKEN = {};
  for (const [unit, pixels] of Object.entries(__spreadValues(__spreadValues({}, UNITS), UNITS_FIGMA))) {
    if (typeof pixels !== "number" || DEPRECATED_UNITS.has(unit)) {
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
          const className = await resolveBoundUnitClass("width-", node.boundVariables.width, node.width);
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
  var readGap = async (node) => {
    var _a, _b;
    const properties = {};
    const errors = [];
    if (node.itemSpacing > 0) {
      if (node.itemSpacing === 1) {
        properties["gap-px"] = true;
      } else if (((_a = node.boundVariables) == null ? void 0 : _a.itemSpacing) === void 0 && node.itemSpacing !== 1) {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 GAP value is not bound to a variable.")
        });
      } else {
        const className = await resolveBoundUnitClass("gap-", (_b = node.boundVariables) == null ? void 0 : _b.itemSpacing, node.itemSpacing);
        if (className) {
          properties[className] = true;
        }
      }
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
        message: "Error @ ".concat(node.name, " \u2013 FRAME has no auto layout.")
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
      ...alignment.errors,
      ...cornerRadius.errors,
      ...dimensions.errors,
      ...effect.errors,
      ...fill.errors,
      ...gap.errors,
      ...layout.errors,
      ...padding.errors,
      ...stroke.errors
    ];
    const warnings = [
      ...alignment.warnings,
      ...cornerRadius.warnings,
      ...dimensions.warnings,
      ...effect.warnings,
      ...fill.warnings,
      ...gap.warnings,
      ...layout.warnings,
      ...padding.warnings,
      ...stroke.warnings
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
    const errors = [...alignment.errors, ...fill.errors, ...typography.errors];
    const characters = node.characters;
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), alignment.properties), fill.properties), typography.properties), {
        characters
      }),
      errors,
      warnings: []
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
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        figma.notify("".concat(messages.join(" "), " Import failed: ").concat(reason).trim(), { error: true, timeout: 1e4 });
      }
      runner();
      return;
    }
    if (msg.type === "refresh") {
      runner();
      return;
    }
    if (msg.type === "back") {
      while (selectionHistory.length > 0) {
        const previousId = selectionHistory.pop();
        if (!previousId) break;
        restoringSelection = true;
        if (await focusNode(previousId)) {
          currentSelectionId = previousId;
          return;
        }
        restoringSelection = false;
      }
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
