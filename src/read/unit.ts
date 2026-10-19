import { resolveContainerToken, resolveRadiusToken, resolveUnitClass } from "../maps"
import { getVariable } from "./variable"

export const resolveBoundUnitClass = async (
  prefix: string,
  alias: VariableAlias | undefined,
  pixels: number,
): Promise<string | undefined> => {
  const variable = alias?.id ? await getVariable(alias.id) : null

  return resolveUnitClass(prefix, variable?.name, pixels)
}

export const resolveBoundRadiusClass = async (
  prefix: string,
  alias: VariableAlias | undefined,
  pixels: number,
): Promise<string | undefined> => {
  const variable = alias?.id ? await getVariable(alias.id) : null
  const token = resolveRadiusToken(variable?.name, pixels)

  return token ? `${prefix}${token}` : undefined
}

/** A fixed width: a container width (`width-md`) by its variable's name, else a spacing unit. */
export const resolveBoundWidthClass = async (
  alias: VariableAlias | undefined,
  pixels: number,
): Promise<string | undefined> => {
  const variable = alias?.id ? await getVariable(alias.id) : null
  const container = resolveContainerToken(variable?.name)

  return container ? `width-${container}` : resolveUnitClass("width-", variable?.name, pixels)
}
