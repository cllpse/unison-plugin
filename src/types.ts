/** An Issues line: `<layer> <PROPERTY> <problem>`, e.g. Card, PADDING LEFT, not bound. */
export type ErrorOrWarning = {
  nodeId: string
  layer: string
  property: string
  problem: string
  /** The property's current value, shown in parentheses after the problem. */
  value?: string | number
}

export type PropertiesErrorOrWarning = {
  properties: Record<string, unknown>
  errors: ErrorOrWarning[]
  warnings: ErrorOrWarning[]
}

export type Properties = PropertiesErrorOrWarning["properties"]

export type HEX = `#${string}`
