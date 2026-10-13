import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundUnitClass } from "./unit"

const hasDiscreteCorners = (node: SceneNode & CornerMixin): node is SceneNode & CornerMixin & RectangleCornerMixin =>
  "topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node

const readDiscreteCorner = async (
  node: SceneNode,
  value: number,
  bound: VariableAlias | undefined,
  prefix: string,
  label: string,
  properties: Properties,
  errors: ErrorOrWarning[],
) => {
  if (value <= 0) {
    return
  }

  if (bound === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – CORNER RADIUS ${label} value is not bound to a variable.`,
    })

    return
  }

  const className = await resolveBoundUnitClass(prefix, bound, value)

  if (className) {
    properties[className] = true
  }
}

export const readCornerRadius = async (node: SceneNode & CornerMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (node.cornerRadius === figma.mixed) {
    if (!hasDiscreteCorners(node)) {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – CORNER RADIUS values cannot be mixed.`,
      })
    } else {
      await readDiscreteCorner(
        node,
        node.topLeftRadius,
        node.boundVariables?.topLeftRadius,
        "corner-radius-top-left-",
        "top left",
        properties,
        errors,
      )
      await readDiscreteCorner(
        node,
        node.topRightRadius,
        node.boundVariables?.topRightRadius,
        "corner-radius-top-right-",
        "top right",
        properties,
        errors,
      )
      await readDiscreteCorner(
        node,
        node.bottomLeftRadius,
        node.boundVariables?.bottomLeftRadius,
        "corner-radius-bottom-left-",
        "bottom left",
        properties,
        errors,
      )
      await readDiscreteCorner(
        node,
        node.bottomRightRadius,
        node.boundVariables?.bottomRightRadius,
        "corner-radius-bottom-right-",
        "bottom right",
        properties,
        errors,
      )
    }
  } else if (node.cornerRadius > 0) {
    if (
      [
        node.boundVariables?.topLeftRadius,
        node.boundVariables?.topRightRadius,
        node.boundVariables?.bottomLeftRadius,
        node.boundVariables?.bottomRightRadius,
      ].includes(undefined)
    ) {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – CORNER RADIUS value is not bound to a variable.`,
      })
    } else {
      const className = await resolveBoundUnitClass(
        "corner-radius-",
        node.boundVariables?.topLeftRadius,
        node.cornerRadius,
      )

      if (className) {
        properties[className] = true
      }
    }
  }

  return { properties, errors, warnings: [] }
}
