import { COLORS } from "../figma/src/constants/colors"
import { FIGMA_UNITS } from "../figma/src/constants/figmaUnits"
import { UNITS } from "../figma/src/constants/units"
import type {
  FigmaFill,
  FigmaFrameCornerRadius,
  FigmaFrameCornerRadiusBottomLeft,
  FigmaFrameCornerRadiusBottomRight,
  FigmaFrameCornerRadiusTopLeft,
  FigmaFrameCornerRadiusTopRight,
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
} from "../figma/src/types/FigmaProperties"
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

  const paletteHexes = new Set<string>()

  for (const [shade, hex] of Object.entries(value)) {
    COLOR_TOKENS.add(`${name}-${shade}`)

    if (shade === "0" || shade === "brand" || !isRgbHex(hex)) {
      continue
    }

    addHexOwner(hex, `${name}-${shade}`)
    paletteHexes.add(hex)
  }

  if (isRgbHex(value.brand) && !paletteHexes.has(value.brand)) {
    addHexOwner(value.brand, `${name}-brand`)
  }
}

const UNIQUE_HEX_TO_TOKEN: Record<string, string> = {}

for (const [hex, tokens] of HEX_OWNERS) {
  if (tokens.length === 1) {
    UNIQUE_HEX_TO_TOKEN[hex] = tokens[0]
  }
}

const normalizeColorName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/_/g, "-")
    .replace(/\//g, "-")
    .replace(/neutral-surface/g, "neutralsurface")

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

/** `05` is a deprecated alias of `0p5` (both 2px). Prefer the new token. */
const DEPRECATED_UNITS = new Set(["05"])

const UNIT_TOKENS = new Set(
  [...Object.keys(UNITS), ...Object.keys(FIGMA_UNITS)].filter((unit) => !DEPRECATED_UNITS.has(unit)),
)

const PIXEL_TO_TOKEN: Record<number, string> = {}

for (const [unit, pixels] of Object.entries({ ...UNITS, ...FIGMA_UNITS })) {
  if (typeof pixels !== "number" || DEPRECATED_UNITS.has(unit)) {
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

  for (const [unit, pixels] of Object.entries({ ...UNITS, ...FIGMA_UNITS })) {
    if (typeof pixels === "number") {
      continue
    }

    map[unit.toUpperCase()] = `${prefix}${unit}` as ClassName
  }

  return map
}

export const mapCornerRadius = buildUnitMap<keyof FigmaFrameCornerRadius>("corner-radius-")

export const mapCornerRadiusTopLeft = buildUnitMap<keyof FigmaFrameCornerRadiusTopLeft>("corner-radius-top-left-")

export const mapCornerRadiusTopRight = buildUnitMap<keyof FigmaFrameCornerRadiusTopRight>("corner-radius-top-right-")

export const mapCornerRadiusBottomLeft =
  buildUnitMap<keyof FigmaFrameCornerRadiusBottomLeft>("corner-radius-bottom-left-")

export const mapCornerRadiusBottomRight =
  buildUnitMap<keyof FigmaFrameCornerRadiusBottomRight>("corner-radius-bottom-right-")

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
