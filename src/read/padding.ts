import type { Issue, Properties, PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"
import { resolveBoundUnitClass } from "./unit"

export const readPadding = async (node: SceneNode & AutoLayoutMixin): Promise<PropertiesAndIssues> => {
  const properties: Properties = {}
  const errors: Issue[] = []
  const { paddingLeft: left, paddingRight: right, paddingTop: top, paddingBottom: bottom } = node
  const bound = node.boundVariables

  // An unbound side already has its error, so only a bound one is resolved.
  const addClass = async (prefix: string, label: string, value: number, alias: VariableAlias | undefined) => {
    if (alias === undefined) return

    const className = await resolveBoundUnitClass(prefix, alias)

    if (className) {
      properties[className] = true

      return
    }

    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: `${label}`,
      problem: "not a token",
      value: formatValue(value),
    })
  }

  const horizontalPair = left === right && left > 0
  const horizontalBound = bound?.paddingLeft !== undefined && bound?.paddingRight !== undefined
  const verticalPair = top === bottom && top > 0
  const verticalBound = bound?.paddingTop !== undefined && bound?.paddingBottom !== undefined
  const paddingHorizontal = horizontalPair && horizontalBound ? left : 0
  const paddingVertical = verticalPair && verticalBound ? top : 0

  if (horizontalPair && !horizontalBound) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "PADDING HORIZONTAL",
      problem: "not bound",
      value: formatValue(left),
    })
  }

  if (verticalPair && !verticalBound) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "PADDING VERTICAL",
      problem: "not bound",
      value: formatValue(top),
    })
  }

  if (paddingHorizontal === 0 && left > 0 && bound?.paddingLeft === undefined) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "PADDING LEFT",
      problem: "not bound",
      value: formatValue(left),
    })
  }

  if (paddingHorizontal === 0 && right > 0 && bound?.paddingRight === undefined) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "PADDING RIGHT",
      problem: "not bound",
      value: formatValue(right),
    })
  }

  if (paddingVertical === 0 && top > 0 && bound?.paddingTop === undefined) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "PADDING TOP",
      problem: "not bound",
      value: formatValue(top),
    })
  }

  if (paddingVertical === 0 && bottom > 0 && bound?.paddingBottom === undefined) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "PADDING BOTTOM",
      problem: "not bound",
      value: formatValue(bottom),
    })
  }

  if (paddingHorizontal > 0 && paddingHorizontal === paddingVertical) {
    await addClass("padding-", "PADDING", left, bound?.paddingLeft)

    return { properties, errors, warnings: [] }
  }

  if (paddingHorizontal > 0) await addClass("padding-horizontal-", "PADDING HORIZONTAL", left, bound?.paddingLeft)
  if (paddingHorizontal === 0 && left > 0) await addClass("padding-left-", "PADDING LEFT", left, bound?.paddingLeft)
  if (paddingHorizontal === 0 && right > 0)
    await addClass("padding-right-", "PADDING RIGHT", right, bound?.paddingRight)
  if (paddingVertical > 0) await addClass("padding-vertical-", "PADDING VERTICAL", top, bound?.paddingTop)
  if (paddingVertical === 0 && top > 0) await addClass("padding-top-", "PADDING TOP", top, bound?.paddingTop)
  if (paddingVertical === 0 && bottom > 0)
    await addClass("padding-bottom-", "PADDING BOTTOM", bottom, bound?.paddingBottom)

  return { properties, errors, warnings: [] }
}
