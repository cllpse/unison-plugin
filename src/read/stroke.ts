import type { PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"
import { readPaint } from "./color"

export const readStroke = async (node: SceneNode & MinimalStrokesMixin): Promise<PropertiesErrorOrWarning> => {
  if (node.strokes.length > 1) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "STROKE", problem: "mixed" }],
      warnings: [],
    }
  }

  return readPaint(node, "STROKE", node.strokes[0])
}
