import { placeholder } from "./placeholder"
import { serializeNode } from "./serialize/node"
import type { ErrorOrWarning, PropertiesErrorOrWarning } from "./types"
import { renderComponentCode } from "./utilities"

figma.root.setRelaunchData({ run: "Export a selected frame as React component code" })
figma.currentPage.setRelaunchData({ run: "Export a selected frame as React component code" })

figma.showUI(__html__, { width: 480, height: 640, title: "Frame Plugin", themeColors: true })

let showOutput = true

figma.clientStorage
  .getAsync("pluginSize")
  .then((size) => {
    if (size) {
      figma.ui.resize(size.w, size.h)
    }
  })
  .catch(() => {})

figma.ui.onmessage = async (msg: {
  selectNode?: string
  type?: string
  size?: { w: number; h: number }
  showOutput?: boolean
}) => {
  if (msg.type === "resize" && msg.size) {
    figma.ui.resize(msg.size.w, msg.size.h)
    figma.clientStorage.setAsync("pluginSize", msg.size).catch(() => {})

    return
  }

  if (msg.type === "toggleOutput") {
    showOutput = msg.showOutput ?? true
    runner()

    return
  }

  const id = msg.selectNode

  if (!id || id === "") return

  const node = await figma.getNodeByIdAsync(id)

  if (node && "visible" in node) {
    figma.currentPage.selection = [node as SceneNode]
    figma.viewport.scrollAndZoomIntoView([node])
  }
}

const runner = async () => {
  figma.ui.postMessage({
    output: "Working...",
    warnings: [],
    errors: [],
  })

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

figma.on("selectionchange", runner)

figma.loadAllPagesAsync().then(() => {
  figma.on("documentchange", runner)
})
