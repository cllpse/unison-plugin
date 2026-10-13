import type { FigmaFrameFlow } from "../../figma/src/types/figmaProperties"
import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"

const map: Record<string, keyof FigmaFrameFlow> = {
  HORIZONTAL: "flow-horizontal",
  VERTICAL: "flow-vertical",
  GRID: "flow-grid",
}

export const readLayout = (node: SceneNode & AutoLayoutMixin): PropertiesErrorOrWarning => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (node.layoutMode === "NONE") {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – LAYOUT value must be "horizontal", "vertical" or "grid".`,
    })
  } else {
    properties[map[node.layoutMode]] = true
  }

  return { properties, errors, warnings: [] }
}
