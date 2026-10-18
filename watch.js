import { watch } from "node:fs"

const build = () => {
  Bun.spawnSync(["bun", "run", "plugin:build"], { stdio: ["inherit", "inherit", "inherit"] })
}

build()

watch("./src", { recursive: true }, build)
