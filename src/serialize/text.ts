import { readAlignmentText } from "../read/alignment"
import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import { readTypography } from "../read/typography"
import type { PropertiesErrorOrWarning } from "../types"

export const serializeText = async (node: TextNode): Promise<PropertiesErrorOrWarning> => {
  const fill = await readFill(node)
  const alignment = readAlignmentText(node)
  const typography = await readTypography(node)

  // In the order of Figma's right panel, like the rendered flags.
  const errors = [...typography.errors, ...alignment.errors, ...fill.errors]

  const characters = node.characters

  return {
    properties: {
      ...readIdentity(node),

      ...alignment.properties,
      ...fill.properties,
      ...typography.properties,

      characters,
    },

    errors,
    warnings: [...typography.warnings, ...alignment.warnings, ...fill.warnings],
  }
}
