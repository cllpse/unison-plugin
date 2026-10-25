import { COLOR_COMPONENTS, type ColorComponent, type State } from "../../unison-components/maps"
import type { Issue, PropertiesAndIssues } from "../types"
import { combineReads, truncateName } from "../utilities"
import { readPaints } from "./color"
import { readFill } from "./fill"

/** A "While hovering → Change to" interaction: the variant shown on hover. */
export type Hover = {
  variant: SceneNode
}

const EMPTY: PropertiesAndIssues = { properties: {}, errors: [], warnings: [] }

/**
 * A layer's hover, as Figma models it: a variant with a "While hovering" interaction that changes to another variant.
 * An instance carries the interactions of its main component.
 */
export const findHover = async (node: SceneNode): Promise<Hover | undefined> => {
  if (!("reactions" in node)) return undefined

  const main = node.type === "INSTANCE" && node.reactions.length === 0 ? await node.getMainComponentAsync() : null
  const reactions = main?.reactions ?? node.reactions

  for (const reaction of reactions) {
    if (reaction.trigger?.type !== "ON_HOVER") continue

    for (const action of reaction.actions ?? []) {
      if (action.type !== "NODE" || action.navigation !== "CHANGE_TO" || action.destinationId === null) continue

      const variant = await figma.getNodeByIdAsync(action.destinationId)

      if (variant !== null && "visible" in variant) return { variant }
    }
  }

  return undefined
}

/**
 * The layer in the hover variant that a layer changes into, matched by name as Smart animate does; the index tells
 * apart siblings of the same name.
 */
export const findCounterpart = (child: SceneNode, index: number, counterpart: SceneNode): SceneNode | undefined => {
  if (!("children" in counterpart)) return undefined

  const atIndex = counterpart.children[index]

  if (atIndex?.name === child.name) return atIndex

  return counterpart.children.find((candidate) => candidate.name === child.name)
}

const getPaints = (node: SceneNode, kind: "FILL" | "STROKE"): ReadonlyArray<Paint> | typeof figma.mixed | undefined => {
  if (kind === "FILL") return "fills" in node ? node.fills : undefined

  return "strokes" in node ? node.strokes : undefined
}

const isSamePaint = (node: SceneNode, counterpart: SceneNode, kind: "FILL" | "STROKE"): boolean =>
  JSON.stringify(getPaints(node, kind)) === JSON.stringify(getPaints(counterpart, kind))

const readColor = async (node: SceneNode, kind: "FILL" | "STROKE"): Promise<PropertiesAndIssues> => {
  const paints = getPaints(node, kind)

  if (paints === undefined) return EMPTY
  if (kind === "FILL") return readFill(node as SceneNode & MinimalFillsMixin)

  return readPaints(node, kind, paints as ReadonlyArray<Paint>)
}

const toHoverIssue = (issue: Issue): Issue => ({ ...issue, property: `HOVER ${issue.property}` })

/**
 * The flag for a paint the hover variant changes, named from its color by `flag`. The variant's own problems with it
 * (not bound, not a token) are reported on the variant, so selecting the issue leads there.
 */
const readHoverColor = async (
  node: SceneNode,
  counterpart: SceneNode,
  kind: "FILL" | "STROKE",
  flag: (color: string) => string,
): Promise<PropertiesAndIssues> => {
  if (isSamePaint(node, counterpart, kind)) return EMPTY

  const prefix = `${kind.toLowerCase()}-`
  const hover = await readColor(counterpart, kind)

  if (hover.errors.length > 0) return { properties: {}, errors: hover.errors.map(toHoverIssue), warnings: [] }

  const color = Object.keys(hover.properties)
    .find((key) => key.startsWith(prefix))
    ?.slice(prefix.length)

  // A variant without the paint shows what is behind the layer.
  return {
    properties: { [flag(color ?? "transparent")]: true },
    errors: [],
    warnings: hover.warnings.map(toHoverIssue),
  }
}

/** A layer's own hover: the fill and stroke its hover variant changes to (`fill-hover-`, `stroke-hover-`). */
export const readHover = async (node: SceneNode, hover: Hover): Promise<PropertiesAndIssues> =>
  combineReads([
    await readHoverColor(node, hover.variant, "FILL", (color) => `fill-hover-${color}`),
    await readHoverColor(node, hover.variant, "STROKE", (color) => `stroke-hover-${color}`),
  ])

/** Whether a component's fill or stroke follows its group's hover, as the library's `COLOR_COMPONENTS` lists it. */
const followsGroupHover = (component: ColorComponent, property: "fill" | "stroke"): boolean => {
  const config = (COLOR_COMPONENTS[component] as Partial<Record<string, { groupStates: readonly State[] }>>)[property]

  return config?.groupStates.includes("hover") ?? false
}

/**
 * A layer inside a hovered one, against its counterpart in the hover variant: the fill and stroke it changes to with
 * its group's hover (`group-hover-fill-`, `group-hover-stroke-`). A change the component can't follow is left out.
 */
export const readGroupHover = async (
  node: SceneNode,
  counterpart: SceneNode,
  component: ColorComponent,
): Promise<PropertiesAndIssues> => {
  const reads = await Promise.all(
    (["FILL", "STROKE"] as const).map(async (kind) => {
      const property = kind === "FILL" ? "fill" : "stroke"

      if (followsGroupHover(component, property)) {
        return readHoverColor(node, counterpart, kind, (color) => `group-hover-${property}-${color}`)
      }

      if (isSamePaint(node, counterpart, kind)) return EMPTY

      const warning: Issue = {
        nodeId: node.id,
        layer: truncateName(node.name),
        property: `HOVER ${kind}`,
        problem: "unsupported",
        explanation: `A ${component} can't change its ${property} with its parent's hover, so this keeps it.`,
      }

      return { properties: {}, errors: [], warnings: [warning] }
    }),
  )

  return combineReads(reads)
}
