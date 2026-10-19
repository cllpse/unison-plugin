import type { ErrorOrWarning, Properties, PropertiesErrorOrWarning } from "../types"

// timecode - iA_Writer_Duo_S_Bold_64_64_700
// header-wrap - Sharp_Grotesk_Medium_20_16_24_500
// header-small-wrap - Sharp_Grotesk_Medium_20_12_18_500
// body-wrap - Sharp_Grotesk_Book_20_16_24_400
// body-nowrap - Sharp_Grotesk_Book_20_16_24_400
// body-small-wrap - Sharp_Grotesk_Book_20_12_18_400
// body-small-nowrap - Sharp_Grotesk_Book_20_12_18_400
// label-wrap - Sharp_Grotesk_Medium_20_16_24_500
// label-nowrap - Sharp_Grotesk_Medium_20_16_24_500
// label-small-wrap - Sharp_Grotesk_Medium_20_12_18_500
// label-small-nowrap - Sharp_Grotesk_Medium_20_12_18_500
// mono-wrap - Sharp_Book_Timestamp_20_16_24_400
// mono-nowrap - Sharp_Book_Timestamp_20_16_24_400
// mono-small-wrap - Sharp_Book_Timestamp_20_12_18_400
// mono-small-nowrap - Sharp_Book_Timestamp_20_12_18_400

export const readTypography = async (node: TextNode): Promise<PropertiesErrorOrWarning> => {
  const properties: Properties = {}
  const errors: ErrorOrWarning[] = []

  if (node.textStyleId === undefined) {
    errors.push({
      nodeId: node.id,
      message: `Error @ "${node.name}" – TYPOGRAPHY not bound to a text style.`,
    })
  } else if (node.textStyleId === figma.mixed) {
    errors.push({
      nodeId: node.id,
      message: `Error @ "${node.name}" – TYPOGRAPHY mixed.`,
    })
  } else {
    const textStyle = await figma.getStyleByIdAsync(node.textStyleId)

    if (textStyle) {
      // `text-<size>` styles (made by the import button) are Tailwind's sizes: `typography-sm`.
      const size = textStyle.name.match(/^text-(.+)$/)?.[1]

      properties[`typography-${size ?? textStyle.name}`] = true
    }
  }

  return { properties, errors, warnings: [] }
}
