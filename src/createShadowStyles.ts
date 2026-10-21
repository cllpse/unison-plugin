// Figma's variable import can't create styles, so this creates an effect style per shadow from the imported
// `shadow-<name>-<layer>-<field>` variables (unison-components/dist/design-tokens.json), each layer bound
// to its variables. Running it again updates the styles in place. readEffect reads the shadow back from the style's
// name.
const SHADOW_VARIABLE = /^shadow-([^-]+)-(\d+)-(offset-x|offset-y|blur|spread|color)$/

const FIELDS = {
  "offset-x": "offsetX",
  "offset-y": "offsetY",
  blur: "radius",
  spread: "spread",
  color: "color",
} as const

type Layer = Partial<Record<keyof typeof FIELDS, Variable>>

// The variables have a single mode, so the first value is the value.
const modeValue = (variable: Variable | undefined): VariableValue | undefined =>
  variable === undefined ? undefined : Object.values(variable.valuesByMode)[0]

const numberOf = (variable: Variable | undefined): number => {
  const value = modeValue(variable)

  return typeof value === "number" ? value : 0
}

const colorOf = (variable: Variable | undefined): RGBA => {
  const value = modeValue(variable)

  if (value && typeof value === "object" && "r" in value) return { a: 1, ...value }

  return { r: 0, g: 0, b: 0, a: 0.1 }
}

const buildEffect = (layer: Layer): Effect => {
  let effect: Effect = {
    type: "DROP_SHADOW",
    visible: true,
    blendMode: "NORMAL",
    offset: { x: numberOf(layer["offset-x"]), y: numberOf(layer["offset-y"]) },
    radius: numberOf(layer.blur),
    spread: numberOf(layer.spread),
    color: colorOf(layer.color),
  }

  for (const [field, variable] of Object.entries(layer)) {
    if (variable === undefined) continue

    effect = figma.variables.setBoundVariableForEffect(effect, FIELDS[field as keyof typeof FIELDS], variable)
  }

  return effect
}

export const createShadowStyles = async (): Promise<string> => {
  if (figma.editorType !== "figma") return "Shadow styles need the Figma editor."

  const shadows = new Map<string, Map<number, Layer>>()

  for (const variable of await figma.variables.getLocalVariablesAsync()) {
    const match = variable.name.match(SHADOW_VARIABLE)

    if (!match) continue

    const [, name, index, field] = match
    const layers = shadows.get(name) ?? new Map<number, Layer>()
    const layer = layers.get(Number(index)) ?? {}

    layer[field as keyof typeof FIELDS] = variable
    layers.set(Number(index), layer)
    shadows.set(name, layers)
  }

  if (shadows.size === 0) return "No shadow variables found."

  const styles = await figma.getLocalEffectStylesAsync()
  let created = 0
  let updated = 0

  // Each style follows the previous one, so the scale reads smallest first in the styles list.
  let previous: EffectStyle | null = null

  for (const [name, layers] of shadows) {
    const existing = styles.find((style) => style.name === `shadow-${name}`)
    const style = existing ?? figma.createEffectStyle()

    style.name = `shadow-${name}`

    style.effects = [...layers.entries()]
      .sort(([indexA], [indexB]) => indexA - indexB)
      .map(([, layer]) => buildEffect(layer))

    if (previous) figma.moveLocalEffectStyleAfter(style, previous)

    previous = style

    if (existing) updated++
    if (existing === undefined) created++
  }

  return `Shadow styles: ${created} created, ${updated} updated.`
}
