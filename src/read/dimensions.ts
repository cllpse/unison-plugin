import { mapHeight, mapWidth } from "../maps"
import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundUnitClass } from "./unit"

export const readDimensions = async (node: SceneNode & LayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (node.type !== "VECTOR") {
    const layoutSizingHorizontal = node.layoutSizingHorizontal
    const layoutSizingVertical = node.layoutSizingVertical

    if (node.layoutSizingHorizontal === "FIXED") {
      if (node.boundVariables?.width) {
        const className = await resolveBoundUnitClass("width-", node.boundVariables.width, node.width)

        if (className) {
          properties[className] = true
        }
      } else {
        errors.push({
          nodeId: node.id,
          message: `Error @ ${node.name} – WIDTH value is not bound to a variable.`,
        })
      }
    } else if (layoutSizingHorizontal !== "FILL" && layoutSizingHorizontal !== "HUG") {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – WIDTH value must be "fill" or "hug".`,
      })
    } else {
      properties[mapWidth[layoutSizingHorizontal]] = true
    }

    if (node.layoutSizingVertical === "FIXED") {
      if (node.boundVariables?.height) {
        const className = await resolveBoundUnitClass("height-", node.boundVariables.height, node.height)

        if (className) {
          properties[className] = true
        }
      } else {
        errors.push({
          nodeId: node.id,
          message: `Error @ ${node.name} – HEIGHT value is not bound to a variable.`,
        })
      }
    } else if (layoutSizingVertical !== "FILL" && layoutSizingVertical !== "HUG") {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – HEIGHT value must be "fill" or "hug".`,
      })
    } else {
      properties[mapHeight[layoutSizingVertical]] = true
    }
  }

  return { properties, errors, warnings: [] }
}
