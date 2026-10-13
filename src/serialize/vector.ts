import { readDimensions } from "../read/dimensions"
import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import type { PropertiesErrorOrWarning } from "../types"

export const serializeVector = async (node: VectorNode): Promise<PropertiesErrorOrWarning> => {
  const dimensions = await readDimensions(node)
  const fill = await readFill(node)

  const errors = fill.errors

  return {
    properties: {
      ...readIdentity(node),

      ...dimensions.properties,
      ...fill.properties,
    },

    errors,
    warnings: [],
  }
}
