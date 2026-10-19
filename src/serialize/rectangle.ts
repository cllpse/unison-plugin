import { readCornerRadius } from "../read/cornerRadius"
import { readDimensions } from "../read/dimensions"
import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import { readStroke } from "../read/stroke"
import type { PropertiesErrorOrWarning } from "../types"

export const serializeRectangle = async (node: RectangleNode): Promise<PropertiesErrorOrWarning> => {
  const dimensions = await readDimensions(node)
  const fill = await readFill(node)
  const stroke = await readStroke(node)
  const cornerRadius = await readCornerRadius(node)

  return {
    properties: {
      ...readIdentity(node),

      ...dimensions.properties,
      ...fill.properties,
      ...stroke.properties,
      ...cornerRadius.properties,
    },

    // In the order of Figma's right panel, like the rendered flags.
    errors: [...dimensions.errors, ...cornerRadius.errors, ...fill.errors, ...stroke.errors],
    warnings: [...dimensions.warnings, ...cornerRadius.warnings, ...fill.warnings, ...stroke.warnings],
  }
}
