import { EventV2 } from "@cssltdcode/core/event"
import { Schema } from "effect"
import { NamedError } from "@cssltdcode/core/util/error"

const SUPPORTED_IDES = [
  { name: "Windsurf" as const, cmd: "windsurf" },
  { name: "Visual Studio Code - Insiders" as const, cmd: "code-insiders" },
  { name: "Visual Studio Code" as const, cmd: "code" },
  { name: "Cursor" as const, cmd: "cursor" },
  { name: "VSCodium" as const, cmd: "codium" },
]

export const Event = {
  Installed: EventV2.define({
    type: "ide.installed",
    schema: {
      ide: Schema.String,
    },
  }),
}

export const AlreadyInstalledError = NamedError.create("AlreadyInstalledError", {})

export const InstallFailedError = NamedError.create("InstallFailedError", {
  stderr: Schema.String,
})

export function ide() {
  if (process.env["TERM_PROGRAM"] === "vscode") {
    const v = process.env["GIT_ASKPASS"]
    for (const ide of SUPPORTED_IDES) {
      if (v?.includes(ide.name)) return ide.name
    }
  }
  return "unknown"
}

export function alreadyInstalled() {
  return process.env["CSSLTD_CALLER"] === "vscode" || process.env["CSSLTD_CALLER"] === "vscode-insiders"
}

// cssltdcode_change start - Cssltd's VS Code extension bundles the CLI; auto-install from CLI is not applicable
export async function install(_ide: (typeof SUPPORTED_IDES)[number]["name"]) {
  throw new AlreadyInstalledError({})
}
// cssltdcode_change end

export * as Ide from "."
