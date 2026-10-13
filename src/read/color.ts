import { resolveColorClass } from "../maps"
import { RGBToHEX } from "../utilities"
import { getVariable } from "./variable"

export const resolveBoundPaintColor = async (
  prefix: "fill-" | "stroke-",
  paint: SolidPaint,
): Promise<{ className?: string; label: string }> => {
  const id = paint.boundVariables?.color?.id
  const variable = id ? await getVariable(id) : null
  const hex = RGBToHEX(paint.color)
  const className = resolveColorClass(prefix, variable?.name, hex)

  return { className, label: variable?.name ?? hex }
}
