export type ErrorOrWarning = {
  message: string
  nodeId: string
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
