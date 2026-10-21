import { resolveTextSizeToken } from "../maps"
import type { PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"

export const readTypography = async (node: TextNode): Promise<PropertiesAndIssues> => {
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
          explanation: "Text sizes are read from text-* text styles, so this one is left out.",
        },
      ],
      warnings: [],
    }
  }

  if (node.textStyleId === figma.mixed) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: "TYPOGRAPHY",
          problem: "mixed",
          explanation: "Parts of the text differ, so the text size is left out.",
        },
      ],
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

/** Underlined text as `typography-decoration-underline`; the library has no strikethrough. */
export const readTextDecoration = (node: TextNode): PropertiesAndIssues => {
  if (node.textDecoration === "NONE") return { properties: {}, errors: [], warnings: [] }
  if (node.textDecoration === "UNDERLINE") {
    return { properties: { "typography-decoration-underline": true }, errors: [], warnings: [] }
  }

  return {
    properties: {},
    errors: [],
    warnings: [
      {
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "TEXT DECORATION",
        problem: node.textDecoration === figma.mixed ? "mixed" : "unsupported",
        value: node.textDecoration === figma.mixed ? undefined : formatValue(node.textDecoration),
        explanation:
          node.textDecoration === figma.mixed
            ? "Only a whole text layer can be underlined, so this is left out."
            : "Only underline is supported, so this is left out.",
      },
    ],
  }
}
