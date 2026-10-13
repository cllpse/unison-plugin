const variableById = new Map<string, Promise<Variable | null>>()

export const getVariable = (id: string): Promise<Variable | null> => {
  const existing = variableById.get(id)

  if (existing) {
    return existing
  }

  const next = figma.variables.getVariableByIdAsync(id)
  variableById.set(id, next)

  return next
}
