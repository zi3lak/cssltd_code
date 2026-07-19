import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@cssltdcode/core/flag/flag"
import { InstanceRuntime } from "../../project/instance-runtime" // cssltdcode_change
import open from "open"

export const WebCommand = effectCmd({
  command: "web",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "start cssltd server and open web interface",
  // Server loads instances per-request via x-cssltd-directory header — no
  // ambient project InstanceContext needed at startup.
  instance: false, // cssltdcode_change
  handler: Effect.fn("Cli.web")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    if (!Flag.CSSLTD_SERVER_PASSWORD) {
      UI.println(UI.Style.TEXT_WARNING_BOLD + "!  CSSLTD_SERVER_PASSWORD is not set; server is unsecured.")
    }
    const opts = yield* resolveNetworkOptions(args)
    const server = yield* Effect.promise(() => Server.listen(opts))
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()

    // cssltdcode_change start
    const urls = server.urls

    UI.println(UI.Style.TEXT_INFO_BOLD + "  Local:   ", UI.Style.TEXT_NORMAL, urls.local)
    if (urls.network) {
      UI.println(UI.Style.TEXT_INFO_BOLD + "  Network: ", UI.Style.TEXT_NORMAL, urls.network)
    }

    if (opts.mdns) {
      UI.println(
        UI.Style.TEXT_INFO_BOLD + "  mDNS:    ",
        UI.Style.TEXT_NORMAL,
        `${opts.mdnsDomain}:${server.port}`,
      )
    }

    open(urls.local).catch(() => {})
    // cssltdcode_change end

    // cssltdcode_change start - graceful signal shutdown
    yield* Effect.promise(
      () =>
        new Promise<void>((resolve) => {
          const shutdown = async () => {
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
