import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import type { ErrorOrWarning, PropertiesErrorOrWarning } from "../types"

// Figma emits path data with up to 4 decimals per coordinate; 2 keeps icons crisp at any size while keeping the
// generated JSX short.
const _round = (n: number): string => String(Math.round(n * 100) / 100)

const _roundPath = (data: string): string => data.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (n) => _round(Number(n)))

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
      message: `Error @ ${node.name} – VECTOR has no path data.`,
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

      path: geometry.map((g) => _roundPath(g.data)).join(" "),
      viewBox: [minX, minY, box.width, box.height].map(_round).join(" "),
      fillRule: geometry.some((g) => g.windingRule === "EVENODD") ? "evenodd" : undefined,
    },

    errors,
    warnings: fill.warnings,
  }
}
