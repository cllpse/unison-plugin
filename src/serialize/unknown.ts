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
import { truncateName } from "../utilities"

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

    // Components, instances and other frame-like layers need auto layout too (reported by readLayout); other layers
    // have none to report. The rest is in the order of Figma's right panel, like the rendered flags.
    errors: [
      ...("layoutMode" in node ? layout.errors : []),
      ...dimensions.errors,
      ...alignment.errors,
      ...gap.errors,
      ...padding.errors,
      ...cornerRadius.errors,
      ...fill.errors,
      ...stroke.errors,
    ],
    warnings: [
      {
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "LAYER",
        problem: `unsupported (${node.type})`,
      },
      ...layout.warnings,
      ...dimensions.warnings,
      ...alignment.warnings,
      ...gap.warnings,
      ...padding.warnings,
      ...cornerRadius.warnings,
      ...fill.warnings,
      ...stroke.warnings,
    ],
  }
}
