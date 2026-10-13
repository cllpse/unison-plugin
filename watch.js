import { execSync } from "node:child_process"

const run = () => {
  execSync("npm run build", { stdio: "inherit" })
}

run()
