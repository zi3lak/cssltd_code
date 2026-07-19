export * as PtyPreparation from "./pty-preparation"

import { Config } from "@/config/config"
import * as InstanceState from "@/effect/instance-state"
import { Plugin } from "@/plugin"
import { Shell } from "@/shell/shell"
import { Pty } from "@cssltdcode/core/pty"
import { CssltdPtySelfCommand } from "@/cssltdcode/pty/self-command" // cssltdcode_change - ported from the deleted @/pty module
import { Effect } from "effect"

export const prepareCreate = Effect.fn("PtyPreparation.prepareCreate")(function* (input: Pty.CreateInput) {
  const config = yield* Config.Service
  const plugin = yield* Plugin.Service
  // cssltdcode_change start - resolve Cssltd self-commands (e.g. bare `cssltd`) to the real binary + args + project cwd
  const resolved = CssltdPtySelfCommand.resolve({
    command: input.command,
    args: input.args ? [...input.args] : undefined,
    cwd: input.cwd,
  })
  const command = resolved.command || Shell.preferred((yield* config.get()).shell)
  const baseArgs = resolved.args ?? []
  const cwd = resolved.cwd || (yield* InstanceState.context).directory
  // cssltdcode_change end
  const args = Shell.login(command) ? [...baseArgs, "-l"] : [...baseArgs]
  const shell = yield* plugin.trigger("shell.env", { cwd }, { env: {} })
  const env = {
    ...process.env,
    ...input.env,
    ...shell.env,
    TERM: "xterm-256color",
    CSSLTD_TERMINAL: "1",
  } as Record<string, string>
  // cssltdcode_change start - ported from the deleted @/pty module.
  // Don't leak the cssltd server's auth credential into user shells: anything the shell forks (npm
  // post-install, `curl | bash`, compromised tools) would otherwise see the password for free. Users
  // who need `cssltd run`/`cssltd tui attach` to auto-connect from a cssltd-spawned terminal pass --password.
  delete env.CSSLTD_SERVER_PASSWORD
  delete env.CSSLTD_SERVER_USERNAME
  // cssltdcode_change end
  if (process.platform === "win32") {
    env.LC_ALL = "C.UTF-8"
    env.LC_CTYPE = "C.UTF-8"
    env.LANG = "C.UTF-8"
  }
  return { command, args, cwd, title: input.title, env }
})
