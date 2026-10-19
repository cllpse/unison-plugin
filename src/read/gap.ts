import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundUnitClass } from "./unit"

export const readGap = async (node: SceneNode & AutoLayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (node.itemSpacing > 0) {
    if (node.itemSpacing === 1) {
      properties["gap-px"] = true
    } else if (node.boundVariables?.itemSpacing === undefined && node.itemSpacing !== 1) {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – GAP value is not bound to a variable.`,
      })
    } else {
      const className = await resolveBoundUnitClass("gap-", node.boundVariables?.itemSpacing, node.itemSpacing)

      if (className) {
        properties[className] = true
      }
    }
  }

  return { properties, errors, warnings: [] }
}
