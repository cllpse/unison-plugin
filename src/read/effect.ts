import { resolveShadowToken } from "../maps"
import type { PropertiesErrorOrWarning } from "../types"
import { formatValue, truncateName } from "../utilities"

// A shadow has several values (offset, blur, spread, color), so it can't be bound to one variable. It is named by its
// effect style instead (`shadow-md`), the same way a Text is named by its text style.
export const readEffect = async (node: SceneNode & BlendMixin): Promise<PropertiesErrorOrWarning> => {
  if (!node.effects.some((effect) => effect.visible)) return { properties: {}, errors: [], warnings: [] }

  if (node.effectStyleId === "") {
    return {
      properties: {},
      errors: [],
      warnings: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "EFFECT",
          problem: "not bound, skipped",
          value: formatValue(node.effects.find((effect) => effect.visible)?.type ?? ""),
        },
      ],
    }
  }

  const style = await figma.getStyleByIdAsync(node.effectStyleId)
  const token = style ? resolveShadowToken(style.name) : undefined

  if (token === undefined) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "EFFECT",
          problem: "not a token",
          value: style?.name ?? node.effectStyleId,
        },
      ],
      warnings: [],
    }
  }

  return { properties: { [`effect-shadow-${token}`]: true }, errors: [], warnings: [] }
}
