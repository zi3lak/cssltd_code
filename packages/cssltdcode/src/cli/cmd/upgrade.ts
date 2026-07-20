import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"

// cssltdcode_change start - INACTIVE: no release channel exists yet (no npm
// package, GitHub Releases, Homebrew/Choco/Scoop — see README.md "Install").
// This command used to probe package-manager registries via `Installation`
// (packages/cssltdcode/src/installation); until a real channel is published,
// fail fast with a clear message instead of hitting nonexistent endpoints.
export const UpgradeCommand = {
  command: "upgrade [target]",
  describe: "upgrade cssltd to the latest or a specific version", // cssltdcode_change
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "version to upgrade to, for ex '0.1.48' or 'v0.1.48'",
        type: "string",
      })
      .option("method", {
        alias: "m",
        describe: "installation method to use",
        type: "string",
        choices: ["curl", "npm", "yarn", "pnpm", "bun", "brew", "choco", "scoop"], // cssltdcode_change
      })
  },
  handler: async () => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("Upgrade")
    prompts.log.error(
      "No release channel is configured yet. Rebuild from source instead:\n" +
        "  bun install && cd packages/cssltdcode && bun run build",
    )
    prompts.outro("Done")
  },
}
// cssltdcode_change end
