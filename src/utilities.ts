import type { Hex, PropertiesAndIssues } from "./types"

const formatHexByte = (value: number): string => {
  const clamped = Math.max(0, Math.min(255, Math.round(value)))
  const hex = clamped.toString(16).toUpperCase()

  return hex.length === 1 ? `0${hex}` : hex
}

/**
 * A Figma color as a hex code.
 * @example convertRgbToHex({ r: 1, g: 0.5, b: 0 }) // "#FF8000"
 */
export const convertRgbToHex = (rgb: RGB): Hex =>
  `#${formatHexByte(rgb.r * 255)}${formatHexByte(rgb.g * 255)}${formatHexByte(rgb.b * 255)}`

const INDENT = " ".repeat(4)

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
  "typography-settings-",
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

  for (const [index, prefix] of PANEL_ORDER.entries()) {
    if (flag.startsWith(prefix) && prefix.length > length) {
      rank = index
      length = prefix.length
    }
  }

  return rank
}

const compareByPanelOrder = (a: string, b: string): number => getPanelRank(a) - getPanelRank(b) || a.localeCompare(b)

const SKIP_WRAPPER_TYPES = new Set(["INSTANCE", "COMPONENT", "SLOT"])

/** The boolean flags of a node, rendered one per line in its opening tag. */
const getFlagKeys = (properties: Record<string, unknown>): string[] =>
  Object.keys(properties).filter((key) => !META_KEYS.has(key) && properties[key] === true)

const formatOpenTag = (
  tag: string,
  properties: Record<string, unknown>,
  indentation: string,
  selfClosing: boolean,
): string => {
  const flags = getFlagKeys(properties).sort(compareByPanelOrder)
  const attributes = (STRING_PROP_KEYS[tag] ?? [])
    .filter((key) => typeof properties[key] === "string")
    .map((key) => `${key}="${properties[key]}"`)
  const keys = [...flags, ...attributes]

  if (keys.length === 0) return selfClosing ? `${indentation}<${tag} />` : `${indentation}<${tag}>`

  const lines = [
    `${indentation}<${tag}`,
    ...keys.map((key) => `${indentation}  ${key}`),
    selfClosing ? `${indentation}/>` : `${indentation}>`,
  ]

  return lines.join("\n")
}

/** An unsupported layer renders as `This`, a tag the library doesn't have, so it stands out as something to replace. */
const resolveTag = (properties: Record<string, unknown>): string => {
  if (properties.type === "TEXT") return "Text"
  if (properties.type === "VECTOR") return "Vector"
  if (properties.type === "FRAME" || properties.type === "GROUP") return "Frame"

  return "This"
}

const renderChildren = (children: PropertiesAndIssues[], indentation: string): string =>
  children
    .map((child) => renderNode(child, indentation))
    .filter((part) => part.length > 0)
    .join("\n")

const renderNode = (node: PropertiesAndIssues, indentation: string): string => {
  const { properties } = node

  if (properties.EXCLUDE_FROM_OUTPUT === true) return ""

  const tag = resolveTag(properties)
  const children = (properties.children as PropertiesAndIssues[] | undefined) ?? []
  const type = properties.type

  if (typeof type === "string" && SKIP_WRAPPER_TYPES.has(type)) return renderChildren(children, indentation)
  if (tag === "Frame" && getFlagKeys(properties).length === 0) return renderChildren(children, indentation)

  const selfClosing = tag === "Vector" || (tag === "This" && children.length === 0)
  const open = formatOpenTag(tag, properties, indentation, selfClosing)

  if (selfClosing) return open
  if (tag === "Text")
    return [open, `${indentation}${INDENT}${properties.characters}`, `${indentation}</Text>`].join("\n")

  const inner = renderChildren(children, `${indentation}${INDENT}`)

  return [open, ...(inner.length > 0 ? [inner] : []), `${indentation}</${tag}>`].join("\n")
}

export const renderComponentCode = (tree: PropertiesAndIssues): string => renderNode(tree, "")

/**
 * A Figma value as it reads in an Issues line: numbers to at most 2 decimals with their unit (pixels unless given),
 * enums in lower case.
 * @example formatValue(12.3456) // "12.35px"
 * @example formatValue(45, "deg") // "45deg"
 * @example formatValue("BOOLEAN_OPERATION") // "boolean operation"
 */
export const formatValue = (value: number | string, unit = "px"): string =>
  typeof value === "number" ? `${Math.round(value * 100) / 100}${unit}` : value.toLowerCase().replace(/_/g, " ")

const MAX_NAME_LENGTH = 15

/**
 * A layer name short enough for one Issues line: text layers are often named after their whole content.
 * @example truncateName("A very long paragraph of body copy") // "A very long par…"
 */
export const truncateName = (name: string): string =>
  name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH)}…` : name

/** Reads combined into one result, their issues kept in the order of the reads. */
export const combineReads = (reads: PropertiesAndIssues[]): PropertiesAndIssues => ({
  properties: Object.assign({}, ...reads.map((read) => read.properties)),
  errors: reads.flatMap((read) => read.errors),
  warnings: reads.flatMap((read) => read.warnings),
  notifications: reads.flatMap((read) => read.notifications ?? []),
})
