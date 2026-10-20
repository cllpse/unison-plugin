/** An Issues line: `<layer> <PROPERTY> <problem>`, e.g. Card, PADDING LEFT, not bound. */
export type ErrorOrWarning = {
  nodeId: string
  layer: string
  property: string
  problem: string
  /** Stays an error even on a top-level layer, where other errors become notices. */
  always?: boolean
}

export type PropertiesErrorOrWarning = {
  properties: Record<string, unknown>
  errors: ErrorOrWarning[]
  warnings: ErrorOrWarning[]
}

export type Properties = PropertiesErrorOrWarning["properties"]

export type HEX = `#${string}`
