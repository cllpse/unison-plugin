import { resolveColorToken } from "../maps"
import type { PropertiesErrorOrWarning } from "../types"
import { formatValue, RGBToHEX, truncateName } from "../utilities"
import { getVariable } from "./variable"

const resolveBoundPaintColor = async (
  prefix: string,
  paint: SolidPaint,
): Promise<{ className?: string; label: string }> => {
  const id = paint.boundVariables?.color?.id
  const variable = id ? await getVariable(id) : null
  const token = resolveColorToken(variable?.name)
  const className = token === undefined ? undefined : `${prefix}${token}`

  return { className, label: variable?.name ?? RGBToHEX(paint.color) }
}

/** A layer's fill or stroke paint as a `fill-` / `stroke-` color flag: solid, bound to a variable and visible. */
export const readPaint = async (
  node: SceneNode,
  kind: "FILL" | "STROKE",
  paint: Paint | undefined,
): Promise<PropertiesErrorOrWarning> => {
  const name = kind.toLowerCase()

  if (paint === undefined) return { properties: {}, errors: [], warnings: [] }

  if (paint.type !== "SOLID") {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: `${kind}`,
          problem: "unsupported",
          value: formatValue(paint.type),
        },
      ],
      warnings: [],
    }
  }

  if (paint.boundVariables?.color === undefined) {
    return {
      properties: {},
      errors: [
        {
          nodeId: node.id,
          layer: truncateName(node.name),
          property: `${kind}`,
          problem: "not bound",
          value: RGBToHEX(paint.color),
        },
      ],
      warnings: [],
    }
  }

  const { className, label } = await resolveBoundPaintColor(`${name}-`, paint)

  if (!paint.visible) {
    return {
      properties: {},
      errors: [],
      warnings: [
        { nodeId: node.id, layer: truncateName(node.name), property: `${kind}`, problem: "hidden", value: label },
      ],
    }
  }

  if (className) return { properties: { [className]: true }, errors: [], warnings: [] }

  return {
    properties: {},
    errors: [
      { nodeId: node.id, layer: truncateName(node.name), property: `${kind}`, problem: "not a token", value: label },
    ],
    warnings: [],
  }
}
