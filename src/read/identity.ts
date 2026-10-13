import type { Properties } from "../types"

export const readIdentity = (node: SceneNode): Properties => {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
  }
}
