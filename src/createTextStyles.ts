// Figma's variable import can't create styles, so this creates a text style per Tailwind text size from the imported
// `font-size-<name>` and `line-height-<name>` variables (unison-components/dist/design-tokens.json),
// with both bound. New styles use Inter Regular; running it again updates the styles in place and keeps their font.
const TYPOGRAPHY_VARIABLE = /^(font-size|line-height)-(.+)$/

const DEFAULT_FONT: FontName = { family: "Inter", style: "Regular" }

type Size = { "font-size"?: Variable; "line-height"?: Variable }

export const createTextStyles = async (): Promise<string> => {
  if (figma.editorType !== "figma") {
    return "Text styles need the Figma editor."
  }

  const sizes = new Map<string, Size>()

  for (const variable of await figma.variables.getLocalVariablesAsync("FLOAT")) {
    const match = variable.name.match(TYPOGRAPHY_VARIABLE)

    if (!match) continue

    const [, field, name] = match
    const size = sizes.get(name) ?? {}

    size[field as keyof Size] = variable
    sizes.set(name, size)
  }

  if (sizes.size === 0) {
    return "No font-size variables found."
  }

  const styles = await figma.getLocalTextStylesAsync()
  let created = 0
  let updated = 0

  // Each style follows the previous one, so the scale reads smallest first in the styles list.
  let previous: TextStyle | null = null

  for (const [name, size] of sizes) {
    const fontSize = size["font-size"]

    if (!fontSize) continue

    const existing = styles.find((style) => style.name === `text-${name}`)
    const style = existing ?? figma.createTextStyle()

    style.name = `text-${name}`

    await figma.loadFontAsync(existing ? style.fontName : DEFAULT_FONT)

    if (!existing) {
      style.fontName = DEFAULT_FONT
    }

    style.setBoundVariable("fontSize", fontSize)
    style.setBoundVariable("lineHeight", size["line-height"] ?? null)

    if (previous) figma.moveLocalTextStyleAfter(style, previous)

    previous = style

    if (existing) {
      updated++
    } else {
      created++
    }
  }

  return `Text styles: ${created} created, ${updated} updated.`
}
