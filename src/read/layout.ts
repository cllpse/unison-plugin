import type { FigmaFrameAutolayout } from "../../unison-components/types/figma"
import type { Properties, PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"

const LAYOUT_MODE_FLAGS: Record<string, keyof FigmaFrameAutolayout> = {
  HORIZONTAL: "autolayout-horizontal",
  VERTICAL: "autolayout-vertical",
}

export const readLayout = (node: SceneNode & AutoLayoutMixin): PropertiesAndIssues => {
  const flag = LAYOUT_MODE_FLAGS[node.layoutMode]

  if (!flag) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "AUTO LAYOUT",
          problem: "missing",
          value: formatValue(node.layoutMode),
          explanation: "Without auto layout, this frame's layers can't be placed.",
        },
      ],
      warnings: [],
    }
  }

  const properties: Properties = { [flag]: true }

  if (node.layoutMode === "HORIZONTAL" && node.layoutWrap === "WRAP") properties.wrap = true

  return { properties, errors: [], warnings: [] }
}
