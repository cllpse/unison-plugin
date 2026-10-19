import { createShadowStyles } from "./createShadowStyles"
import { createTextStyles } from "./createTextStyles"
import { importVariables } from "./importVariables"
import { serializeNode } from "./serialize/node"
import type { ErrorOrWarning, PropertiesErrorOrWarning } from "./types"
import { renderComponentCode, truncateName } from "./utilities"

figma.root.setRelaunchData({ run: "Generate Unison component code from a selected frame" })
figma.currentPage.setRelaunchData({ run: "Generate Unison component code from a selected frame" })

figma.showUI(__html__, { width: 480, height: 640, title: "Unison", themeColors: true })

let showOutput = true

/** Show a short confirmation in the plugin's header, next to the toolbar. */
const hint = (text: string, duration = 1500) => figma.ui.postMessage({ hint: { text, duration } })

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

figma.ui.onmessage = async (msg: { selectNode?: string; type?: string; showOutput?: boolean; tokens?: unknown }) => {
  if (msg.type === "toggleOutput") {
    showOutput = msg.showOutput ?? true
    runner()

    return
  }

  // Variables first: the styles are built from them. A failing step shows its error and stops the rest, and the output
  // is always refreshed so the UI leaves its loading state.
  if (msg.type === "import") {
    const messages: string[] = []

    try {
      messages.push(await importVariables(msg.tokens))
      messages.push(await createShadowStyles())
      messages.push(await createTextStyles())

      figma.notify(messages.join(" "), { timeout: 6000 })
      hint("Imported design tokens", 3000)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      figma.notify(`${messages.join(" ")} Import failed: ${reason}`.trim(), { error: true, timeout: 10000 })
      hint("Import failed", 3000)
    }

    runner()

    return
  }

  if (msg.type === "refresh") {
    await runner()
    hint("Regenerated component code")

    return
  }

  if (msg.type === "back") {
    while (selectionHistory.length > 0) {
      const previousId = selectionHistory.pop()

      if (!previousId) break

      restoringSelection = true

      if (await focusNode(previousId)) {
        currentSelectionId = previousId
        hint("Selected previous layer")

        return
      }

      restoringSelection = false
    }

    // Nothing to go back to: re-render so the output leaves its loading state.
    runner()
    hint("No previous layer")

    return
  }

  const id = msg.selectNode

  if (!id) return

  // Selecting the layer that's already selected fires no selectionchange, so run directly.
  const alreadySelected = figma.currentPage.selection[0]?.id === id

  await focusNode(id)

  if (alreadySelected) {
    runner()
  }
}

// Only the latest run may post its result, so a slow earlier run can't overwrite a newer one.
let latestRun = 0

const runner = async () => {
  const run = ++latestRun

  figma.ui.postMessage({ loading: true })

  const node = figma.currentPage.selection[0]

  // Nothing selected: the UI shows its empty state.
  if (!node) {
    figma.ui.postMessage({ empty: true })

    return
  }

  try {
    const warnings: ErrorOrWarning[] = []
    const errors: ErrorOrWarning[] = []

    const json = await serializeNode(node)

    const collectMessages = (p: PropertiesErrorOrWarning) => {
      warnings.push(...p.warnings)
      errors.push(...p.errors)

      for (const child of (p.properties.children as PropertiesErrorOrWarning[] | undefined) ?? []) {
        collectMessages(child)
      }
    }

    collectMessages(json)

    const output = showOutput ? renderComponentCode(json) : ""

    if (run !== latestRun) return

    figma.ui.postMessage({ output, warnings, errors })
  } catch (error) {
    if (run !== latestRun) return

    // A failed run still leaves the loading state, with the failure as an issue.
    const reason = error instanceof Error ? error.message : String(error)

    figma.ui.postMessage({
      output: "",
      warnings: [],
      errors: [{ nodeId: node.id, message: `${truncateName(node.name)} – ${reason}` }],
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
