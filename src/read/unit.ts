import { resolveContainerToken, resolveRadiusToken, resolveSpacingToken } from "../maps"
import { getVariable } from "./variable"

const getVariableName = async (alias: VariableAlias | undefined): Promise<string | undefined> => {
  const variable = alias?.id ? await getVariable(alias.id) : null

  return variable?.name
}

export const resolveBoundUnitClass = async (
  prefix: string,
  alias: VariableAlias | undefined,
): Promise<string | undefined> => {
  const token = resolveSpacingToken(await getVariableName(alias))

  return token === undefined ? undefined : `${prefix}${token}`
}

export const resolveBoundRadiusClass = async (
  prefix: string,
  alias: VariableAlias | undefined,
): Promise<string | undefined> => {
  const token = resolveRadiusToken(await getVariableName(alias))

  return token === undefined ? undefined : `${prefix}${token}`
}

/** A fixed width: a container width (`width-md`) by its variable's name, else a spacing unit. */
export const resolveBoundWidthClass = async (alias: VariableAlias | undefined): Promise<string | undefined> => {
  const name = await getVariableName(alias)
  const container = resolveContainerToken(name)
  const spacing = resolveSpacingToken(name)

  if (container !== undefined) return `width-${container}`

  return spacing === undefined ? undefined : `width-${spacing}`
}
