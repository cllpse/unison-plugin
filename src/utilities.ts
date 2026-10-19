import type { HEX, PropertiesErrorOrWarning } from "./types"

const _toHex = (n: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(n)))
  const hex = clamped.toString(16).toUpperCase()

  return hex.length === 1 ? `0${hex}` : hex
}

export const RGBToHEX = (rgb: RGB): HEX => {
  const scale = rgb.r <= 1 && rgb.g <= 1 && rgb.b <= 1 ? 255 : 1

  return `#${_toHex(rgb.r * scale)}${_toHex(rgb.g * scale)}${_toHex(rgb.b * scale)}`
}

const INDENT = ` `.repeat(4)

const META_KEYS = new Set(["id", "type", "name", "children", "characters"])

/** String props rendered as `key="value"` attributes, in this order, after the boolean flags. */
const STRING_PROP_KEYS: Record<string, string[]> = {
  Vector: ["path", "viewBox", "fillRule"],
}

/**
 * Flag prefixes in the order their settings appear in Figma's right panel: layout (direction, size, alignment, gap,
 * padding), appearance (corner radius), typography, fill, stroke, effects. A flag ranks by its longest matching prefix;
 * flags of the same rank sort alphabetically, and unknown flags go last.
 */
const PANEL_ORDER = [
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
  "effect-",
]

const _panelRank = (flag: string): number => {
  let rank = PANEL_ORDER.length
  let length = 0

  for (const [i, prefix] of PANEL_ORDER.entries()) {
    if (flag.startsWith(prefix) && prefix.length > length) {
      rank = i
      length = prefix.length
    }
  }

  return rank
}

const _byPanelOrder = (a: string, b: string): number => _panelRank(a) - _panelRank(b) || a.localeCompare(b)

const SKIP_WRAPPER_TYPES = new Set(["INSTANCE", "COMPONENT", "SLOT"])

const _booleanPropKeys = (properties: Record<string, unknown>): string[] =>
  Object.keys(properties).filter((k) => !META_KEYS.has(k) && !k.startsWith("OVERRIDE_") && properties[k] === true)

/** Opening-tag lines: boolean flags, plus `type-frame` / `type-instance` / etc. from Figma `properties.type`. */
const _openTagPropKeys = (tag: string, properties: Record<string, unknown>): string[] => {
  const keys = _booleanPropKeys(properties)
  if (tag !== "Frame") {
    return keys
  }
  const t = properties.type
  if (typeof t !== "string" || t.length === 0) {
    return keys
  }
  const typeKey = `type-${t.toLowerCase().replace(/_/g, "-")}`
  const rest = keys.filter((k) => k !== typeKey)
  return [...rest]
}

const _formatOpenTag = (
  tag: string,
  properties: Record<string, unknown>,
  indentation: string,
  selfClosing: boolean,
): string => {
  const flags = _openTagPropKeys(tag, properties).sort(_byPanelOrder)
  const attributes = (STRING_PROP_KEYS[tag] ?? [])
    .filter((k) => typeof properties[k] === "string")
    .map((k) => `${k}="${properties[k]}"`)
  const keys = [...flags, ...attributes]

  if (keys.length === 0) {
    return selfClosing ? `${indentation}<${tag} />` : `${indentation}<${tag}>`
  }

  const lines: string[] = [`${indentation}<${tag}`]
  for (const k of keys) {
    lines.push(`${indentation}  ${k}`)
  }
  lines.push(selfClosing ? `${indentation}/>` : `${indentation}>`)
  return lines.join("\n")
}

const _resolveTag = (properties: Record<string, unknown>): string => {
  if (properties.type === "TEXT") return "Text"
  if (properties.type === "VECTOR") return "Vector"
  if (properties.type === "ELLIPSE") return "Ellipse"
  if (properties.type === "RECTANGLE") return "Rectangle"

  return "Frame"
}

const _renderComponentNode = (node: PropertiesErrorOrWarning, indentation: string): string => {
  const { properties } = node

  if ("EXCLUDE_FROM_OUTPUT" in properties && properties.EXCLUDE_FROM_OUTPUT === true) {
    return ""
  }

  const tag = _resolveTag(properties)
  const children = Array.isArray(properties.children) ? (properties.children as PropertiesErrorOrWarning[]) : []

  const t = properties.type
  if (typeof t === "string" && SKIP_WRAPPER_TYPES.has(t)) {
    if (children.length === 0) {
      return ""
    }
    const [first, ...rest] = children
    // const mergedFirst = _mergeSkippedWrapperIntoFirstChild(node, first)
    const parts: string[] = [_renderComponentNode(first, indentation)]
    for (const child of rest) {
      parts.push(_renderComponentNode(child, indentation))
    }
    return parts.filter((p) => p.length > 0).join("\n")
  }

  const keys = _openTagPropKeys(tag, properties)

  if (tag === "Frame" && keys.length === 0) {
    if (children.length === 0) {
      return ""
    }
    const parts: string[] = []
    for (const child of children) {
      parts.push(_renderComponentNode(child, indentation))
    }
    return parts.filter((p) => p.length > 0).join("\n")
  }

  const selfClosing = tag === "Ellipse" || tag === "Rectangle" || tag === "Vector"

  const open = _formatOpenTag(tag, properties, indentation, selfClosing)

  if (selfClosing) {
    return open
  }

  if (tag === "Text") {
    return [open, `${indentation}${INDENT}${properties.characters}`, `${indentation}</Text>`].join("\n")
  }

  const parts: string[] = [open]

  for (const child of children) {
    parts.push(_renderComponentNode(child, `${indentation}${INDENT}`))
  }

  parts.push(`${indentation}</${tag}>`)
  return parts.join("\n")
}

export const renderComponentCode = (json: PropertiesErrorOrWarning): string => _renderComponentNode(json, "")

export const isHEX = (value: string): boolean => value.startsWith("#")
