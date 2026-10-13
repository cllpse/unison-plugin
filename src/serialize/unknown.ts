import { readAlignmentFrame } from "../read/alignment"
import { readCornerRadius } from "../read/cornerRadius"
import { readDimensions } from "../read/dimensions"
import { readFill } from "../read/fill"
import { readGap } from "../read/gap"
import { readIdentity } from "../read/identity"
import { readLayout } from "../read/layout"
import { readPadding } from "../read/padding"
import { readStroke } from "../read/stroke"
import type { PropertiesErrorOrWarning } from "../types"

export const serializeUnknown = async (
  node: SceneNode & AutoLayoutMixin & CornerMixin & LayoutMixin & MinimalFillsMixin & MinimalStrokesMixin,
): Promise<PropertiesErrorOrWarning> => {
  const alignment = readAlignmentFrame(node)
  const cornerRadius = await readCornerRadius(node)
  const dimensions = await readDimensions(node)
  const fill = await readFill(node)
  const gap = await readGap(node)
  const layout = readLayout(node)
  const padding = await readPadding(node)
  const stroke = await readStroke(node)

  return {
    properties: {
      ...readIdentity(node),

      ...alignment.properties,
      ...cornerRadius.properties,
      ...dimensions.properties,
      ...fill.properties,
      ...gap.properties,
      ...layout.properties,
      ...padding.properties,
      ...stroke.properties,

      children: "children" in node ? node.children : [],
    },

    errors: [],
    warnings: [
      {
        nodeId: node.id,
        message: `Notice @ "${node.name}" – unknown layer type.`,
      },
    ],
  }
}
