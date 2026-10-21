import type { Issue, PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"

/**
 * Layer settings the library has no flags for: they are dropped from the output, so each is a warning. A layer
 * positioned absolutely renders in the flow of its parent's auto layout instead.
 */
const SIZE_LIMITS = [
  ["minWidth", "MIN WIDTH"],
  ["maxWidth", "MAX WIDTH"],
  ["minHeight", "MIN HEIGHT"],
  ["maxHeight", "MAX HEIGHT"],
] as const

export const readLayerSettings = (node: SceneNode): PropertiesAndIssues => {
  const layer = truncateName(node.name)
  const warnings: Issue[] = []

  const warn = (property: string, value: string | number, explanation: string) =>
    warnings.push({ nodeId: node.id, layer, property, problem: "unsupported", value, explanation })

  if ("opacity" in node && node.opacity < 1) {
    warn("OPACITY", `${Math.round(node.opacity * 100)}%`, "Rendered fully opaque.")
  }

  if ("rotation" in node && Math.abs(node.rotation) >= 0.01) {
    warn("ROTATION", formatValue(node.rotation, "deg"), "Rendered without rotation.")
  }

  if ("layoutPositioning" in node && node.layoutPositioning === "ABSOLUTE") {
    warn("POSITION", "absolute", "Placed in its parent's auto layout flow.")
  }

  for (const [key, property] of SIZE_LIMITS) {
    const limit = key in node ? (node as unknown as Record<string, number | null>)[key] : null

    if (limit !== null) warn(property, formatValue(limit), "Min and max sizes have no flag, so this limit is left out.")
  }

  return { properties: {}, errors: [], warnings }
}
