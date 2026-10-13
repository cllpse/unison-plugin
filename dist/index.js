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

  // figma/src/constants/colors.ts
  var COLORS = {
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

  // figma/src/constants/units.ts
  var UNITS = {
    /**
     * 0, 0rem, 0px
     */
    0: 0,
    /**
     * 1px
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
     * 0, 0.25rem, 4px
     */
    1: 4,
    /**
     * 1p5, 0.375rem, 6px
     */
    "1p5": 6,
    /**
     * 0, 0.5rem, 8px
     */
    2: 8,
    /**
     * 0, 0.75rem, 12px
     */
    3: 12,
    /**
     * 0, 1rem, 16px
     */
    4: 16,
    /**
     * 0, 1.25rem, 20px
     */
    5: 20,
    /**
     * 0, 1.5rem, 24px
     */
    6: 24,
    /**
     * 0, 1.75rem, 28px
     */
    7: 28,
    /**
     * 0, 2rem, 32px
     */
    8: 32,
    /**
     * 0, 2.5rem, 40px
     */
    10: 40,
    /**
     * 0, 2.75rem, 44px
     */
    11: 44,
    /**
     * 0, 3rem, 48px
     */
    12: 48,
    /**
     * 0, 3.5rem, 56px
     */
    14: 56,
    /**
     * 0, 4rem, 64px
     */
    16: 64,
    /**
     * 0, 5rem, 80px
     */
    20: 80,
    /**
     * 0, 6rem, 96px
     */
    24: 96,
    /**
     * 0, 7rem, 112px
     */
    28: 112,
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
    const keys = _openTagPropKeys(tag, properties).sort((a, b) => a.localeCompare(b));
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
    if (properties.type === "VECTOR") return "Icon";
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
    const selfClosing = tag === "Ellipse" || tag === "Rectangle";
    const open = _formatOpenTag(tag, properties, indentation, selfClosing);
    if (selfClosing) {
      return open;
    }
    if (tag === "Text") {
      return [open, "".concat(indentation).concat(INDENT).concat(properties.characters), "".concat(indentation, "</Text>")].join("\n");
    }
    if (tag === "Icon") {
      return [open, "".concat(indentation).concat(INDENT).concat(properties.name), "".concat(indentation, "</Icon>")].join("\n");
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
    if (isRgbHex(value.brand) && !paletteHexes.has(value.brand)) {
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
  var DEPRECATED_UNITS = /* @__PURE__ */ new Set(["05"]);
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
  var normalizeUnitName = (name) => name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/(\d)\.(\d)/g, "$1p$2").replace(/\//g, "-").replace(/^05$/, "0p5").replace(/-05$/, "-0p5");
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
  var mapCornerRadius = buildUnitMap("corner-radius-");
  var mapCornerRadiusTopLeft = buildUnitMap("corner-radius-top-left-");
  var mapCornerRadiusTopRight = buildUnitMap("corner-radius-top-right-");
  var mapCornerRadiusBottomLeft = buildUnitMap("corner-radius-bottom-left-");
  var mapCornerRadiusBottomRight = buildUnitMap("corner-radius-bottom-right-");
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
    } else {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, ' \u2013 ALIGNMENT mode must be "horizontal" or "vertical".')
      });
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
  var readDiscreteCorner = async (node, value, bound, prefix, label, properties, errors) => {
    if (value <= 0) {
      return;
    }
    if (bound === void 0) {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, " \u2013 CORNER RADIUS ").concat(label, " value is not bound to a variable.")
      });
      return;
    }
    const className = await resolveBoundUnitClass(prefix, bound, value);
    if (className) {
      properties[className] = true;
    }
  };
  var readCornerRadius = async (node) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const properties = {};
    const errors = [];
    if (node.cornerRadius === figma.mixed) {
      if (!hasDiscreteCorners(node)) {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 CORNER RADIUS values cannot be mixed.")
        });
      } else {
        await readDiscreteCorner(
          node,
          node.topLeftRadius,
          (_a = node.boundVariables) == null ? void 0 : _a.topLeftRadius,
          "corner-radius-top-left-",
          "top left",
          properties,
          errors
        );
        await readDiscreteCorner(
          node,
          node.topRightRadius,
          (_b = node.boundVariables) == null ? void 0 : _b.topRightRadius,
          "corner-radius-top-right-",
          "top right",
          properties,
          errors
        );
        await readDiscreteCorner(
          node,
          node.bottomLeftRadius,
          (_c = node.boundVariables) == null ? void 0 : _c.bottomLeftRadius,
          "corner-radius-bottom-left-",
          "bottom left",
          properties,
          errors
        );
        await readDiscreteCorner(
          node,
          node.bottomRightRadius,
          (_d = node.boundVariables) == null ? void 0 : _d.bottomRightRadius,
          "corner-radius-bottom-right-",
          "bottom right",
          properties,
          errors
        );
      }
    } else if (node.cornerRadius > 0) {
      if ([
        (_e = node.boundVariables) == null ? void 0 : _e.topLeftRadius,
        (_f = node.boundVariables) == null ? void 0 : _f.topRightRadius,
        (_g = node.boundVariables) == null ? void 0 : _g.bottomLeftRadius,
        (_h = node.boundVariables) == null ? void 0 : _h.bottomRightRadius
      ].includes(void 0)) {
        errors.push({
          nodeId: node.id,
          message: "Error @ ".concat(node.name, " \u2013 CORNER RADIUS value is not bound to a variable.")
        });
      } else {
        const className = await resolveBoundUnitClass(
          "corner-radius-",
          (_i = node.boundVariables) == null ? void 0 : _i.topLeftRadius,
          node.cornerRadius
        );
        if (className) {
          properties[className] = true;
        }
      }
    }
    return { properties, errors, warnings: [] };
  };

  // src/read/gap.ts
  var readGap = async (node) => {
    var _a, _b;
    const properties = {};
    const errors = [];
    if (node.itemSpacing > 0) {
      if (node.itemSpacing === 1) {
        properties["gap-1px"] = true;
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
    HORIZONTAL: "flow-horizontal",
    VERTICAL: "flow-vertical",
    GRID: "flow-grid"
  };
  var readLayout = (node) => {
    const properties = {};
    const errors = [];
    if (node.layoutMode === "NONE") {
      errors.push({
        nodeId: node.id,
        message: "Error @ ".concat(node.name, ' \u2013 LAYOUT value must be "horizontal", "vertical" or "grid".')
      });
    } else {
      properties[map[node.layoutMode]] = true;
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
    const fill = await readFill(node);
    const gap = await readGap(node);
    const layout = readLayout(node);
    const padding = await readPadding(node);
    const stroke = await readStroke(node);
    const errors = [
      ...alignment.errors,
      ...cornerRadius.errors,
      ...dimensions.errors,
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
      ...fill.warnings,
      ...gap.warnings,
      ...layout.warnings,
      ...padding.warnings,
      ...stroke.warnings
    ];
    return {
      properties: __spreadProps(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), alignment.properties), cornerRadius.properties), dimensions.properties), fill.properties), gap.properties), layout.properties), padding.properties), stroke.properties), {
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
        "flow-vertical": true,
        "width-fill": true,
        "height-fill": true,
        "alignment-top-left": true,
        children: node.children
      }),
      errors: [],
      warnings: [
        {
          nodeId: node.id,
          message: 'Notice @ "'.concat(node.name, '" \u2013 GROUP layers are automatically converted into frames. Consider using a frame instead.')
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
        properties["typography-".concat(textStyle.name)] = true;
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
      errors: [],
      warnings: [
        {
          nodeId: node.id,
          message: 'Notice @ "'.concat(node.name, '" \u2013 unknown layer type.')
        }
      ]
    };
  };

  // src/serialize/vector.ts
  var serializeVector = async (node) => {
    const dimensions = await readDimensions(node);
    const fill = await readFill(node);
    const errors = fill.errors;
    return {
      properties: __spreadValues(__spreadValues(__spreadValues({}, readIdentity(node)), dimensions.properties), fill.properties),
      errors,
      warnings: []
    };
  };

  // src/serialize/node.ts
  var shouldExcludeFromOutput = async (node, annotationCategories, getMainComponentCached) => {
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
          return serializeVector(node.children[1]);
        }
        if (node.children.length === 2 && ((_c = node.children[0]) == null ? void 0 : _c.type) === "VECTOR" && ((_d = node.children[1]) == null ? void 0 : _d.type) === "RECTANGLE") {
          return serializeVector(node.children[0]);
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
      if (children.length > 0 && !("OVERRIDE_ICON_NAME" in r2.properties) && !("OVERRIDE_TEXT_CONTENT" in r2.properties)) {
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
  figma.clientStorage.getAsync("pluginSize").then((size) => {
    if (size) {
      figma.ui.resize(size.w, size.h);
    }
  }).catch(() => {
  });
  figma.ui.onmessage = async (msg) => {
    var _a;
    if (msg.type === "resize" && msg.size) {
      figma.ui.resize(msg.size.w, msg.size.h);
      figma.clientStorage.setAsync("pluginSize", msg.size).catch(() => {
      });
      return;
    }
    if (msg.type === "toggleOutput") {
      showOutput = (_a = msg.showOutput) != null ? _a : true;
      runner();
      return;
    }
    const id = msg.selectNode;
    if (!id || id === "") return;
    const node = await figma.getNodeByIdAsync(id);
    if (node && "visible" in node) {
      figma.currentPage.selection = [node];
      figma.viewport.scrollAndZoomIntoView([node]);
    }
  };
  var runner = async () => {
    figma.ui.postMessage({
      output: "Working...",
      warnings: [],
      errors: []
    });
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
      const warnings = [];
      const errors = [];
      const json = await serializeNode(figma.currentPage.selection[0]);
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
      figma.ui.postMessage({
        output: showOutput ? renderComponentCode(json) : "",
        warnings,
        errors
      });
    } else {
      figma.ui.postMessage({
        output: placeholder,
        warnings: [],
        errors: []
      });
    }
  };
  figma.on("selectionchange", runner);
  figma.loadAllPagesAsync().then(() => {
    figma.on("documentchange", runner);
  });
})();
