import { COLORS, CONTAINERS, RADIUS, SHADOWS, SPACING, TEXT_SIZES } from "../unison-components/dist/design-tokens"
import { SIZE_MODES } from "../unison-components/maps"
import type { FigmaFrameHeight, FigmaFrameWidth } from "../unison-components/types/figma"

/**
 * The token a variable or style name stands for: the name is the token's prefix plus one of its keys.
 * @example matchToken("radius-2xl", "radius-", RADIUS_TOKENS) // "2xl"
 */
const matchToken = (name: string | undefined, prefix: string, tokens: Set<string>): string | undefined => {
  if (name === undefined || !name.startsWith(prefix)) return undefined

  const token = name.slice(prefix.length)

  return tokens.has(token) ? token : undefined
}

const COLOR_TOKENS = new Set<string>()

for (const [name, value] of Object.entries(COLORS)) {
  if (typeof value === "string") {
    COLOR_TOKENS.add(name)

    continue
  }

  for (const shade of Object.keys(value)) {
    COLOR_TOKENS.add(`${name}-${shade}`)
  }
}

const SPACING_TOKENS = new Set<string>(Object.keys(SPACING))

const RADIUS_TOKENS = new Set<string>(Object.keys(RADIUS))

const CONTAINER_TOKENS = new Set<string>(Object.keys(CONTAINERS))

const SHADOW_TOKENS = new Set<string>(["none", ...SHADOWS])

const TEXT_SIZE_TOKENS = new Set<string>(TEXT_SIZES)

/**
 * Resolve a color variable to its color token.
 * @example resolveColorToken("fill-red-500") // "red-500"
 */
export const resolveColorToken = (variableName: string | undefined): string | undefined =>
  matchToken(variableName, "fill-", COLOR_TOKENS)

/**
 * Resolve a spacing variable to its spacing token.
 * @example resolveSpacingToken("spacing-0p5") // "0p5"
 */
export const resolveSpacingToken = (variableName: string | undefined): string | undefined =>
  matchToken(variableName, "spacing-", SPACING_TOKENS)

/**
 * Resolve a radius variable to its Tailwind radius name.
 * @example resolveRadiusToken("radius-lg") // "lg"
 */
export const resolveRadiusToken = (variableName: string | undefined): string | undefined =>
  matchToken(variableName, "radius-", RADIUS_TOKENS)

/**
 * Resolve a width variable to its name on Tailwind's container scale.
 * @example resolveContainerToken("container-md") // "md"
 */
export const resolveContainerToken = (variableName: string | undefined): string | undefined =>
  matchToken(variableName, "container-", CONTAINER_TOKENS)

/**
 * Resolve an effect style name to a shadow token.
 * @example resolveShadowToken("shadow-md") // "md"
 */
export const resolveShadowToken = (styleName: string): string | undefined =>
  matchToken(styleName, "shadow-", SHADOW_TOKENS)

/**
 * Resolve a text style name to a text size.
 * @example resolveTextSizeToken("text-sm") // "sm"
 */
export const resolveTextSizeToken = (styleName: string): string | undefined =>
  matchToken(styleName, "text-", TEXT_SIZE_TOKENS)

const buildSizingMap = <ClassName extends string>(prefix: string): Record<string, ClassName> => {
  const map: Record<string, ClassName> = {}

  for (const mode of SIZE_MODES) {
    map[mode.toUpperCase()] = `${prefix}${mode}` as ClassName
  }

  return map
}

export const WIDTH_SIZING = buildSizingMap<keyof FigmaFrameWidth>("width-")

export const HEIGHT_SIZING = buildSizingMap<keyof FigmaFrameHeight>("height-")
