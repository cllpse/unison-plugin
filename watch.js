import { execSync } from "node:child_process"

const run = () => {
  execSync("npm run plugin:build", { stdio: "inherit" })
}

run()
