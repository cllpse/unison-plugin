import type { PropertiesAndIssues } from "../types"
import { truncateName } from "../utilities"
import { readPaints } from "./color"

export const readFill = async (node: SceneNode & MinimalFillsMixin): Promise<PropertiesAndIssues> => {
  if (node.fills === figma.mixed) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "FILL",
          problem: "mixed",
          explanation: "Parts of the text differ, so the fill is left out.",
        },
      ],
      warnings: [],
    }
  }

  return readPaints(node, "FILL", node.fills)
}
