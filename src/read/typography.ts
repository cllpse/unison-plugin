import { resolveTextSizeToken } from "../maps"
import type { PropertiesErrorOrWarning } from "../types"
import { formatValue, truncateName } from "../utilities"

export const readTypography = async (node: TextNode): Promise<PropertiesErrorOrWarning> => {
  if (node.textStyleId === "") {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "TYPOGRAPHY",
          problem: "not bound",
          value: node.fontSize === figma.mixed ? undefined : formatValue(node.fontSize),
        },
      ],
      warnings: [],
    }
  }

  if (node.textStyleId === figma.mixed) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, layer: truncateName(node.name), property: "TYPOGRAPHY", problem: "mixed" }],
      warnings: [],
    }
  }

  // `text-<size>` styles (made by the import button) are Tailwind's sizes: `typography-sm`.
  const style = await figma.getStyleByIdAsync(node.textStyleId)
  const size = style ? resolveTextSizeToken(style.name) : undefined

  if (size === undefined) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "TYPOGRAPHY",
          problem: "not a token",
          value: style?.name ?? node.textStyleId,
        },
      ],
      warnings: [],
    }
  }

  return { properties: { [`typography-${size}`]: true }, errors: [], warnings: [] }
}
