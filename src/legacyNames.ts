/**
 * A name without the shapes earlier imports used: `unison-` prefixes, `/` groups and the colors' `fill-` prefix, so
 * `unison-shadow/md`, `shadow/md` and `shadow-md` (or `unison-red-500` and `fill-red-500`) are the same name.
 */
export const canonicalName = (name: string): string =>
  name
    .split("/")
    .map((part) => part.replace(/^unison-/, ""))
    .join("-")
    .replace(/^fill-/, "")

/**
 * The style named `name`, or else one an earlier import made under an older name, renamed. Any further older copies
 * hand their layers over to it and are removed, so a re-import updates styles instead of adding them.
 */
export const adoptStyle = async <Style extends EffectStyle | TextStyle>(
  styles: Style[],
  name: string,
  create: () => Style,
  apply: (node: SceneNode, style: Style) => Promise<void>,
): Promise<{ style: Style; existed: boolean }> => {
  const exact = styles.find((style) => style.name === name)
  const older = styles.filter((style) => style !== exact && canonicalName(style.name) === canonicalName(name))
  const found = exact ?? older.shift()
  const style = found ?? create()

  style.name = name

  for (const copy of older) {
    for (const { node } of await copy.getStyleConsumersAsync()) {
      await apply(node, style)
    }

    copy.remove()
  }

  return { style, existed: found !== undefined }
}
