import { readIdentity } from "../read/identity"
import type { PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"

export const serializeGroup = (node: GroupNode): PropertiesErrorOrWarning => {
  return {
    properties: {
      ...readIdentity(node),

      "autolayout-vertical": true,
      "width-fill": true,
      "height-fill": true,
      "alignment-top-left": true,

      children: node.children,
    },

    errors: [],
    warnings: [
      {
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "GROUP",
        problem: "converted to frame",
      },
    ],
  }
}
