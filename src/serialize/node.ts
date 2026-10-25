import { findCounterpart, findHover, readGroupHover, readHover } from "../read/hover"
import type { Issue, PropertiesAndIssues } from "../types"
import { combineReads, truncateName } from "../utilities"
import {
  type AnnotationCategories,
  getMainDefinitionLayerForNode,
  hasExcludeFromOutputAnnotation,
} from "./annotationExclude"
import { serializeFrame } from "./frame"
import { serializeGroup } from "./group"
import { serializeText } from "./text"
import { serializeUnsupported } from "./unsupported"
import { serializeVector } from "./vector"

const shouldExcludeFromOutput = async (
  node: SceneNode & AnnotationsMixin,
  annotationCategories: AnnotationCategories,
  getMainComponentCached: (instance: InstanceNode) => Promise<ComponentNode | null>,
): Promise<boolean> => {
  if (hasExcludeFromOutputAnnotation(node.annotations, annotationCategories)) return true

  // For an instance this is its main component, so its own annotations are checked here too.
  const definitionLayer = await getMainDefinitionLayerForNode(node, getMainComponentCached)

  return (
    definitionLayer !== null &&
    "annotations" in definitionLayer &&
    hasExcludeFromOutputAnnotation(definitionLayer.annotations, annotationCategories)
  )
}

const isInFrame = (node: SceneNode): boolean =>
  node.parent !== null &&
  node.parent.type !== "PAGE" &&
  node.parent.type !== "SECTION" &&
  node.parent.type !== "DOCUMENT"

const isSizeError = (error: Issue): boolean => error.property === "WIDTH" || error.property === "HEIGHT"

type Icon = { vector: VectorNode; box: SceneNode }

/** An icon drawn by one vector, and the box around it that sets its size and padding. */
const findIcon = (node: SceneNode): Icon | undefined => {
  if (node.type === "GROUP") {
    // The Material Symbols plugin inserts an icon as a bounding box and its vector.
    if (node.children[0]?.name === "Bounding box" && node.children[1]?.type === "VECTOR") {
      return { vector: node.children[1], box: node }
    }

    // Google's Material Design icons are a group of the vector path and a rectangle.
    if (node.children.length === 2 && node.children[0]?.type === "VECTOR" && node.children[1]?.type === "RECTANGLE") {
      return { vector: node.children[0], box: node }
    }
  }

  // An icon component is a fixed box without auto layout around its vector, or around one of the groups above.
  if (
    (node.type === "INSTANCE" || node.type === "COMPONENT") &&
    node.layoutMode === "NONE" &&
    node.children.length === 1
  ) {
    const child = node.children[0]

    if (child.type === "VECTOR") return { vector: child, box: node }

    const inner = findIcon(child)

    if (inner !== undefined) return { vector: inner.vector, box: node }
  }

  return undefined
}

const serializeLayer = async (node: SceneNode): Promise<PropertiesAndIssues> => {
  const icon = findIcon(node)

  if (icon !== undefined) return serializeVector(icon.vector, icon.box)

  switch (node.type) {
    // A component or instance renders as the Frame it is, so its own settings and hover survive.
    case "FRAME":
    case "COMPONENT":
    case "INSTANCE":
      return serializeFrame(node)
    case "GROUP":
      return serializeGroup(node)
    case "VECTOR":
      return serializeVector(node)
    case "TEXT":
      return serializeText(node)
    default:
      return serializeUnsupported(node)
  }
}

/**
 * Inside a layer with a hover: the matching layer in its hover variant, and whether any layer follows the hover, which
 * makes the hovered layer a `group`.
 */
type HoverScope = {
  counterpart: SceneNode
  group: { used: boolean }
}

export const serializeNode = async (root: SceneNode): Promise<PropertiesAndIssues> => {
  const annotationCategories = await figma.annotations.getAnnotationCategoriesAsync()
  const mainComponentByInstanceId = new Map<string, Promise<ComponentNode | null>>()

  const getMainComponentCached = (instance: InstanceNode): Promise<ComponentNode | null> => {
    const existing = mainComponentByInstanceId.get(instance.id)

    if (existing !== undefined) return existing

    const main = instance.getMainComponentAsync()

    mainComponentByInstanceId.set(instance.id, main)

    return main
  }

  const serializeTree = async (
    node: SceneNode & AnnotationsMixin,
    scope?: HoverScope,
  ): Promise<PropertiesAndIssues> => {
    // A hidden layer is left out like an excluded one, but noted, since hiding is easy to miss in the layers panel.
    if (!node.visible) {
      return {
        properties: { type: node.type, EXCLUDE_FROM_OUTPUT: true },
        errors: [],
        warnings: [],
        notifications: [
          {
            nodeId: node.id,
            layer: truncateName(node.name),
            property: "LAYER",
            problem: "hidden, skipped",
            explanation: "Left out, along with everything inside it.",
          },
        ],
      }
    }

    if (await shouldExcludeFromOutput(node, annotationCategories, getMainComponentCached)) {
      return {
        properties: {
          EXCLUDE_FROM_OUTPUT: true,
        },
        errors: [],
        warnings: [],
      }
    }

    let result = await serializeLayer(node)

    // A top-level layer (its parent is the page or a section, not a frame) has no parent to size against, so its width
    // and height aren't checked: their errors become notifications; its other errors stay errors.
    if (!isInFrame(node)) {
      const sizeNotifications = result.errors.filter(isSizeError).map((error) => ({
        ...error,
        explanation: `A top-level layer has no parent to size against, so its ${error.property.toLowerCase()} is left out.`,
      }))

      result.notifications = [...sizeNotifications, ...(result.notifications ?? [])]
      result.errors = result.errors.filter((error) => !isSizeError(error))
    }

    // A layer with a hover of its own reads it against its hover variant; a layer inside one, against its counterpart
    // there. A Vector has no hover flags; an icon is compared by its vector.
    const isVector = result.properties.type === "VECTOR"
    const hover = isVector ? undefined : await findHover(node)
    const ownScope = hover ? { counterpart: hover.variant, group: { used: false } } : scope

    if (hover !== undefined) result = combineReads([result, await readHover(node, hover)])

    if (hover === undefined && scope !== undefined) {
      const icon = isVector ? findIcon(node) : undefined
      const counterpart = icon ? (findIcon(scope.counterpart)?.vector ?? scope.counterpart) : scope.counterpart
      const component = isVector ? "Vector" : result.properties.type === "TEXT" ? "Text" : "Frame"
      const groupHover = await readGroupHover(icon?.vector ?? node, counterpart, component)

      if (Object.keys(groupHover.properties).length > 0) scope.group.used = true

      result = combineReads([result, groupHover])
    }

    const children = "children" in node ? node.children : []

    // A vector is a leaf: an icon group serialized as a vector already holds its glyph, so its layers are not children.
    if (!isVector && children.length > 0) {
      result.properties.children = await Promise.all(
        children.map((child, index) => {
          const counterpart = ownScope && findCounterpart(child, index, ownScope.counterpart)

          return serializeTree(
            child as SceneNode & AnnotationsMixin,
            ownScope && counterpart ? { ...ownScope, counterpart } : undefined,
          )
        }),
      )
    }

    if (hover !== undefined && ownScope?.group.used) result.properties.group = true

    return result
  }

  return serializeTree(root as SceneNode & AnnotationsMixin)
}
