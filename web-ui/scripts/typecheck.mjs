// Typechecks web-ui sources only. The vendored engine (../web) is validated
// by the root project's own tsc config (ES6 lib); checking it again here
// under web-ui's newer lib produces spurious SharedArrayBuffer mismatches.
import { execSync } from "node:child_process"

let output = ""
try {
    execSync("npx tsc --noEmit --pretty false", { encoding: "utf8" })
    process.exit(0)
} catch (error) {
    output = `${error.stdout ?? ""}`
}

const ownErrors = output.split("\n").filter(line =>
    /^(src|index|stream|admin|vite\.config|scripts)/.test(line)
)
if (ownErrors.length > 0) {
    console.error(ownErrors.join("\n"))
    process.exit(1)
}
process.exit(0)
