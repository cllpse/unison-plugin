import type { Properties } from "../types"

export const readIdentity = (node: SceneNode): Properties => ({
  id: node.id,
  type: node.type,
  name: node.name,
})
