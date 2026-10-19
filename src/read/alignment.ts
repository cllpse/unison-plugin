import type { FigmaFrameAlignment, FigmaTypographyAlignment } from "../../unison-components/types/figma"
import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"

const mapFrame: Record<string, keyof FigmaFrameAlignment> = {
  HORIZONTAL_MIN_MIN: "alignment-top-left",
  HORIZONTAL_MIN_CENTER: "alignment-left",
  HORIZONTAL_MIN_MAX: "alignment-bottom-left",
  HORIZONTAL_MIN_BASELINE: "alignment-top-left",
  HORIZONTAL_CENTER_MIN: "alignment-top-center",
  HORIZONTAL_CENTER_CENTER: "alignment-center",
  HORIZONTAL_CENTER_MAX: "alignment-bottom-center",
  HORIZONTAL_CENTER_BASELINE: "alignment-top-center",
  HORIZONTAL_MAX_MIN: "alignment-top-right",
  HORIZONTAL_MAX_CENTER: "alignment-right",
  HORIZONTAL_MAX_MAX: "alignment-bottom-right",
  HORIZONTAL_MAX_BASELINE: "alignment-top-right",
  HORIZONTAL_SPACE_BETWEEN_MIN: "alignment-top-center",
  HORIZONTAL_SPACE_BETWEEN_CENTER: "alignment-center",
  HORIZONTAL_SPACE_BETWEEN_MAX: "alignment-bottom-center",
  HORIZONTAL_SPACE_BETWEEN_BASELINE: "alignment-top-center",
  VERTICAL_MIN_MIN: "alignment-top-left",
  VERTICAL_MIN_CENTER: "alignment-top-center",
  VERTICAL_MIN_MAX: "alignment-top-right",
  VERTICAL_MIN_BASELINE: "alignment-top-left",
  VERTICAL_CENTER_MIN: "alignment-left",
  VERTICAL_CENTER_CENTER: "alignment-center",
  VERTICAL_CENTER_MAX: "alignment-right",
  VERTICAL_CENTER_BASELINE: "alignment-left",
  VERTICAL_MAX_MIN: "alignment-bottom-left",
  VERTICAL_MAX_CENTER: "alignment-bottom-center",
  VERTICAL_MAX_MAX: "alignment-bottom-right",
  VERTICAL_MAX_BASELINE: "alignment-bottom-left",
  VERTICAL_SPACE_BETWEEN_MIN: "alignment-left",
  VERTICAL_SPACE_BETWEEN_CENTER: "alignment-center",
  VERTICAL_SPACE_BETWEEN_MAX: "alignment-right",
  VERTICAL_SPACE_BETWEEN_BASELINE: "alignment-left",
}

export const readAlignmentFrame = (node: SceneNode & AutoLayoutMixin): PropertiesErrorOrWarning => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  // Without horizontal or vertical auto layout there's no alignment to read; readLayout reports that.
  if (node.layoutMode === "HORIZONTAL" || node.layoutMode === "VERTICAL") {
    properties[mapFrame[`${node.layoutMode}_${node.primaryAxisAlignItems}_${node.counterAxisAlignItems}`]] = true
  }

  return { properties, errors, warnings: [] }
}

const mapText: Record<string, keyof FigmaTypographyAlignment> = {
  LEFT: "typography-align-left",
  CENTER: "typography-align-center",
  RIGHT: "typography-align-right",
}

export const readAlignmentText = (node: TextNode): PropertiesErrorOrWarning => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (
    node.textAlignHorizontal === "LEFT" ||
    node.textAlignHorizontal === "CENTER" ||
    node.textAlignHorizontal === "RIGHT"
  ) {
    properties[mapText[node.textAlignHorizontal]] = true
  } else {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – TEXT alignment must be "left", "center" or "right".`,
    })
  }

  return { properties, errors, warnings: [] }
}
