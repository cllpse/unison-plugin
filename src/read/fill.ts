import type { PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"
import { readPaint } from "./color"

export const readFill = async (node: SceneNode & MinimalFillsMixin): Promise<PropertiesErrorOrWarning> => {
  if (node.fills === figma.mixed) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, message: `${truncateName(node.name)} – FILL: mixed` }],
      warnings: [],
    }
  }

  return readPaint(node, "FILL", node.fills[0])
}
