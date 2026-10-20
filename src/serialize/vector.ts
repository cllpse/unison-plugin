import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import { resolveBoundUnitClass } from "../read/unit"
import type { ErrorOrWarning, PropertiesErrorOrWarning } from "../types"
import { formatValue, truncateName } from "../utilities"

// Figma emits path data with up to 4 decimals per coordinate; 2 keeps icons crisp at any size while keeping the
// generated JSX short.
const round = (n: number): string => String(Math.round(n * 100) / 100)

const roundPath = (data: string): string => data.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => round(Number(n)))

/**
 * Serialize a vector to its fill geometry. `box` is the layer the vector sits in when an icon wraps it in a
 * padded bounding box (Material Symbols, Material Design icons); the viewBox then spans that box so the padding
 * survives, instead of cropping to the glyph.
 */
export const serializeVector = async (node: VectorNode, box: SceneNode = node): Promise<PropertiesErrorOrWarning> => {
  const fill = await readFill(node)

  const errors: ErrorOrWarning[] = [...fill.errors]

  // `fillGeometry` is the filled outline (strokes excluded); fall back to the raw vector network for unfilled vectors.
  const geometry = node.fillGeometry.length > 0 ? node.fillGeometry : node.vectorPaths

  if (geometry.length === 0) {
    errors.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "VECTOR PATH",
      problem: "missing",
    })
  }

  // A vector renders in a fixed `width-` / `height-` box; like a fixed Frame, both sides must be bound to a unit
  // design token.
  const bound = "boundVariables" in box ? box.boundVariables : undefined
  const width = bound?.width ? await resolveBoundUnitClass("width-", bound.width) : undefined
  const height = bound?.height ? await resolveBoundUnitClass("height-", bound.height) : undefined

  if (!bound?.width) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "WIDTH",
      problem: "not bound",
      value: formatValue(box.width),
    })
  } else if (width === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "WIDTH",
      problem: "not a token",
      value: formatValue(box.width),
    })
  }

  if (!bound?.height) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "HEIGHT",
      problem: "not bound",
      value: formatValue(box.height),
    })
  } else if (height === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "HEIGHT",
      problem: "not a token",
      value: formatValue(box.height),
    })
  }

  // Path data is in the vector's own coordinates, so the box's origin is the vector's offset from it, negated. Both
  // positions are relative to the same parent, since groups do not introduce a coordinate space.
  const minX = box === node ? 0 : box.x - node.x
  const minY = box === node ? 0 : box.y - node.y

  return {
    properties: {
      ...readIdentity(node),

      ...fill.properties,

      ...(width ? { [width]: true } : {}),
      ...(height ? { [height]: true } : {}),

      path: geometry.map((g) => roundPath(g.data)).join(" "),
      viewBox: [minX, minY, box.width, box.height].map(round).join(" "),
      fillRule: geometry.some((g) => g.windingRule === "EVENODD") ? "evenodd" : undefined,
    },

    errors,
    warnings: fill.warnings,
  }
}
