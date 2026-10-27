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

/**
 * One side's `width-` / `height-` flag: the spacing token the side is bound to. An unbound side, or one bound to
 * `spacing-full`, gets no flag, and the vector stretches to its container on that side, keeping the viewBox's aspect
 * ratio. A side bound to another variable is an error.
 */
const readSide = async (
  box: SceneNode,
  label: "WIDTH" | "HEIGHT",
  prefix: "width-" | "height-",
  size: number,
  bound: VariableAlias | undefined,
  errors: Issue[],
): Promise<string | undefined> => {
  if (bound === undefined) return undefined

  const className = await resolveBoundUnitClass(prefix, bound)

  if (className === `${prefix}full`) return undefined

  if (className === undefined) {
    errors.push({
      nodeId: box.id,
      layer: truncateName(box.name),
      property: label,
      problem: "not a token",
      value: formatValue(size),
    })
  }

  return className
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

  // A side bound to a spacing token pins the box; the others stretch to the container.
  const bound = "boundVariables" in box ? box.boundVariables : undefined
  const width = await readSide(box, "WIDTH", "width-", box.width, bound?.width, errors)
  const height = await readSide(box, "HEIGHT", "height-", box.height, bound?.height, errors)

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
