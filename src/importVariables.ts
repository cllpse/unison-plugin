import { canonicalName } from "./legacyNames"

// Figma's own import takes one collection at a time and doesn't apply the files' scopes, so this imports every
// collection in a picked tokens file (unison-components/dist/tokens.json) in one go, with each variable's
// scopes. Its top-level keys are the collections, then the modes, each in the format of Figma's own export. Running it
// again updates the variables in place, so bound layers and styles keep working.
const TYPES: Record<string, VariableResolvedDataType> = {
  color: "COLOR",
  number: "FLOAT",
  string: "STRING",
  boolean: "BOOLEAN",
}

type Token = {
  $type: string
  $value: unknown
  $extensions?: { "com.figma.scopes"?: VariableScope[] }
}

type Color = { components: [number, number, number]; alpha: number }

type Group = Map<string, unknown>

const KEY_MARK = "#"

/**
 * Parse JSON with every object as a Map, in the file's key order. A plain object lists integer-like keys first
 * (`"0"`, `"1"`, … before `"px"`, `"0p5"`), which would scramble the spacing scale, so every key is marked with a
 * non-integer prefix while parsing and the mark is stripped again here.
 */
const parseOrdered = (text: string): unknown => {
  const toMaps = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(toMaps)

    if (value && typeof value === "object") {
      return new Map(Object.entries(value).map(([key, child]) => [key.slice(KEY_MARK.length), toMaps(child)]))
    }

    return value
  }

  return toMaps(JSON.parse(text.replace(/"((?:[^"\\]|\\.)*)"(\s*:)/g, `"${KEY_MARK}$1"$2`)))
}

/** Back to a plain object, for a token's own fields, where order doesn't matter. */
const toObject = (value: unknown): unknown =>
  value instanceof Map ? Object.fromEntries([...value].map(([key, child]) => [key, toObject(child)])) : value

const isNumberToken = (node: unknown): node is Group => node instanceof Map && node.get("$type") === "number"

/** A flat name's scale: everything before its last part (`spacing` for `spacing-0p5`). */
const scaleOf = (name: string): string => name.slice(0, Math.max(name.lastIndexOf("-"), 0))

/**
 * Figma's variable names in an export: groups joined by `/`, `$`-prefixed keys skipped. Number variables are ordered
 * by value within a scale of only numbers, smallest first (`spacing-0`, `spacing-px`, `spacing-0p5`), whatever their
 * names; scales and everything else keep the file's order.
 */
const flatten = (group: Group, path = "", tokens = new Map<string, Token>()): Map<string, Token> => {
  const children = [...group].filter(([key, node]) => !key.startsWith("$") && node instanceof Map) as [string, Group][]
  const scales = [...new Set(children.map(([key]) => scaleOf(key)))]
  const numberScales = new Set(
    scales.filter((scale) => children.every(([key, node]) => scaleOf(key) !== scale || isNumberToken(node))),
  )

  children.sort(([keyA, a], [keyB, b]) => {
    const scale = scales.indexOf(scaleOf(keyA)) - scales.indexOf(scaleOf(keyB))

    if (scale !== 0 || !numberScales.has(scaleOf(keyA))) return scale

    return Number(a.get("$value")) - Number(b.get("$value"))
  })

  for (const [key, node] of children) {
    const name = `${path}${key}`

    if (node.has("$value")) {
      tokens.set(name, toObject(node) as Token)
    } else {
      flatten(node, `${name}/`, tokens)
    }
  }

  return tokens
}

const valueOfToken = (token: Token): VariableValue => {
  if (token.$type === "color") {
    const { components, alpha } = token.$value as Color

    return { r: components[0], g: components[1], b: components[2], a: alpha }
  }

  return token.$value as VariableValue
}

const modeName = (mode: Group): string => {
  const extensions = mode.get("$extensions")
  const name = extensions instanceof Map ? extensions.get("com.figma.modeName") : undefined

  return typeof name === "string" ? name : "Default"
}

export const importVariables = async (text: unknown): Promise<string> => {
  if (figma.editorType !== "figma") {
    return "Variables need the Figma editor."
  }

  let file: unknown

  try {
    file = typeof text === "string" ? parseOrdered(text) : undefined
  } catch {
    file = undefined
  }

  if (!(file instanceof Map)) {
    throw new Error("not a tokens file.")
  }

  const collectionsInFile = [...file].map(([name, modes]) => ({
    name,
    modes: modes instanceof Map ? ([...modes.values()].filter((mode) => mode instanceof Map) as Group[]) : [],
  }))

  if (collectionsInFile.length === 0 || collectionsInFile.some(({ modes }) => modes.length === 0)) {
    throw new Error("not a tokens file.")
  }

  const collections = await figma.variables.getLocalVariableCollectionsAsync()
  const variables = await figma.variables.getLocalVariablesAsync()
  let created = 0
  let updated = 0

  for (const { name, modes } of collectionsInFile) {
    // A collection or variable an earlier import made under an older name (`unison-colors`, `unison-red-500`) is
    // renamed and updated, so its bindings keep working.
    const collection =
      collections.find((existing) => existing.name === name) ??
      collections.find((existing) => canonicalName(existing.name) === canonicalName(name)) ??
      figma.variables.createVariableCollection(name)

    collection.name = name

    // The first mode reuses the collection's default mode; the rest are found by name or added.
    const modeIds = modes.map((mode, i) => {
      const existing = collection.modes.find((m) => m.name === modeName(mode))

      if (existing) return existing.modeId

      if (i === 0) {
        collection.renameMode(collection.defaultModeId, modeName(mode))

        return collection.defaultModeId
      }

      return collection.addMode(modeName(mode))
    })

    const inCollection = variables.filter((variable) => variable.variableCollectionId === collection.id)
    const byName = new Map(inCollection.map((variable) => [variable.name, variable]))

    const tokensByMode = modes.map((mode) => flatten(mode))

    for (const [variableName, token] of tokensByMode[0]) {
      const type = TYPES[token.$type]

      if (!type) continue

      let variable =
        byName.get(variableName) ??
        inCollection.find(
          (existing) =>
            !tokensByMode[0].has(existing.name) && canonicalName(existing.name) === canonicalName(variableName),
        )

      if (variable && variable.resolvedType !== type) {
        variable.remove()
        variable = undefined
      }

      if (variable) {
        variable.name = variableName
        updated++
      } else {
        variable = figma.variables.createVariable(variableName, collection, type)
        created++
      }

      variable.scopes = token.$extensions?.["com.figma.scopes"] ?? ["ALL_SCOPES"]

      for (const [i, tokens] of tokensByMode.entries()) {
        variable.setValueForMode(modeIds[i], valueOfToken(tokens.get(variableName) ?? token))
      }
    }
  }

  return `Variables: ${created} created, ${updated} updated.`
}
