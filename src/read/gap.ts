import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"
import { resolveBoundUnitClass } from "./unit"

/** A gap's flag suffix (`4`, `px`) from its bound variable, or an error when it isn't bound to a unit token. */
const readSpacing = async (
  node: SceneNode,
  label: string,
  bound: VariableAlias | undefined,
  errors: ErrorOrWarning[],
): Promise<string | undefined> => {
  if (bound === undefined) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – ${label}: not bound` })

    return undefined
  }

  const suffix = await resolveBoundUnitClass("", bound)

  if (suffix === undefined) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – ${label}: not a token` })
  }

  return suffix
}

// Without wrap, Figma has one gap, between items: `gap-`. With wrap on it has two, between items in a row and between
// rows: `gap-` when they're equal, else `gap-horizontal-` and `gap-vertical-`. The rows' Auto setting has no flag.
export const readGap = async (node: SceneNode & AutoLayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  const items =
    node.itemSpacing > 0 ? await readSpacing(node, "GAP", node.boundVariables?.itemSpacing, errors) : undefined

  const rowSpacing = node.layoutWrap === "WRAP" ? node.counterAxisSpacing : null
  const rows =
    rowSpacing !== null && rowSpacing > 0
      ? await readSpacing(node, "GAP VERTICAL", node.boundVariables?.counterAxisSpacing, errors)
      : undefined

  const sameSpacing = rows === undefined || rows === items

  if (sameSpacing && items !== undefined) properties[`gap-${items}`] = true
  if (!sameSpacing && items !== undefined) properties[`gap-horizontal-${items}`] = true
  if (!sameSpacing) properties[`gap-vertical-${rows}`] = true

  return { properties, errors, warnings: [] }
}
