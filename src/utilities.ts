import type { HEX, PropertiesErrorOrWarning } from "./types"

const toHex = (n: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(n)))
  const hex = clamped.toString(16).toUpperCase()

  return hex.length === 1 ? `0${hex}` : hex
}

export const RGBToHEX = (rgb: RGB): HEX => `#${toHex(rgb.r * 255)}${toHex(rgb.g * 255)}${toHex(rgb.b * 255)}`

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
  "typography-",
  "typography-align-",
  "typography-decoration-",
  "fill-",
  "fill-hover-",
  "stroke-",
  "stroke-style-",
  "stroke-hover-",
  "effect-",
]

const getPanelRank = (flag: string): number => {
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

const compareByPanelOrder = (a: string, b: string): number => getPanelRank(a) - getPanelRank(b) || a.localeCompare(b)

const SKIP_WRAPPER_TYPES = new Set(["INSTANCE", "COMPONENT", "SLOT"])

/** The boolean flags of a node, rendered one per line in its opening tag. */
const getFlagKeys = (properties: Record<string, unknown>): string[] =>
  Object.keys(properties).filter((k) => !META_KEYS.has(k) && properties[k] === true)

const formatOpenTag = (
  tag: string,
  properties: Record<string, unknown>,
  indentation: string,
  selfClosing: boolean,
): string => {
  const flags = getFlagKeys(properties).sort(compareByPanelOrder)
  const attributes = (STRING_PROP_KEYS[tag] ?? [])
    .filter((k) => typeof properties[k] === "string")
    .map((k) => `${k}="${properties[k]}"`)
  const keys = [...flags, ...attributes]

  if (keys.length === 0) return selfClosing ? `${indentation}<${tag} />` : `${indentation}<${tag}>`

  const lines = [
    `${indentation}<${tag}`,
    ...keys.map((k) => `${indentation}  ${k}`),
    selfClosing ? `${indentation}/>` : `${indentation}>`,
  ]

  return lines.join("\n")
}

const resolveTag = (properties: Record<string, unknown>): string => {
  if (properties.type === "TEXT") return "Text"
  if (properties.type === "VECTOR") return "Vector"

  return "Frame"
}

const renderChildren = (children: PropertiesErrorOrWarning[], indentation: string): string =>
  children
    .map((child) => renderNode(child, indentation))
    .filter((part) => part.length > 0)
    .join("\n")

const renderNode = (node: PropertiesErrorOrWarning, indentation: string): string => {
  const { properties } = node

  if (properties.EXCLUDE_FROM_OUTPUT === true) return ""

  const tag = resolveTag(properties)
  const children = (properties.children as PropertiesErrorOrWarning[] | undefined) ?? []
  const type = properties.type

  if (typeof type === "string" && SKIP_WRAPPER_TYPES.has(type)) return renderChildren(children, indentation)
  if (tag === "Frame" && getFlagKeys(properties).length === 0) return renderChildren(children, indentation)

  const selfClosing = tag === "Vector"
  const open = formatOpenTag(tag, properties, indentation, selfClosing)

  if (selfClosing) return open
  if (tag === "Text")
    return [open, `${indentation}${INDENT}${properties.characters}`, `${indentation}</Text>`].join("\n")

  const inner = renderChildren(children, `${indentation}${INDENT}`)

  return [open, ...(inner.length > 0 ? [inner] : []), `${indentation}</${tag}>`].join("\n")
}

export const renderComponentCode = (json: PropertiesErrorOrWarning): string => renderNode(json, "")

const MAX_NAME_LENGTH = 15

/**
 * A layer name short enough for one Issues line: text layers are often named after their whole content.
 * @example truncateName("A very long paragraph of body copy") // "A very long par…"
 */
export const truncateName = (name: string): string =>
  name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH)}…` : name
