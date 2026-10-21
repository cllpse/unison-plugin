import { createShadowStyles } from "./createShadowStyles"
import { createTextStyles } from "./createTextStyles"
import { importVariables } from "./importVariables"
import { serializeNode } from "./serialize/node"
import type { Issue, PropertiesAndIssues } from "./types"
import { renderComponentCode, truncateName } from "./utilities"

figma.root.setRelaunchData({ run: "Generate Unison component code from a selected frame" })
figma.currentPage.setRelaunchData({ run: "Generate Unison component code from a selected frame" })

figma.showUI(__html__, { width: 480, height: 640, title: "Unison", themeColors: true })

let showOutput = true

/** Show a short confirmation in the plugin's header, next to the toolbar. */
const showHint = (text: string, duration = 1500) => figma.ui.postMessage({ hint: { text, duration } })

const selectionHistory: string[] = []
let currentSelectionId: string | null = null
let restoringSelection = false

const focusNode = async (id: string): Promise<boolean> => {
  const node = await figma.getNodeByIdAsync(id)

  if (node === null || !("visible" in node)) return false

  figma.currentPage.selection = [node as SceneNode]
  figma.viewport.scrollAndZoomIntoView([node])

  return true
}

const recordSelection = () => {
  const id = figma.currentPage.selection[0]?.id ?? null

  if (restoringSelection) {
    restoringSelection = false
    currentSelectionId = id

    return
  }

  if (id === currentSelectionId) return

  if (currentSelectionId !== null) selectionHistory.push(currentSelectionId)

  currentSelectionId = id
}

recordSelection()

figma.ui.onmessage = async (message: {
  selectNode?: string
  type?: string
  showOutput?: boolean
  tokens?: unknown
}) => {
  if (message.type === "toggleOutput") {
    showOutput = message.showOutput ?? true
    renderSelection()

    return
  }

  // Variables first: the styles are built from them. A failing step shows its error and stops the rest, and the output
  // is always refreshed so the UI leaves its loading state.
  if (message.type === "import") {
    const notices: string[] = []

    try {
      notices.push(await importVariables(message.tokens))
      notices.push(await createShadowStyles())
      notices.push(await createTextStyles())

      figma.notify(notices.join(" "), { timeout: 6000 })
      showHint("Imported design tokens", 3000)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)

      figma.notify(`${notices.join(" ")} Import failed: ${reason}`.trim(), { error: true, timeout: 10000 })
      showHint("Import failed", 3000)
    }

    renderSelection()

    return
  }

  if (message.type === "refresh") {
    await renderSelection()
    showHint("Regenerated component code")

    return
  }

  if (message.type === "back") {
    while (selectionHistory.length > 0) {
      const previousId = selectionHistory.pop()

      if (previousId === undefined) break

      restoringSelection = true

      if (await focusNode(previousId)) {
        currentSelectionId = previousId
        showHint("Selected previous layer")

        return
      }

      restoringSelection = false
    }

    // Nothing to go back to: re-render so the output leaves its loading state.
    renderSelection()
    showHint("No previous layer")

    return
  }

  const id = message.selectNode

  if (id === undefined) return

  // Selecting the layer that's already selected fires no selectionchange, so run directly.
  const alreadySelected = figma.currentPage.selection[0]?.id === id

  await focusNode(id)

  if (alreadySelected) renderSelection()
}

// Only the latest run may post its result, so a slow earlier run can't overwrite a newer one.
let latestRun = 0

const renderSelection = async () => {
  const run = ++latestRun

  figma.ui.postMessage({ loading: true })

  const node = figma.currentPage.selection[0]

  // Nothing selected: the UI shows its empty state.
  if (!node) {
    figma.ui.postMessage({ empty: true })

    return
  }

  try {
    const errors: Issue[] = []
    const warnings: Issue[] = []
    const notifications: Issue[] = []

    const tree = await serializeNode(node)

    const collectIssues = (result: PropertiesAndIssues) => {
      const withLayerType = (issue: Issue) => ({ ...issue, layerType: String(result.properties.type) })

      errors.push(...result.errors.map(withLayerType))
      warnings.push(...result.warnings.map(withLayerType))
      notifications.push(...(result.notifications ?? []).map(withLayerType))

      for (const child of (result.properties.children as PropertiesAndIssues[] | undefined) ?? []) {
        collectIssues(child)
      }
    }

    collectIssues(tree)

    const output = showOutput ? renderComponentCode(tree) : ""

    if (run !== latestRun) return

    figma.ui.postMessage({ output, errors, warnings, notifications })
  } catch (error) {
    if (run !== latestRun) return

    // A failed run still leaves the loading state, with the failure as an issue.
    const reason = error instanceof Error ? error.message : String(error)

    figma.ui.postMessage({
      output: "",
      warnings: [],
      notifications: [],
      errors: [
        { nodeId: node.id, layer: truncateName(node.name), property: "CODE", problem: reason, layerType: node.type },
      ],
    })
  }
}

figma.on("selectionchange", () => {
  recordSelection()
  renderSelection()
})

figma.loadAllPagesAsync().then(() => {
  figma.on("documentchange", renderSelection)
})
