import { cmd } from "./cmd"
import { UI } from "@/cli/ui"
import { createCssltdClient } from "@cssltdcode/sdk/v2" // cssltdcode_change
import { importCloudSession, validateCloudFork } from "@/cssltdcode/cloud-session" // cssltdcode_change
import { errorMessage } from "@cssltdcode/tui/util/error"
import { validateSession } from "../tui/validate-session"
import { ServerAuth } from "@/server/auth"

export const AttachCommand = cmd({
  command: "attach <url>",
  describe: "attach to a running cssltd server", // cssltdcode_change
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "http://localhost:4096",
        demandOption: true,
      })
      .option("dir", {
        type: "string",
        description: "directory to run in",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("cloud-fork", {
        type: "boolean",
        describe: "fetch session from cloud and continue locally (use with --session)",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password (defaults to CSSLTD_SERVER_PASSWORD)",
      })
      .option("username", {
        alias: ["u"],
        type: "string",
        describe: "basic auth username (defaults to CSSLTD_SERVER_USERNAME or 'cssltd')", // cssltdcode_change
      }),
  handler: async (args) => {
    const { TuiConfig } = await import("@/config/tui")
    if (args.fork && !args.continue && !args.session) {
      UI.error("--fork requires --continue or --session")
      process.exitCode = 1
      return
    }

    // cssltdcode_change start
    const cloudForkError = validateCloudFork(args)
    if (cloudForkError) {
      UI.error(cloudForkError)
      process.exitCode = 1
      return
    }
    // cssltdcode_change end

    const directory = (() => {
      if (!args.dir) return undefined
      try {
        process.chdir(args.dir)
        return process.cwd()
      } catch {
        // If the directory doesn't exist locally (remote attach), pass it through.
        return args.dir
      }
    })()
    const headers = ServerAuth.headers({ password: args.password, username: args.username })
    // cssltdcode_change start - import cloud session before TUI renders
    if (args.cloudFork && args.session) {
      UI.println("Importing session from cloud...")
      const sdk = createCssltdClient({
        baseUrl: args.url,
        directory,
        headers,
      })
      const id = await importCloudSession(sdk, args.session).catch(() => undefined)
      if (!id) {
        UI.error("Failed to import session from cloud")
        process.exitCode = 1
        return
      }
      args.session = id
      args.cloudFork = false
    }
    // cssltdcode_change end
    const config = await TuiConfig.get()

    try {
      await validateSession({
        url: args.url,
        sessionID: args.session,
        directory,
        headers,
      })
    } catch (error) {
      UI.error(errorMessage(error))
      process.exitCode = 1
      return
    }

    const { Effect } = await import("effect")
    const { run } = await import("../tui/layer")
    const { createLegacyTuiPluginHost } = await import("@/plugin/tui/runtime")
    await Effect.runPromise(
      run({
        url: args.url,
        config,
        pluginHost: createLegacyTuiPluginHost(),
        args: {
          continue: args.continue,
          sessionID: args.session,
          fork: args.fork,
        },
        directory,
        headers,
      }),
    )
  },
})
