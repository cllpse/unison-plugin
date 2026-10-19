import type { FigmaFrameAutolayout } from "../../unison-components/src/types/figmaProperties"
import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"

const map: Record<string, keyof FigmaFrameAutolayout> = {
  HORIZONTAL: "autolayout-horizontal",
  VERTICAL: "autolayout-vertical",
}

export const readLayout = (node: SceneNode & AutoLayoutMixin): PropertiesErrorOrWarning => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  const flag = map[node.layoutMode]

  if (!flag) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – FRAME has no auto layout.`,
      always: true,
    })
  } else {
    properties[flag] = true

    if (node.layoutMode === "HORIZONTAL" && node.layoutWrap === "WRAP") {
      properties.wrap = true
    }
  }

  return { properties, errors, warnings: [] }
}
