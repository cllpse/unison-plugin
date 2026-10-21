/** The Dev Mode annotation label or category that drops a layer from the output. */
const EXCLUDE_MARK = "EXCLUDE_FROM_OUTPUT"

export type AnnotationCategories = Awaited<ReturnType<typeof figma.annotations.getAnnotationCategoriesAsync>>

const normalizeExcludeToken = (text: string | undefined): string => (text ?? "").trim().toUpperCase()

const matchesExcludeFromOutput = (
  annotation: Annotation,
  annotationCategories: AnnotationCategories | undefined,
): boolean => {
  const markdownLabel = annotation.labelMarkdown?.replace(/<[^>]+>/g, " ")

  if (normalizeExcludeToken(annotation.label) === EXCLUDE_MARK) return true
  if (markdownLabel && normalizeExcludeToken(markdownLabel) === EXCLUDE_MARK) return true
  if (annotation.categoryId === undefined) return false

  return (annotationCategories ?? []).some(
    (category) => category.id === annotation.categoryId && normalizeExcludeToken(category.label) === EXCLUDE_MARK,
  )
}

export const hasExcludeFromOutputAnnotation = (
  annotations: ReadonlyArray<Annotation> | undefined,
  annotationCategories: AnnotationCategories | undefined,
): boolean => (annotations ?? []).some((annotation) => matchesExcludeFromOutput(annotation, annotationCategories))

const findNearestInstanceAncestor = (node: SceneNode): InstanceNode | null => {
  let current: BaseNode | null = node

  while (current !== null) {
    if (current.type === "INSTANCE") return current

    current = current.parent
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

  for (const index of path) {
    if (!("children" in definition)) return null

    const nextChildren: ReadonlyArray<SceneNode> = definition.children

    if (index >= nextChildren.length) return null

    definition = nextChildren[index] as SceneNode
  }

  return definition
}
