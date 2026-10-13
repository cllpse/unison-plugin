export type ErrorOrWarning = {
  message: string
  nodeId: string
}

export type PropertiesErrorOrWarning = {
  properties: Record<string, unknown>
  errors: ErrorOrWarning[]
  warnings: ErrorOrWarning[]
}

export type Properties = PropertiesErrorOrWarning["properties"]

export type HEX = `#${string}`
