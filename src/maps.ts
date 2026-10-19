import { COLORS } from "../unison-components/src/constants/colors"
import { CONTAINERS, RADII, SHADOWS, UNITS, UNITS_FIGMA } from "../unison-components/src/constants/units"
import type {
  FigmaFill,
  FigmaFrameGap,
  FigmaFrameHeight,
  FigmaFrameWidth,
  FigmaPadding,
  FigmaPaddingBottom,
  FigmaPaddingHorizontal,
  FigmaPaddingLeft,
  FigmaPaddingRight,
  FigmaPaddingTop,
  FigmaPaddingVertical,
  FigmaStroke,
} from "../unison-components/src/types/figmaProperties"
import type { HEX } from "./types"
import { isHEX } from "./utilities"

const isRgbHex = (value: string): value is HEX => isHEX(value) && value.length === 7

const COLOR_TOKENS = new Set<string>()
const HEX_OWNERS = new Map<string, string[]>()

const addHexOwner = (hex: string, token: string) => {
  const owners = HEX_OWNERS.get(hex)

  if (owners) {
    owners.push(token)
    return
  }

  HEX_OWNERS.set(hex, [token])
}

for (const [name, value] of Object.entries(COLORS)) {
  if (typeof value === "string") {
    COLOR_TOKENS.add(name)

    if (isRgbHex(value)) {
      addHexOwner(value, name)
    }

    continue
  }

  for (const [shade, hex] of Object.entries(value) as [string, string][]) {
    COLOR_TOKENS.add(`${name}-${shade}`)

    if (isRgbHex(hex)) {
      addHexOwner(hex, `${name}-${shade}`)
    }
  }
}

const UNIQUE_HEX_TO_TOKEN: Record<string, string> = {}

for (const [hex, tokens] of HEX_OWNERS) {
  if (tokens.length === 1) {
    UNIQUE_HEX_TO_TOKEN[hex] = tokens[0]
  }
}

const normalizeColorName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/\//g, "-")

export const resolveColorToken = (variableName: string | undefined, hex?: HEX): string | undefined => {
  if (variableName) {
    const candidate = normalizeColorName(variableName)

    if (COLOR_TOKENS.has(candidate)) {
      return candidate
    }

    const parts = candidate.split("-")

    for (let i = 1; i < parts.length; i++) {
      const suffix = parts.slice(i).join("-")

      if (COLOR_TOKENS.has(suffix)) {
        return suffix
      }
    }
  }

  if (hex && UNIQUE_HEX_TO_TOKEN[hex]) {
    return UNIQUE_HEX_TO_TOKEN[hex]
  }

  return undefined
}

const buildColorMap = <ClassName extends string>(prefix: string): Record<HEX, ClassName> => {
  const map: Record<string, ClassName> = {}

  for (const [hex, token] of Object.entries(UNIQUE_HEX_TO_TOKEN)) {
    map[hex] = `${prefix}${token}` as ClassName
  }

  return map as Record<HEX, ClassName>
}

export const resolveColorClass = <ClassName extends string>(
  prefix: string,
  variableName: string | undefined,
  hex: HEX,
): ClassName | undefined => {
  const token = resolveColorToken(variableName, hex)

  return token ? (`${prefix}${token}` as ClassName) : undefined
}

export const mapStrokeColor = buildColorMap<keyof FigmaStroke>("stroke-")

export const mapFillColor = buildColorMap<keyof FigmaFill>("fill-")

const UNIT_TOKENS = new Set([...Object.keys(UNITS), ...Object.keys(UNITS_FIGMA)])

const PIXEL_TO_TOKEN: Record<number, string> = {}

for (const [unit, pixels] of Object.entries({ ...UNITS, ...UNITS_FIGMA })) {
  if (typeof pixels !== "number") {
    continue
  }

  PIXEL_TO_TOKEN[pixels] = unit
}

const normalizeUnitName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/(\d)\.(\d)/g, "$1p$2")
    .replace(/\//g, "-")
    .replace(/^05$/, "0p5")
    .replace(/-05$/, "-0p5")
    .replace(/(^|-)1px$/, "$1px")

export const resolveUnitToken = (variableName: string | undefined, pixels?: number): string | undefined => {
  if (variableName) {
    const candidate = normalizeUnitName(variableName)

    if (UNIT_TOKENS.has(candidate)) {
      return candidate
    }

    const parts = candidate.split("-")

    for (let i = 1; i < parts.length; i++) {
      const suffix = parts.slice(i).join("-")

      if (UNIT_TOKENS.has(suffix)) {
        return suffix
      }
    }
  }

  if (pixels !== undefined && PIXEL_TO_TOKEN[pixels]) {
    return PIXEL_TO_TOKEN[pixels]
  }

  return undefined
}

export const resolveUnitClass = (
  prefix: string,
  variableName: string | undefined,
  pixels: number,
): string | undefined => {
  const token = resolveUnitToken(variableName, pixels)

  return token ? `${prefix}${token}` : undefined
}

const buildUnitMap = <ClassName extends string>(prefix: string): Record<number, ClassName> => {
  const map: Record<number, ClassName> = {}

  for (const [pixels, token] of Object.entries(PIXEL_TO_TOKEN)) {
    map[Number(pixels)] = `${prefix}${token}` as ClassName
  }

  return map
}

const buildSizingMap = <ClassName extends string>(prefix: string): Record<string, ClassName> => {
  const map: Record<string, ClassName> = {}

  for (const [unit, pixels] of Object.entries({ ...UNITS, ...UNITS_FIGMA })) {
    if (typeof pixels === "number") {
      continue
    }

    map[unit.toUpperCase()] = `${prefix}${unit}` as ClassName
  }

  return map
}

export const mapAbsoluteWidth = buildUnitMap<keyof FigmaFrameWidth>("width-")

export const mapAbsoluteHeight = buildUnitMap<keyof FigmaFrameHeight>("height-")

export const mapWidth = buildSizingMap<keyof FigmaFrameWidth>("width-")

export const mapHeight = buildSizingMap<keyof FigmaFrameHeight>("height-")

export const mapGap = buildUnitMap<keyof FigmaFrameGap>("gap-")

export const mapPadding = buildUnitMap<keyof FigmaPadding>("padding-")

export const mapPaddingVertical = buildUnitMap<keyof FigmaPaddingVertical>("padding-vertical-")

export const mapPaddingHorizontal = buildUnitMap<keyof FigmaPaddingHorizontal>("padding-horizontal-")

export const mapPaddingLeft = buildUnitMap<keyof FigmaPaddingLeft>("padding-left-")

export const mapPaddingRight = buildUnitMap<keyof FigmaPaddingRight>("padding-right-")

export const mapPaddingTop = buildUnitMap<keyof FigmaPaddingTop>("padding-top-")

export const mapPaddingBottom = buildUnitMap<keyof FigmaPaddingBottom>("padding-bottom-")

const RADIUS_TOKENS = new Set<string>(Object.keys(RADII))

const PIXEL_TO_RADIUS: Record<number, string> = {}

for (const [name, pixels] of Object.entries(RADII)) {
  PIXEL_TO_RADIUS[pixels] = name
}

/**
 * Match the last part of a variable name against a token set, longest first.
 * @example matchTokenSuffix("radius-2xl", RADIUS_TOKENS) // "2xl"
 */
const matchTokenSuffix = (candidate: string, tokens: Set<string>): string | undefined => {
  if (tokens.has(candidate)) {
    return candidate
  }

  const parts = candidate.split("-")

  for (let i = 1; i < parts.length; i++) {
    const suffix = parts.slice(i).join("-")

    if (tokens.has(suffix)) {
      return suffix
    }
  }

  return undefined
}

const normalizeStyleName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, "").replace(/_/g, "-").replace(/\//g, "-")

/**
 * Resolve a corner radius to a Tailwind radius name: by the bound variable's name (`radius/lg`), else by its pixel
 * value, so radii still bound to spacing variables (`spacing/2`, 8px) resolve to `lg`.
 */
export const resolveRadiusToken = (variableName: string | undefined, pixels?: number): string | undefined => {
  const named = variableName ? matchTokenSuffix(normalizeStyleName(variableName), RADIUS_TOKENS) : undefined

  if (named) {
    return named
  }

  return pixels !== undefined ? PIXEL_TO_RADIUS[pixels] : undefined
}

/**
 * Resolve a width variable named for Tailwind's container scale (`container-md`, `unison-container/md`) to its name.
 * Only the name counts: container pixel values overlap the spacing scale (256px is also `64`).
 */
export const resolveContainerToken = (variableName: string | undefined): string | undefined => {
  const [, key] = normalizeStyleName(variableName ?? "").match(/(?:^|-)container-(.+)$/) ?? []

  return key !== undefined && key in CONTAINERS ? key : undefined
}

const SHADOW_TOKENS = new Set<string>(["none", "small", "large", ...SHADOWS])

/**
 * Resolve an effect style name to a shadow token.
 * @example resolveShadowToken("Shadow/MD") // "md"
 */
export const resolveShadowToken = (styleName: string): string | undefined =>
  matchTokenSuffix(normalizeStyleName(styleName), SHADOW_TOKENS)
