import type { Issue, PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"
import { readPaints } from "./color"

// The library draws every stroke 1px wide on the inside of the layer, solid or dashed (`stroke-style-dashed`).
export const readStroke = async (node: SceneNode & MinimalStrokesMixin): Promise<PropertiesAndIssues> => {
  const result = await readPaints(node, "STROKE", node.strokes)

  if (!Object.keys(result.properties).some((key) => key.startsWith("stroke-"))) return result

  const layer = truncateName(node.name)
  const warnings: Issue[] = [...result.warnings]

  if (node.strokeWeight !== 1) {
    warnings.push({
      nodeId: node.id,
      layer,
      property: "STROKE WEIGHT",
      problem: "must be 1",
      explanation: "Rendered 1px wide.",
      value: node.strokeWeight === figma.mixed ? "mixed" : formatValue(node.strokeWeight),
    })
  }

  if (node.strokeAlign !== "INSIDE") {
    warnings.push({
      nodeId: node.id,
      layer,
      property: "STROKE POSITION",
      problem: "must be inside",
      explanation: "Rendered on the inside of the layer.",
      value: formatValue(node.strokeAlign),
    })
  }

  const dashed = node.dashPattern.length > 0

  return {
    ...result,
    properties: { ...result.properties, ...(dashed ? { "stroke-style-dashed": true } : {}) },
    warnings,
  }
}
