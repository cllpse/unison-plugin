import type { PropertiesErrorOrWarning } from "../types"
import { getMainDefinitionLayerForNode, hasExcludeFromOutputAnnotation } from "./annotationExclude"
import { serializeFrame } from "./frame"
import { serializeGroup } from "./group"
import { serializeText } from "./text"
import { serializeUnsupported } from "./unsupported"
import { serializeVector } from "./vector"

const shouldExcludeFromOutput = async (
  node: SceneNode & AnnotationsMixin,
  annotationCategories: Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>>,
  getMainComponentCached: (instance: InstanceNode) => Promise<ComponentNode | null>,
): Promise<boolean> => {
  if (!node.visible) return true
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

const serializeLayer = async (node: SceneNode): Promise<PropertiesErrorOrWarning> => {
  switch (node.type) {
    case "FRAME":
      return serializeFrame(node)
    case "GROUP": {
      // matches Material Symbols plugin inserts
      if (node.children[0]?.name === "Bounding box" && node.children[1]?.type === "VECTOR") {
        return serializeVector(node.children[1], node)
      }

      // matches Google Material Design icons: a group of [Vector path, Rectangle]
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

export const serializeNode = async (root: SceneNode): Promise<PropertiesErrorOrWarning> => {
  const annotationCategories = await figma.annotations.getAnnotationCategoriesAsync()
  const mainComponentByInstanceId = new Map<string, Promise<ComponentNode | null>>()

  const getMainComponentCached = (instance: InstanceNode): Promise<ComponentNode | null> => {
    const existing = mainComponentByInstanceId.get(instance.id)

    if (existing) return existing

    const main = instance.getMainComponentAsync()

    mainComponentByInstanceId.set(instance.id, main)

    return main
  }

  const serializeTree = async (node: SceneNode & AnnotationsMixin): Promise<PropertiesErrorOrWarning> => {
    if (await shouldExcludeFromOutput(node, annotationCategories, getMainComponentCached)) {
      return {
        properties: {
          EXCLUDE_FROM_OUTPUT: true,
        },
        errors: [],
        warnings: [],
      }
    }

    const r = await serializeLayer(node)

    // A top-level layer (its parent is the page or a section, not a frame) reports its own errors as notices, except
    // the ones that always stay errors (missing auto layout).
    if (!isInFrame(node) && r.errors.length > 0) {
      r.warnings = [...r.errors.filter((error) => !error.always), ...r.warnings]
      r.errors = r.errors.filter((error) => error.always)
    }

    const children = "children" in node ? node.children : []

    // A vector is a leaf: an icon group serialized as a vector already holds its glyph, so its layers are not children.
    if (r.properties.type !== "VECTOR" && children.length > 0) {
      r.properties.children = await Promise.all(
        children.map((child) => serializeTree(child as SceneNode & AnnotationsMixin)),
      )
    }

    return r
  }

  return serializeTree(root as SceneNode & AnnotationsMixin)
}
