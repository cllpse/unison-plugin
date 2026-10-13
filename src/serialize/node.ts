import type { PropertiesErrorOrWarning } from "../types"
import {
  getMainDefinitionLayerForNode,
  hasExcludeFromOutputAnnotation,
} from "./annotationExclude"
import { serializeEllipse } from "./ellipse"
import { serializeFrame } from "./frame"
import { serializeGroup } from "./group"
import { serializeRectangle } from "./rectangle"
import { serializeText } from "./text"
import { serializeUnknown } from "./unknown"
import { serializeVector } from "./vector"

const shouldExcludeFromOutput = async (
  node: SceneNode & AnnotationsMixin,
  annotationCategories: Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>>,
  getMainComponentCached: (instance: InstanceNode) => Promise<ComponentNode | null>,
): Promise<boolean> => {
  if (!node.visible) {
    return true
  }

  if (hasExcludeFromOutputAnnotation(node.annotations, annotationCategories)) {
    return true
  }

  if (node.type === "INSTANCE") {
    const main = await getMainComponentCached(node)
    if (main !== null && hasExcludeFromOutputAnnotation(main.annotations, annotationCategories)) {
      return true
    }
  }

  const definitionLayer = await getMainDefinitionLayerForNode(node, getMainComponentCached)
  if (
    definitionLayer !== null &&
    "annotations" in definitionLayer &&
    hasExcludeFromOutputAnnotation(definitionLayer.annotations, annotationCategories)
  ) {
    return true
  }

  return false
}

const collectNodesById = (root: SceneNode): Map<string, SceneNode> => {
  const map = new Map<string, SceneNode>()

  const visit = (n: SceneNode) => {
    map.set(n.id, n)

    if ("children" in n) {
      for (const c of n.children) {
        visit(c)
      }
    }
  }

  visit(root)

  return map
}

const _node = async (node: SceneNode): Promise<PropertiesErrorOrWarning> => {
  switch (node.type) {
    case "FRAME":
      return serializeFrame(node)
    case "GROUP": {
      // matches Material Symbols plugin inserts
      if (node.children[0]?.name === "Bounding box" && node.children[1]?.type === "VECTOR") {
        return serializeVector(node.children[1])
      }
      // matches Google Material Design icons: a group of [Vector path, Rectangle]
      if (
        node.children.length === 2 &&
        node.children[0]?.type === "VECTOR" &&
        node.children[1]?.type === "RECTANGLE"
      ) {
        return serializeVector(node.children[0])
      }
      return serializeGroup(node)
    }
    case "VECTOR":
      return serializeVector(node)
    case "RECTANGLE":
      return serializeRectangle(node)
    case "ELLIPSE":
      return serializeEllipse(node)
    case "TEXT":
      return await serializeText(node)
    default:
      return serializeUnknown(
        node as SceneNode & AutoLayoutMixin & CornerMixin & LayoutMixin & MinimalFillsMixin & MinimalStrokesMixin,
      )
  }
}

export const serializeNode = async (root: SceneNode): Promise<PropertiesErrorOrWarning> => {
  const nodesById = collectNodesById(root)
  const annotationCategories = await figma.annotations.getAnnotationCategoriesAsync()
  const mainComponentByInstanceId = new Map<string, Promise<ComponentNode | null>>()

  const getMainComponentCached = (instance: InstanceNode): Promise<ComponentNode | null> => {
    const existing = mainComponentByInstanceId.get(instance.id)
    if (existing) {
      return existing
    }
    const p = instance.getMainComponentAsync()
    mainComponentByInstanceId.set(instance.id, p)
    return p
  }

  const serializeWithMap = async (node: SceneNode & AnnotationsMixin): Promise<PropertiesErrorOrWarning> => {
    if (await shouldExcludeFromOutput(node, annotationCategories, getMainComponentCached)) {
      return {
        properties: {
          EXCLUDE_FROM_OUTPUT: true,
        },
        errors: [],
        warnings: [],
      }
    }

    const r = await _node(node)

    const children = "children" in node ? node.children : []

    if (children.length > 0 && !("OVERRIDE_ICON_NAME" in r.properties) && !("OVERRIDE_TEXT_CONTENT" in r.properties)) {
      r.properties.children = await Promise.all(
        children.map((child) => {
          const id = child.id
          const fullNode = id !== null ? nodesById.get(id) : null
          const target = fullNode ?? child

          return serializeWithMap(target as SceneNode & AnnotationsMixin)
        }),
      )
    }

    return {
      properties: r.properties,
      errors: r.errors,
      warnings: r.warnings,
    }
  }

  const r = await serializeWithMap(root as SceneNode & AnnotationsMixin)

  return r
}
