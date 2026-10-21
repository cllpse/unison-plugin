import type { Issue, PropertiesAndIssues } from "../types"
import { truncateName } from "../utilities"
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

const serializeLayer = async (node: SceneNode): Promise<PropertiesAndIssues> => {
  switch (node.type) {
    case "FRAME":
      return serializeFrame(node)
    case "GROUP": {
      // The Material Symbols plugin inserts an icon as a bounding box and its vector.
      if (node.children[0]?.name === "Bounding box" && node.children[1]?.type === "VECTOR") {
        return serializeVector(node.children[1], node)
      }

      // Google's Material Design icons are a group of the vector path and a rectangle.
      if (node.children.length === 2 && node.children[0]?.type === "VECTOR" && node.children[1]?.type === "RECTANGLE") {
        return serializeVector(node.children[0], node)
      }

      return serializeGroup(node)
    }
    case "VECTOR":
      return serializeVector(node)
    case "TEXT":
      return serializeText(node)
    default:
      return serializeUnsupported(node)
  }
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

  const serializeTree = async (node: SceneNode & AnnotationsMixin): Promise<PropertiesAndIssues> => {
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

    const result = await serializeLayer(node)

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

    const children = "children" in node ? node.children : []

    // A vector is a leaf: an icon group serialized as a vector already holds its glyph, so its layers are not children.
    if (result.properties.type !== "VECTOR" && children.length > 0) {
      result.properties.children = await Promise.all(
        children.map((child) => serializeTree(child as SceneNode & AnnotationsMixin)),
      )
    }

    return result
  }

  return serializeTree(root as SceneNode & AnnotationsMixin)
}
