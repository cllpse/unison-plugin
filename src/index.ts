import { placeholder } from "./placeholder"
import { serializeNode } from "./serialize/node"
import type { ErrorOrWarning, PropertiesErrorOrWarning } from "./types"
import { renderComponentCode } from "./utilities"

figma.root.setRelaunchData({ run: "Export a selected frame as React component code" })
figma.currentPage.setRelaunchData({ run: "Export a selected frame as React component code" })

figma.showUI(__html__, { width: 480, height: 640, title: "Frame Plugin", themeColors: true })

let showOutput = true
const selectionHistory: string[] = []
let currentSelectionId: string | null = null
let restoringSelection = false

const focusNode = async (id: string): Promise<boolean> => {
  const node = await figma.getNodeByIdAsync(id)

  if (node && "visible" in node) {
    figma.currentPage.selection = [node as SceneNode]
    figma.viewport.scrollAndZoomIntoView([node])

    return true
  }

  return false
}

const recordSelection = () => {
  const id = figma.currentPage.selection[0]?.id ?? null

  if (restoringSelection) {
    restoringSelection = false
    currentSelectionId = id

    return
  }

  if (id === currentSelectionId) return

  if (currentSelectionId) {
    selectionHistory.push(currentSelectionId)
  }

  currentSelectionId = id
}

recordSelection()

figma.ui.onmessage = async (msg: { selectNode?: string; type?: string; showOutput?: boolean }) => {
  if (msg.type === "toggleOutput") {
    showOutput = msg.showOutput ?? true
    runner()

    return
  }

  if (msg.type === "refresh") {
    runner()

    return
  }

  if (msg.type === "back") {
    while (selectionHistory.length > 0) {
      const previousId = selectionHistory.pop()

      if (!previousId) break

      restoringSelection = true

      if (await focusNode(previousId)) {
        currentSelectionId = previousId

        return
      }

      restoringSelection = false
    }

    return
  }

  const id = msg.selectNode

  if (!id || id === "") return

  await focusNode(id)
}

const runner = async () => {
  figma.ui.postMessage({ loading: true })

  const selection = figma.currentPage.selection

  if (selection.length > 0) {
    const warnings: ErrorOrWarning[] = []
    const errors: ErrorOrWarning[] = []

    const json = await serializeNode(figma.currentPage.selection[0])

    const collectMessages = (p: PropertiesErrorOrWarning) => {
      if (p.warnings.length > 0) {
        warnings.push(...p.warnings)
      }

      if (p.errors.length > 0) {
        errors.push(...p.errors)
      }

      const children = "children" in p.properties ? (p.properties.children as PropertiesErrorOrWarning[]) : []

      if (children) {
        for (const child of children) {
          collectMessages(child)
        }
      }
    }

    collectMessages(json)

    figma.ui.postMessage({
      output: showOutput ? renderComponentCode(json) : "",
      warnings,
      errors,
    })
  } else {
    figma.ui.postMessage({
      output: placeholder,
      warnings: [],
      errors: [],
    })
  }
}

figma.on("selectionchange", () => {
  recordSelection()
  runner()
})

figma.loadAllPagesAsync().then(() => {
  figma.on("documentchange", runner)
})
