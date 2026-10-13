import { resolveUnitClass } from "../maps"
import { getVariable } from "./variable"

export const resolveBoundUnitClass = async (
  prefix: string,
  alias: VariableAlias | undefined,
  pixels: number,
): Promise<string | undefined> => {
  const variable = alias?.id ? await getVariable(alias.id) : null

  return resolveUnitClass(prefix, variable?.name, pixels)
}
