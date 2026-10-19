import { readAlignmentFrame } from "../read/alignment"
import { readCornerRadius } from "../read/cornerRadius"
import { readDimensions } from "../read/dimensions"
import { readEffect } from "../read/effect"
import { readFill } from "../read/fill"
import { readGap } from "../read/gap"
import { readIdentity } from "../read/identity"
import { readLayout } from "../read/layout"
import { readPadding } from "../read/padding"
import { readStroke } from "../read/stroke"
import type { ErrorOrWarning, PropertiesErrorOrWarning } from "../types"

export const serializeFrame = async (node: FrameNode | ComponentNode): Promise<PropertiesErrorOrWarning> => {
  const alignment = readAlignmentFrame(node)
  const cornerRadius = await readCornerRadius(node)
  const dimensions = await readDimensions(node)
  const effect = await readEffect(node)
  const fill = await readFill(node)
  const gap = await readGap(node)
  const layout = readLayout(node)
  const padding = await readPadding(node)
  const stroke = await readStroke(node)

  // In the order of Figma's right panel, like the rendered flags.
  const errors: ErrorOrWarning[] = [
    ...layout.errors,
    ...dimensions.errors,
    ...alignment.errors,
    ...gap.errors,
    ...padding.errors,
    ...cornerRadius.errors,
    ...fill.errors,
    ...stroke.errors,
    ...effect.errors,
  ]

  const warnings: ErrorOrWarning[] = [
    ...layout.warnings,
    ...dimensions.warnings,
    ...alignment.warnings,
    ...gap.warnings,
    ...padding.warnings,
    ...cornerRadius.warnings,
    ...fill.warnings,
    ...stroke.warnings,
    ...effect.warnings,
  ]
  return {
    properties: {
      ...readIdentity(node),

      ...alignment.properties,
      ...cornerRadius.properties,
      ...dimensions.properties,
      ...effect.properties,
      ...fill.properties,
      ...gap.properties,
      ...layout.properties,
      ...padding.properties,
      ...stroke.properties,

      children: node.children,
    },

    errors,
    warnings,
  }
}
