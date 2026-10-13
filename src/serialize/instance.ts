import { readIdentity } from "../read/identity"
import type { PropertiesErrorOrWarning } from "../types"
import { serializeFrame } from "./frame"

export const serializeInstance = async (node: InstanceNode): Promise<PropertiesErrorOrWarning> => {
  const mainComponent = await node.getMainComponentAsync()

  if (mainComponent !== null) {
    return serializeFrame(mainComponent)
  } else {
    return {
      properties: {
        ...readIdentity(node),
      },

      warnings: [],
      errors: [
        {
          nodeId: node.id,
          message: `Error @ "${node.name}" – INSTANCE layer is not a valid component.`,
        },
      ],
    }
  }
}
