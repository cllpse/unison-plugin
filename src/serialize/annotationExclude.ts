/** Dev Mode annotation category / note used to drop a layer from exported output. */
const EXCLUDE_MARK = "EXCLUDE_FROM_OUTPUT"

const normalizeExcludeToken = (s: string | undefined): string => (s ?? "").trim().toUpperCase()

const annotationMatchesExcludeFromOutput = (
  a: Annotation,
  annotationCategories: Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>> | undefined,
): boolean => {
  if (normalizeExcludeToken(a.label) === EXCLUDE_MARK) return true
  if (a.labelMarkdown && normalizeExcludeToken(a.labelMarkdown.replace(/<[^>]+>/g, " ")) === EXCLUDE_MARK) return true
  if (a.categoryId === undefined) return false

  return (annotationCategories ?? []).some(
    (c) => c.id === a.categoryId && normalizeExcludeToken(c.label) === EXCLUDE_MARK,
  )
}

export const hasExcludeFromOutputAnnotation = (
  annotations: ReadonlyArray<Annotation> | undefined,
  annotationCategories: Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>> | undefined,
): boolean => (annotations ?? []).some((a) => annotationMatchesExcludeFromOutput(a, annotationCategories))

const findNearestInstanceAncestor = (node: SceneNode): InstanceNode | null => {
  let walk: BaseNode | null = node

  while (walk) {
    if (walk.type === "INSTANCE") return walk

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

  if (instance === null) return null
  if (node === instance) return getMainComponent(instance)

  const path: number[] = []
  let current: BaseNode = node

  while (true) {
    const parent: BaseNode | null = current.parent

    if (parent === null) return null
    if (!("children" in parent)) return null

    const siblings: ReadonlyArray<SceneNode> = (parent as ChildrenMixin).children
    const index = siblings.indexOf(current as SceneNode)

    if (index < 0) return null

    path.unshift(index)

    if (parent === instance) break

    current = parent
  }

  const main = await getMainComponent(instance)

  if (main === null) return null

  let definition: SceneNode = main

  for (const i of path) {
    if (!("children" in definition)) return null

    const nextChildren: ReadonlyArray<SceneNode> = definition.children

    if (i >= nextChildren.length) return null

    definition = nextChildren[i] as SceneNode
  }

  return definition
}
