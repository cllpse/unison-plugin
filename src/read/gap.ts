import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundUnitClass } from "./unit"

/** A gap's flag suffix (`4`, `px`) from its bound variable, or an error when it isn't bound. */
const readSpacing = async (
  node: SceneNode,
  label: string,
  pixels: number,
  bound: VariableAlias | undefined,
  errors: ErrorOrWarning[],
): Promise<string | undefined> => {
  if (pixels === 1) return "px"

  if (bound === undefined) {
    errors.push({ nodeId: node.id, message: `Error @ ${node.name} – ${label} value is not bound to a variable.` })

    return undefined
  }

  return resolveBoundUnitClass("", bound, pixels)
}

// Without wrap, Figma has one gap, between items: `gap-`. With wrap on it has two, between items in a row and between
// rows: `gap-` when they're equal, else `gap-horizontal-` and `gap-vertical-`. The rows' Auto setting has no flag.
export const readGap = async (node: SceneNode & AutoLayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  const items =
    node.itemSpacing > 0
      ? await readSpacing(node, "GAP", node.itemSpacing, node.boundVariables?.itemSpacing, errors)
      : undefined

  const rowSpacing = node.layoutWrap === "WRAP" ? node.counterAxisSpacing : null
  const rows =
    rowSpacing !== null && rowSpacing > 0
      ? await readSpacing(node, "GAP vertical", rowSpacing, node.boundVariables?.counterAxisSpacing, errors)
      : undefined

  if (rows === undefined || rows === items) {
    if (items !== undefined) properties[`gap-${items}`] = true
  } else {
    if (items !== undefined) properties[`gap-horizontal-${items}`] = true
    properties[`gap-vertical-${rows}`] = true
  }

  return { properties, errors, warnings: [] }
}
