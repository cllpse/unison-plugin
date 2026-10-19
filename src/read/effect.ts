import { resolveShadowToken } from "../maps"
import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"

// A shadow has several values (offset, blur, spread, color), so it can't be bound to one variable. It is named by its
// effect style instead (`shadow/md`, `shadow/small`), the same way a Text is named by its text style.
export const readEffect = async (node: SceneNode & BlendMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []
  const warnings: ErrorOrWarning[] = []

  const visible = node.effects.filter((effect) => effect.visible)

  if (visible.length === 0) {
    return { properties, errors, warnings }
  }

  if (node.effectStyleId === "") {
    warnings.push({
      nodeId: node.id,
      message: `Notice @ ${node.name} – EFFECT is not bound to an effect style and is skipped.`,
    })

    return { properties, errors, warnings }
  }

  const style = await figma.getStyleByIdAsync(node.effectStyleId)
  const token = style ? resolveShadowToken(style.name) : undefined

  if (token === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – EFFECT style "${style?.name ?? node.effectStyleId}" does not match a shadow token.`,
    })
  } else {
    properties[`effect-shadow-${token}`] = true
  }

  return { properties, errors, warnings }
}
