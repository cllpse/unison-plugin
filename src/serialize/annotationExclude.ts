/** Dev Mode annotation category / note used to drop a layer from exported output. */
const EXCLUDE_MARK = "EXCLUDE_FROM_OUTPUT"

const normalizeExcludeToken = (s: string | undefined): string => (s ?? "").trim().toUpperCase()

export const annotationMatchesExcludeFromOutput = (
  a: Annotation,
  annotationCategories: Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>> | undefined,
): boolean => {
  if (normalizeExcludeToken(a.label) === EXCLUDE_MARK) {
    return true
  }

  if (a.labelMarkdown && normalizeExcludeToken(a.labelMarkdown.replace(/<[^>]+>/g, " ")) === EXCLUDE_MARK) {
    return true
  }

  const cats = annotationCategories ?? []
  if (a.categoryId !== undefined) {
    for (const c of cats) {
      if (c.id === a.categoryId && normalizeExcludeToken(c.label) === EXCLUDE_MARK) {
        return true
      }
    }
  }

  return false
}

export const hasExcludeFromOutputAnnotation = (
  annotations: ReadonlyArray<Annotation> | undefined,
  annotationCategories: Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>> | undefined,
): boolean => (annotations ?? []).some((a) => annotationMatchesExcludeFromOutput(a, annotationCategories))

const findNearestInstanceAncestor = (node: SceneNode): InstanceNode | null => {
  let walk: BaseNode | null = node
  while (walk) {
    if (walk.type === "INSTANCE") {
      return walk
    }
    walk = walk.parent
  }
  return null
}

/**
 * For nodes under a component instance, annotations are often authored on the main component.
 * Map this node to the corresponding layer in `getMainComponentAsync()` via child indices.
 */
export const getMainDefinitionLayerForNode = async (
  node: SceneNode,
  getMainComponent: (instance: InstanceNode) => Promise<ComponentNode | null>,
): Promise<SceneNode | null> => {
  const instance = findNearestInstanceAncestor(node)
  if (instance === null) {
    return null
  }

  if (node === instance) {
    return await getMainComponent(instance)
  }

  const path: number[] = []
  let current: BaseNode | null = node
  while (current !== null) {
    const parent: BaseNode | null = current.parent
    if (parent === null) {
      return null
    }
    if (!("children" in parent)) {
      return null
    }
    const siblings: ReadonlyArray<SceneNode> = (parent as ChildrenMixin).children
    const idx = siblings.indexOf(current as SceneNode)
    if (idx < 0) {
      return null
    }
    path.unshift(idx)
    if (parent === instance) {
      break
    }
    current = parent
  }

  if (current === null || current.parent !== instance) {
    return null
  }

  const main = await getMainComponent(instance)
  if (main === null) {
    return null
  }

  let def: SceneNode = main
  for (const i of path) {
    if (!("children" in def)) {
      return null
    }
    const nextChildren: ReadonlyArray<SceneNode> = def.children
    if (i >= nextChildren.length) {
      return null
    }
    def = nextChildren[i] as SceneNode
  }
  return def
}
