import type { Issue, Properties, PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"
import { resolveBoundRadiusClass } from "./unit"

type DiscreteCorner = {
  value: number
  bound: VariableAlias | undefined
  prefix: string
  label: string
}

const hasDiscreteCorners = (node: SceneNode & CornerMixin): node is SceneNode & CornerMixin & RectangleCornerMixin =>
  "topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node

const getCornerError = (node: SceneNode, problem: string, value: number, label?: string): Issue => ({
  nodeId: node.id,
  layer: truncateName(node.name),
  property: label ? `CORNER RADIUS ${label}` : "CORNER RADIUS",
  problem,
  value: formatValue(value),
})

const emitCorner = async (
  node: SceneNode,
  prefix: string,
  value: number,
  bound: VariableAlias | undefined,
  properties: Properties,
  errors: Issue[],
  label?: string,
) => {
  if (value > 0 && bound === undefined) {
    errors.push(getCornerError(node, "not bound", value, label))

    return
  }

  // A square corner needs no variable.
  if (value === 0 && bound === undefined) {
    properties[`${prefix}none`] = true

    return
  }

  const className = await resolveBoundRadiusClass(prefix, bound)

  if (className) {
    properties[className] = true

    return
  }

  errors.push(getCornerError(node, "not a token", value, label))
}

const readDiscreteCorners = async (
  node: SceneNode & CornerMixin & RectangleCornerMixin,
): Promise<PropertiesAndIssues> => {
  const properties: Properties = {}
  const errors: Issue[] = []

  const corners: DiscreteCorner[] = [
    {
      value: node.topLeftRadius,
      bound: node.boundVariables?.topLeftRadius,
      prefix: "corner-radius-top-left-",
      label: "TOP LEFT",
    },
    {
      value: node.topRightRadius,
      bound: node.boundVariables?.topRightRadius,
      prefix: "corner-radius-top-right-",
      label: "TOP RIGHT",
    },
    {
      value: node.bottomLeftRadius,
      bound: node.boundVariables?.bottomLeftRadius,
      prefix: "corner-radius-bottom-left-",
      label: "BOTTOM LEFT",
    },
    {
      value: node.bottomRightRadius,
      bound: node.boundVariables?.bottomRightRadius,
      prefix: "corner-radius-bottom-right-",
      label: "BOTTOM RIGHT",
    },
  ]

  const counts = new Map<number, number>()

  for (const corner of corners) {
    counts.set(corner.value, (counts.get(corner.value) ?? 0) + 1)
  }

  let baseValue = corners[0].value
  let baseCount = 0

  for (const [value, count] of counts) {
    if (count > baseCount) {
      baseValue = value
      baseCount = count
    }
  }

  if (baseCount === 4 && baseValue <= 0) return { properties, errors, warnings: [] }

  if (baseCount === 4 && corners.some((corner) => corner.bound === undefined)) {
    errors.push(getCornerError(node, "not bound", baseValue))

    return { properties, errors, warnings: [] }
  }

  if (baseCount === 4) {
    await emitCorner(node, "corner-radius-", baseValue, corners[0].bound, properties, errors)

    return { properties, errors, warnings: [] }
  }

  const base = corners.find((corner) => corner.value === baseValue)
  const useBase = baseCount >= 2 && baseValue > 0 && base !== undefined

  if (useBase) {
    await emitCorner(node, "corner-radius-", baseValue, base.bound, properties, errors)

    for (const corner of corners) {
      if (corner.value === baseValue) continue

      await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label)
    }

    return { properties, errors, warnings: [] }
  }

  for (const corner of corners) {
    if (corner.value <= 0) continue

    await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label)
  }

  return { properties, errors, warnings: [] }
}

export const readCornerRadius = async (node: SceneNode & CornerMixin): Promise<PropertiesAndIssues> => {
  if (hasDiscreteCorners(node)) return readDiscreteCorners(node)

  if (node.cornerRadius === figma.mixed) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "CORNER RADIUS", problem: "mixed" }],
      warnings: [],
    }
  }

  const properties: Properties = {}
  const errors: Issue[] = []

  if (node.cornerRadius > 0) {
    await emitCorner(node, "corner-radius-", node.cornerRadius, node.boundVariables?.topLeftRadius, properties, errors)
  }

  return { properties, errors, warnings: [] }
}
