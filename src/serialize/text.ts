import { readAlignmentText } from "../read/alignment"
import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import { readLayerSettings } from "../read/layer"
import { readTextDecoration, readTypography } from "../read/typography"
import type { PropertiesAndIssues } from "../types"
import { combineReads } from "../utilities"

export const serializeText = async (node: TextNode): Promise<PropertiesAndIssues> => {
  // In the order of Figma's right panel, like the rendered flags.
  const { properties, ...issues } = combineReads([
    readLayerSettings(node),
    await readTypography(node),
    readAlignmentText(node),
    readTextDecoration(node),
    await readFill(node),
  ])

  return {
    properties: {
      ...readIdentity(node),

      ...properties,

      characters: node.characters,
    },

    ...issues,
  }
}
