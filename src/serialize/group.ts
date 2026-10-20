import { readIdentity } from "../read/identity"
import type { PropertiesErrorOrWarning } from "../types"

/** A group has no settings of its own; it renders as a Frame that stacks its layers and fills its parent. */
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
    warnings: [],
  }
}
