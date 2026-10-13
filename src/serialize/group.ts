import { readIdentity } from "../read/identity"
import type { PropertiesErrorOrWarning } from "../types"

export const serializeGroup = (node: GroupNode): PropertiesErrorOrWarning => {
  return {
    properties: {
      ...readIdentity(node),

      "flow-vertical": true,
      "width-fill": true,
      "height-fill": true,
      "alignment-top-left": true,

      children: node.children,
    },

    errors: [],
    warnings: [
      {
        nodeId: node.id,
        message: `Notice @ "${node.name}" – GROUP layers are automatically converted into frames. Consider using a frame instead.`,
      },
    ],
  }
}
