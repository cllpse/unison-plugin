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

  const errors: ErrorOrWarning[] = [
    ...alignment.errors,
    ...cornerRadius.errors,
    ...dimensions.errors,
    ...effect.errors,
    ...fill.errors,
    ...gap.errors,
    ...layout.errors,
    ...padding.errors,
    ...stroke.errors,
  ]

  const warnings: ErrorOrWarning[] = [
    ...alignment.warnings,
    ...cornerRadius.warnings,
    ...dimensions.warnings,
    ...effect.warnings,
    ...fill.warnings,
    ...gap.warnings,
    ...layout.warnings,
    ...padding.warnings,
    ...stroke.warnings,
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
