import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"
import { resolveBoundUnitClass } from "./unit"

export const readPadding = async (node: SceneNode & AutoLayoutMixin): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  let paddingVertical = 0
  let paddingHorizontal = 0

  if (node.paddingLeft === node.paddingRight && node.paddingLeft > 0 && node.paddingRight > 0) {
    if (node.boundVariables?.paddingLeft === undefined || node.boundVariables?.paddingRight === undefined) {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – PADDING vertical value not bound to a variable.`,
      })
    } else {
      paddingHorizontal = node.paddingLeft
    }
  }

  if (node.paddingTop === node.paddingBottom && node.paddingTop > 0 && node.paddingBottom > 0) {
    if (node.boundVariables?.paddingTop === undefined || node.boundVariables?.paddingBottom === undefined) {
      errors.push({
        nodeId: node.id,
        message: `Error @ ${node.name} – PADDING horizontal value not bound to a variable.`,
      })
    } else {
      paddingVertical = node.paddingTop
    }
  }

  if (paddingHorizontal === 0 && node.paddingLeft > 0 && node.boundVariables?.paddingLeft === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – PADDING left value is not bound to a variable.`,
    })
  }

  if (paddingHorizontal === 0 && node.paddingRight > 0 && node.boundVariables?.paddingRight === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – PADDING right value is not bound to a variable.`,
    })
  }

  if (paddingVertical === 0 && node.paddingTop > 0 && node.boundVariables?.paddingTop === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – PADDING top value is not bound to a variable.`,
    })
  }

  if (paddingVertical === 0 && node.paddingBottom > 0 && node.boundVariables?.paddingBottom === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ ${node.name} – PADDING bottom value is not bound to a variable.`,
    })
  }

  if (paddingHorizontal > 0 && paddingVertical > 0 && paddingHorizontal === paddingVertical) {
    const className = await resolveBoundUnitClass("padding-", node.boundVariables?.paddingLeft, paddingHorizontal)

    if (className) {
      properties[className] = true
    }
  } else {
    if (paddingHorizontal > 0) {
      const className = await resolveBoundUnitClass(
        "padding-horizontal-",
        node.boundVariables?.paddingLeft,
        paddingHorizontal,
      )

      if (className) {
        properties[className] = true
      }
    } else {
      if (node.paddingLeft > 0) {
        const className = await resolveBoundUnitClass(
          "padding-left-",
          node.boundVariables?.paddingLeft,
          node.paddingLeft,
        )

        if (className) {
          properties[className] = true
        }
      }

      if (node.paddingRight > 0) {
        const className = await resolveBoundUnitClass(
          "padding-right-",
          node.boundVariables?.paddingRight,
          node.paddingRight,
        )

        if (className) {
          properties[className] = true
        }
      }
    }

    if (paddingVertical > 0) {
      const className = await resolveBoundUnitClass(
        "padding-vertical-",
        node.boundVariables?.paddingTop,
        paddingVertical,
      )

      if (className) {
        properties[className] = true
      }
    } else {
      if (node.paddingTop > 0) {
        const className = await resolveBoundUnitClass("padding-top-", node.boundVariables?.paddingTop, node.paddingTop)

        if (className) {
          properties[className] = true
        }
      }

      if (node.paddingBottom > 0) {
        const className = await resolveBoundUnitClass(
          "padding-bottom-",
          node.boundVariables?.paddingBottom,
          node.paddingBottom,
        )

        if (className) {
          properties[className] = true
        }
      }
    }
  }

  return {
    properties,
    errors,
    warnings: [],
  }
}
