import { readAlignmentFrame } from "../read/alignment"
import { readCornerRadius } from "../read/cornerRadius"
import { readDimensions } from "../read/dimensions"
import { readEffect } from "../read/effect"
import { readFill } from "../read/fill"
import { readGap } from "../read/gap"
import { readIdentity } from "../read/identity"
import { readLayerSettings } from "../read/layer"
import { readLayout } from "../read/layout"
import { readPadding } from "../read/padding"
import { readStroke } from "../read/stroke"
import type { PropertiesAndIssues } from "../types"
import { combineReads } from "../utilities"

export const serializeFrame = async (node: FrameNode | ComponentNode | InstanceNode): Promise<PropertiesAndIssues> => {
  // In the order of Figma's right panel, like the rendered flags.
  const { properties, ...issues } = combineReads([
    readLayerSettings(node),
    readLayout(node),
    await readDimensions(node),
    readAlignmentFrame(node),
    await readGap(node),
    await readPadding(node),
    await readCornerRadius(node),
    await readFill(node),
    await readStroke(node),
    await readEffect(node),
  ])

  return {
    properties: {
      ...readIdentity(node),

      ...properties,

      children: node.children,
    },

    ...issues,
  }
}
