import { resolveShadowToken } from "../maps"
import type { PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"

// A shadow has several values (offset, blur, spread, color), so it can't be bound to one variable. It is named by its
// effect style instead (`shadow-md`), the same way a Text is named by its text style.
export const readEffect = async (node: SceneNode & BlendMixin): Promise<PropertiesErrorOrWarning> => {
  if (!node.effects.some((effect) => effect.visible)) return { properties: {}, errors: [], warnings: [] }

  if (node.effectStyleId === "") {
    return {
      properties: {},
      errors: [],
      warnings: [{ nodeId: node.id, message: `${truncateName(node.name)} – EFFECT: not bound, skipped` }],
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
          message: `${truncateName(node.name)} – EFFECT: not a token (${style?.name ?? node.effectStyleId})`,
        },
      ],
      warnings: [],
    }
  }

  return { properties: { [`effect-shadow-${token}`]: true }, errors: [], warnings: [] }
}
