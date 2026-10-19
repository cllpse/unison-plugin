import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { truncateName } from "../utilities"
import { resolveBoundUnitClass } from "./unit"

export const readPadding = async (node: SceneNode & AutoLayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []
  const { paddingLeft: left, paddingRight: right, paddingTop: top, paddingBottom: bottom } = node
  const bound = node.boundVariables

  // An unbound side already has its error, so only a bound one is resolved.
  const addClass = async (prefix: string, label: string, alias: VariableAlias | undefined) => {
    if (alias === undefined) return

    const className = await resolveBoundUnitClass(prefix, alias)

    if (className) {
      properties[className] = true

      return
    }

    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – ${label}: not a token` })
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
      message: `${truncateName(node.name)} – PADDING HORIZONTAL: not bound`,
    })
  }

  if (verticalPair && !verticalBound) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – PADDING VERTICAL: not bound` })
  }

  if (paddingHorizontal === 0 && left > 0 && bound?.paddingLeft === undefined) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – PADDING LEFT: not bound` })
  }

  if (paddingHorizontal === 0 && right > 0 && bound?.paddingRight === undefined) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – PADDING RIGHT: not bound` })
  }

  if (paddingVertical === 0 && top > 0 && bound?.paddingTop === undefined) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – PADDING TOP: not bound` })
  }

  if (paddingVertical === 0 && bottom > 0 && bound?.paddingBottom === undefined) {
    errors.push({ nodeId: node.id, message: `${truncateName(node.name)} – PADDING BOTTOM: not bound` })
  }

  if (paddingHorizontal > 0 && paddingHorizontal === paddingVertical) {
    await addClass("padding-", "PADDING", bound?.paddingLeft)

    return { properties, errors, warnings: [] }
  }

  if (paddingHorizontal > 0) await addClass("padding-horizontal-", "PADDING HORIZONTAL", bound?.paddingLeft)
  if (paddingHorizontal === 0 && left > 0) await addClass("padding-left-", "PADDING LEFT", bound?.paddingLeft)
  if (paddingHorizontal === 0 && right > 0) await addClass("padding-right-", "PADDING RIGHT", bound?.paddingRight)
  if (paddingVertical > 0) await addClass("padding-vertical-", "PADDING VERTICAL", bound?.paddingTop)
  if (paddingVertical === 0 && top > 0) await addClass("padding-top-", "PADDING TOP", bound?.paddingTop)
  if (paddingVertical === 0 && bottom > 0) await addClass("padding-bottom-", "PADDING BOTTOM", bound?.paddingBottom)

  return { properties, errors, warnings: [] }
}
