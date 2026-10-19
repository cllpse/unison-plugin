import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundRadiusClass } from "./unit"

type DiscreteCorner = {
  value: number
  bound: VariableAlias | undefined
  prefix: string
  label: string
}

const hasDiscreteCorners = (node: SceneNode & CornerMixin): node is SceneNode & CornerMixin & RectangleCornerMixin =>
  "topLeftRadius" in node && "topRightRadius" in node && "bottomLeftRadius" in node && "bottomRightRadius" in node

const unboundMessage = (node: SceneNode, label?: string): string =>
  label
    ? `Error @ ${node.name} – CORNER RADIUS ${label} value is not bound to a variable.`
    : `Error @ ${node.name} – CORNER RADIUS value is not bound to a variable.`

const emitCorner = async (
  node: SceneNode,
  prefix: string,
  value: number,
  bound: VariableAlias | undefined,
  properties: Properties,
  errors: ErrorOrWarning[],
  label?: string,
) => {
  if (value > 0 && bound === undefined) {
    errors.push({
      nodeId: node.id,
      message: unboundMessage(node, label),
    })

    return
  }

  const className = await resolveBoundRadiusClass(prefix, bound, value)

  if (className) {
    properties[className] = true

    return
  }

  errors.push({
    nodeId: node.id,
    message: label
      ? `Error @ ${node.name} – CORNER RADIUS ${label} value does not match a radius token.`
      : `Error @ ${node.name} – CORNER RADIUS value does not match a radius token.`,
  })
}

const readDiscreteCorners = async (
  node: SceneNode & CornerMixin & RectangleCornerMixin,
): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  const corners: DiscreteCorner[] = [
    {
      value: node.topLeftRadius,
      bound: node.boundVariables?.topLeftRadius,
      prefix: "corner-radius-top-left-",
      label: "top left",
    },
    {
      value: node.topRightRadius,
      bound: node.boundVariables?.topRightRadius,
      prefix: "corner-radius-top-right-",
      label: "top right",
    },
    {
      value: node.bottomLeftRadius,
      bound: node.boundVariables?.bottomLeftRadius,
      prefix: "corner-radius-bottom-left-",
      label: "bottom left",
    },
    {
      value: node.bottomRightRadius,
      bound: node.boundVariables?.bottomRightRadius,
      prefix: "corner-radius-bottom-right-",
      label: "bottom right",
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

  if (baseCount === 4) {
    if (baseValue > 0) {
      if (corners.some((corner) => corner.bound === undefined)) {
        errors.push({
          nodeId: node.id,
          message: unboundMessage(node),
        })
      } else {
        await emitCorner(node, "corner-radius-", baseValue, corners[0].bound, properties, errors)
      }
    }

    return { properties, errors, warnings: [] }
  }

  const base = corners.find((corner) => corner.value === baseValue)
  const useBase = baseCount >= 2 && baseValue > 0 && base !== undefined

  if (useBase) {
    await emitCorner(node, "corner-radius-", baseValue, base.bound, properties, errors)

    for (const corner of corners) {
      if (corner.value === baseValue) {
        continue
      }

      await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label)
    }
  } else {
    for (const corner of corners) {
      if (corner.value <= 0) {
        continue
      }

      await emitCorner(node, corner.prefix, corner.value, corner.bound, properties, errors, corner.label)
    }
  }

  return { properties, errors, warnings: [] }
}

export const readCornerRadius = async (node: SceneNode & CornerMixin): Promise<PropertiesErrorOrWarning> => {
  if (hasDiscreteCorners(node)) {
    return readDiscreteCorners(node)
  }

  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (node.cornerRadius === figma.mixed) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – CORNER RADIUS values cannot be mixed.`,
    })
  } else if (node.cornerRadius > 0) {
    await emitCorner(node, "corner-radius-", node.cornerRadius, node.boundVariables?.topLeftRadius, properties, errors)
  }

  return { properties, errors, warnings: [] }
}
