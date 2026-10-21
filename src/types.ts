/**
 * An Issues line: `<layer> <PROPERTY> <problem>`, e.g. Card, PADDING LEFT, not bound. Errors break the token contract
 * and leave the setting out of the output; warnings are settings the output approximates or drops because the
 * library can't express them; notifications are informational, the output is as intended.
 */
export type Issue = {
  nodeId: string
  layer: string
  property: string
  problem: string
  /** The property's current value, shown in parentheses after the problem. */
  value?: string | number
  /** Why the issue arises or what the output does instead, where the problem alone doesn't say; never advice. */
  explanation?: string
  /** The type of the layer the issue belongs to, for its icon; set when the issues are collected. */
  layerType?: string
}

export type PropertiesAndIssues = {
  properties: Record<string, unknown>
  errors: Issue[]
  warnings: Issue[]
  notifications?: Issue[]
}

export type Properties = PropertiesAndIssues["properties"]

export type Hex = `#${string}`
