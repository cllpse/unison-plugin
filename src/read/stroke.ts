import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundPaintColor } from "./color"

export const readStroke = async (node: SceneNode & MinimalStrokesMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []
  const warnings: ErrorOrWarning[] = []

  if (node.strokes?.length > 1) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – STROKE mixed values are not supported.`,
    })
  } else if (node.strokes[0]) {
    const stroke = node.strokes?.[0] as unknown as SolidPaint
    const type = stroke.type
    const visible = stroke.visible

    if (type !== "SOLID") {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – STROKE only solid stroke values are supported.`,
      })
    } else {
      if (typeof stroke.boundVariables?.color === "undefined") {
        errors.push({
          nodeId: node.id,
          message: `Error @ ${node.name} – STROKE value is not bound to a variable.`,
        })
      } else {
        if (!visible) {
          warnings.push({
            nodeId: node.id,
            message: `Notice @ ${node.name} – STROKE is hidden.`,
          })
        } else {
          const { className, label } = await resolveBoundPaintColor("stroke-", stroke)

          if (className) {
            properties[className] = true
          } else {
            errors.push({
              nodeId: node.id,
              message: `Error @ ${node.name} – STROKE color "${label}" is not a known color.`,
            })
          }
        }
      }
    }
  }

  return { properties, errors, warnings }
}
