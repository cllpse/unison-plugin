import { HEIGHT_SIZING, WIDTH_SIZING } from "../maps"
import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"
import { resolveBoundUnitClass, resolveBoundWidthClass } from "./unit"

/** One side's flag: a bound unit token when fixed, else its sizing mode, or an error when it is neither. */
const readSize = async (
  node: SceneNode,
  label: "WIDTH" | "HEIGHT",
  sizing: string,
  bound: VariableAlias | undefined,
  resolveFixedClass: (bound: VariableAlias) => Promise<string | undefined>,
  sizingFlags: Record<string, string>,
  errors: ErrorOrWarning[],
): Promise<string | undefined> => {
  if (sizing === "FIXED" && bound) {
    const className = await resolveFixedClass(bound)

    if (className === undefined) {
      errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – ${label}: not a token` })
    }

    return className
  }

  if (sizing === "FIXED") {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – ${label}: not bound` })

    return undefined
  }

  if (sizing !== "FILL" && sizing !== "HUG") {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – ${label}: must be fill or hug` })

    return undefined
  }

  return sizingFlags[sizing]
}

export const readDimensions = async (node: SceneNode & LayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  const width = await readSize(
    node,
    "WIDTH",
    node.layoutSizingHorizontal,
    node.boundVariables?.width,
    resolveBoundWidthClass,
    WIDTH_SIZING,
    errors,
  )
  const height = await readSize(
    node,
    "HEIGHT",
    node.layoutSizingVertical,
    node.boundVariables?.height,
    (bound) => resolveBoundUnitClass("height-", bound),
    HEIGHT_SIZING,
    errors,
  )

  if (width) properties[width] = true
  if (height) properties[height] = true

  return { properties, errors, warnings: [] }
}
