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
import type { PropertiesErrorOrWarning } from "../types"
import { formatValue, truncateName } from "../utilities"

const EMPTY: PropertiesErrorOrWarning = { properties: {}, errors: [], warnings: [] }

/**
 * Any layer the library has no component for (rectangle, ellipse, line, star, polygon, boolean operation, slice,
 * section, component, instance, ...). It is reported as unsupported and rendered as `This` with whatever settings it
 * has, so its size, fill, stroke and corners survive; component and instance wrappers render only their children.
 */
export const serializeUnsupported = async (node: SceneNode): Promise<PropertiesErrorOrWarning> => {
  // Components, instances and other frame-like layers need auto layout too; other layers have none to report.
  const layout = "layoutMode" in node ? readLayout(node) : EMPTY
  const dimensions = "layoutSizingHorizontal" in node ? await readDimensions(node) : EMPTY
  const alignment = "layoutMode" in node ? readAlignmentFrame(node) : EMPTY
  const gap = "itemSpacing" in node ? await readGap(node) : EMPTY
  const padding = "paddingLeft" in node ? await readPadding(node) : EMPTY
  // An ellipse's corner radius only rounds its arcs; it is read as fully rounded instead.
  const cornerRadius = node.type !== "ELLIPSE" && "cornerSmoothing" in node ? await readCornerRadius(node) : EMPTY
  const fill = "fills" in node ? await readFill(node) : EMPTY
  const stroke = "strokes" in node ? await readStroke(node) : EMPTY
  const effect = "effects" in node ? await readEffect(node) : EMPTY

  // In the order of Figma's right panel, like the rendered flags.
  const reads = [layout, dimensions, alignment, gap, padding, cornerRadius, fill, stroke, effect]

  return {
    properties: {
      ...readIdentity(node),

      ...Object.assign({}, ...reads.map((read) => read.properties)),

      ...(node.type === "ELLIPSE" ? { "corner-radius-full": true } : {}),
    },

    errors: reads.flatMap((read) => read.errors),
    warnings: [
      {
        nodeId: node.id,
        layer: truncateName(node.name),
        property: "LAYER",
        problem: "unsupported",
        value: formatValue(node.type),
      },
      ...reads.flatMap((read) => read.warnings),
    ],
  }
}
