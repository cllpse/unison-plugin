import { readFill } from "../read/fill"
import { readIdentity } from "../read/identity"
import { readLayerSettings } from "../read/layer"
import { resolveBoundUnitClass } from "../read/unit"
import type { Issue, PropertiesAndIssues } from "../types"
import { formatValue, truncateName } from "../utilities"

// Figma emits path data with up to 4 decimals per coordinate; 2 keeps icons crisp at any size while keeping the
// generated JSX short.
const round = (value: number): string => String(Math.round(value * 100) / 100)

const roundPath = (data: string): string => data.replace(/-?\d*\.?\d+(?:e-?\d+)?/gi, (number) => round(Number(number)))

/** A vector size in pixels: `spacing-full` stands for 100%, which a vector's box can't take. */
const resolvePixelClass = async (prefix: string, alias: VariableAlias): Promise<string | undefined> => {
  const className = await resolveBoundUnitClass(prefix, alias)

  return className === `${prefix}full` ? undefined : className
}

/**
 * Serialize a vector to its fill geometry. `box` is the layer the vector sits in when an icon wraps it in a
 * padded bounding box (Material Symbols, Material Design icons, an icon component); the viewBox then spans that box so
 * the padding survives, instead of cropping to the glyph.
 */
export const serializeVector = async (node: VectorNode, box: SceneNode = node): Promise<PropertiesAndIssues> => {
  const fill = await readFill(node)

  const errors: Issue[] = [...fill.errors]

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
  const width = bound?.width !== undefined ? await resolvePixelClass("width-", bound.width) : undefined
  const height = bound?.height !== undefined ? await resolvePixelClass("height-", bound.height) : undefined

  if (bound?.width === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "WIDTH",
      problem: "not bound",
      value: formatValue(box.width),
    })
  }

  if (bound?.width !== undefined && width === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "WIDTH",
      problem: "not a token",
      value: formatValue(box.width),
    })
  }

  if (bound?.height === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "HEIGHT",
      problem: "not bound",
      value: formatValue(box.height),
    })
  }

  if (bound?.height !== undefined && height === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: "HEIGHT",
      problem: "not a token",
      value: formatValue(box.height),
    })
  }

  const warnings: Issue[] = [...readLayerSettings(box).warnings, ...fill.warnings]

  // Only the fill geometry is rendered, so a stroked icon loses its outline.
  if (node.strokes.some((paint) => paint.visible !== false)) {
    warnings.push({
      nodeId: node.id,
      layer: truncateName(node.name),
      property: "STROKE",
      problem: "unsupported",
      value: "vector",
      explanation: "Only the vector's fill is rendered, so its outline is lost.",
    })
  }

  // Path data is in the vector's own coordinates, so the box's origin is the vector's offset from it, negated. The
  // offset is taken from the absolute positions, since an icon instance has its own coordinate space and a group not.
  const minX = box === node ? 0 : box.absoluteTransform[0][2] - node.absoluteTransform[0][2]
  const minY = box === node ? 0 : box.absoluteTransform[1][2] - node.absoluteTransform[1][2]

  return {
    properties: {
      ...readIdentity(node),

      ...fill.properties,

      ...(width ? { [width]: true } : {}),
      ...(height ? { [height]: true } : {}),

      path: geometry.map((path) => roundPath(path.data)).join(" "),
      viewBox: [minX, minY, box.width, box.height].map(round).join(" "),
      fillRule: geometry.some((path) => path.windingRule === "EVENODD") ? "evenodd" : undefined,
    },

    errors,
    warnings,
    notifications: fill.notifications,
  }
}
