import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundPaintColor } from "./color"

export const readFill = async (node: SceneNode & MinimalFillsMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []
  const warnings: ErrorOrWarning[] = []

  if (node.fills === figma.mixed) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – FILL mixed values are not supported.`,
    })
  } else if (node.fills[0]) {
    const fill = node.fills?.[0] as unknown as SolidPaint
    const type = fill.type
    const visible = fill.visible

    if (type !== "SOLID") {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – FILL only solid fill values are supported.`,
      })
    } else {
      if (typeof fill.boundVariables?.color === "undefined") {
        errors.push({
          nodeId: node.id,
          message: `Error @ ${node.name} – FILL value is not bound to a variable.`,
        })
      } else {
        if (!visible) {
          warnings.push({
            nodeId: node.id,
            message: `Notice @ ${node.name} – FILL is hidden.`,
          })
        } else {
          const { className, label } = await resolveBoundPaintColor("fill-", fill)

          if (className) {
            properties[className] = true
          } else {
            errors.push({
              nodeId: node.id,
              message: `Error @ ${node.name} – FILL color "${label}" is not a known color.`,
            })
          }
        }
      }
    }
  }

  return { properties, errors, warnings }
}
