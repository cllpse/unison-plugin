import { resolveColorToken } from "../maps"
import type { PropertiesAndIssues } from "../types"
import { convertRgbToHex, formatValue, truncateName } from "../utilities"
import { getVariable } from "./variable"

const resolveBoundPaintColor = async (
  prefix: string,
  paint: SolidPaint,
): Promise<{ className?: string; label: string }> => {
  const id = paint.boundVariables?.color?.id
  const variable = id ? await getVariable(id) : null
  const token = resolveColorToken(variable?.name)
  const className = token === undefined ? undefined : `${prefix}${token}`

  return { className, label: variable?.name ?? convertRgbToHex(paint.color) }
}

/**
 * A layer's fills or strokes as a `fill-` / `stroke-` color flag: one visible paint, solid and bound to a color token.
 * Hidden paints are left out, as Figma does.
 */
export const readPaints = async (
  node: SceneNode,
  kind: "FILL" | "STROKE",
  paints: ReadonlyArray<Paint>,
): Promise<PropertiesAndIssues> => {
  const layer = truncateName(node.name)
  const visiblePaints = paints.filter((paint) => paint.visible !== false)
  const paint = visiblePaints[0] ?? paints[0]

  if (paint === undefined) return { properties: {}, errors: [], warnings: [] }

  if (visiblePaints.length > 1) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer,
          property: kind,
          problem: "mixed",
          value: visiblePaints.length,
          explanation: `Only one can be a flag, so the ${kind.toLowerCase()} is left out.`,
        },
      ],
      warnings: [],
    }
  }

  if (paint.visible === false) {
    const value = paint.type === "SOLID" ? (await resolveBoundPaintColor("", paint)).label : formatValue(paint.type)

    return {
      properties: {},
      errors: [],
      warnings: [],
      notifications: [{ nodeId: node.id, layer, property: kind, problem: "hidden, skipped", value }],
    }
  }

  if (paint.type !== "SOLID") {
    return {
      properties: {},
      errors: [{ nodeId: node.id, layer, property: kind, problem: "unsupported", value: formatValue(paint.type) }],
      warnings: [],
    }
  }

  if (paint.boundVariables?.color === undefined) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, layer, property: kind, problem: "not bound", value: convertRgbToHex(paint.color) }],
      warnings: [],
    }
  }

  const { className, label } = await resolveBoundPaintColor(`${kind.toLowerCase()}-`, paint)

  if (className === undefined) {
    return {
      properties: {},
      errors: [{ nodeId: node.id, layer, property: kind, problem: "not a token", value: label }],
      warnings: [],
    }
  }

  // The library has no opacity flag, so the color is used at full strength.
  const opacity = paint.opacity ?? 1
  const warnings =
    opacity < 1
      ? [
          {
            nodeId: node.id,
            layer,
            property: `${kind} OPACITY`,
            problem: "unsupported",
            value: `${Math.round(opacity * 100)}%`,
            explanation: "Rendered at full opacity.",
          },
        ]
      : []

  return { properties: { [className]: true }, errors: [], warnings }
}
