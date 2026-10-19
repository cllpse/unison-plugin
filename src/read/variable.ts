const VARIABLE_BY_ID_CACHE = new Map<string, Promise<Variable | null>>()

export const getVariable = (id: string): Promise<Variable | null> => {
  const existing = VARIABLE_BY_ID_CACHE.get(id)

  if (existing) return existing

  const next = figma.variables.getVariableByIdAsync(id)

  VARIABLE_BY_ID_CACHE.set(id, next)

  return next
}
