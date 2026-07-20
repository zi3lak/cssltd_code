import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@cssltdcode/core/flag/flag"
import { InstanceRuntime } from "../../project/instance-runtime" // cssltdcode_change
import { startParentWatchdog } from "../../cssltdcode/parent-watchdog" // cssltdcode_change

// cssltdcode_change start - fail-closed non-loopback binding
const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"])

function isLoopbackHostname(hostname: string) {
  return LOOPBACK_HOSTNAMES.has(hostname.toLowerCase())
}
// cssltdcode_change end

export const ServeCommand = effectCmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless cssltd server",
  // Server loads instances per-request via x-cssltd-directory header — no
  // need for an ambient project InstanceContext at startup.
  instance: false, // cssltdcode_change
  handler: Effect.fn("Cli.serve")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    const opts = yield* resolveNetworkOptions(args)
    // cssltdcode_change start - refuse to start unauthenticated on a
    // non-loopback interface (e.g. via --mdns, --hostname, or config) since
    // the API exposes shell execution, PTY creation, and permission
    // approval to anyone who can reach the port
    if (!Flag.CSSLTD_SERVER_PASSWORD && !isLoopbackHostname(opts.hostname)) {
      console.error(
        `Error: refusing to start on ${opts.hostname} without CSSLTD_SERVER_PASSWORD set.\n` +
          `Binding to a non-loopback interface exposes shell execution, PTY creation, and\n` +
          `permission approval to your network. Set CSSLTD_SERVER_PASSWORD or bind to\n` +
          `127.0.0.1 / localhost instead.`,
      )
      process.exit(1)
    }
    if (!Flag.CSSLTD_SERVER_PASSWORD) {
      console.log("Warning: CSSLTD_SERVER_PASSWORD is not set; server is unsecured.")
    }
    // cssltdcode_change end
    const server = yield* Effect.promise(() => Server.listen(opts))

    // cssltdcode_change start
    const urls = server.urls

    console.log(`cssltd server listening on ${urls.bind}`)
    if (urls.local !== urls.bind) console.log(`  Local:   ${urls.local}`)
    if (urls.network) console.log(`  Network: ${urls.network}`)
    // cssltdcode_change end

    // cssltdcode_change start - graceful signal shutdown
    // yield* Effect.never
    yield* Effect.promise(
      () =>
        new Promise<void>((resolve) => {
          // Exit if the editor client that spawned us is hard-killed (no signal reaches us).
          const stopWatchdog = startParentWatchdog(() => process.kill(process.pid, "SIGTERM"))
          const shutdown = async () => {
            stopWatchdog()
            try {
              await InstanceRuntime.disposeAllInstances()
              await server.stop(true)
            } finally {
              resolve()
            }
          }
          process.once("SIGTERM", shutdown)
          process.once("SIGINT", shutdown)
          process.once("SIGHUP", shutdown)
        }),
    )
    // cssltdcode_change end
  }),
})
