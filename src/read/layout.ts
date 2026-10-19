import type { FigmaFrameAutolayout } from "../../unison-components/types/figma"
import type { Properties, PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"

const LAYOUT_MODE_FLAGS: Record<string, keyof FigmaFrameAutolayout> = {
  HORIZONTAL: "autolayout-horizontal",
  VERTICAL: "autolayout-vertical",
}

export const readLayout = (node: SceneNode & AutoLayoutMixin): PropertiesErrorOrWarning => {
  const flag = LAYOUT_MODE_FLAGS[node.layoutMode]

  if (!flag) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, message: `${truncateName(node.name)} – AUTO LAYOUT: missing`, always: true }],
      warnings: [],
    }
  }

  const properties: Properties = { [flag]: true }

  if (node.layoutMode === "HORIZONTAL" && node.layoutWrap === "WRAP") properties.wrap = true

  return { properties, errors: [], warnings: [] }
}
