import { readIdentity } from "../read/identity"
import type { PropertiesAndIssues } from "../types"
import { truncateName } from "../utilities"

/**
 * A group has no settings of its own; it renders as a Frame that stacks its layers and fills its parent, so layers
 * that overlap in Figma end up one below the other.
 */
export const serializeGroup = (node: GroupNode): PropertiesAndIssues => ({
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
      property: "LAYER",
      problem: "unsupported",
      value: "group",
      explanation: "Rendered as a vertical Frame, so overlapping layers stack.",
    },
  ],
})
