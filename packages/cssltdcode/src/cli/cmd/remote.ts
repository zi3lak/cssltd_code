// cssltdcode_change - new file
import { cmd } from "./cmd"
import { bootstrap } from "../bootstrap"
import { CssltdSessions } from "@/cssltd-sessions/cssltd-sessions"
import { context } from "@/project/instance-context"
import { InstanceRuntime } from "@/project/instance-runtime"

export const RemoteCommand = cmd({
  command: "remote",
  describe: "enable remote connection for real-time session relay",
  builder: (yargs) => yargs,
  handler: async () => {
    await bootstrap(process.cwd(), async () => {
      await CssltdSessions.enableRemote()
      console.log("Remote connection enabled.")

      const abort = new AbortController()
      const shutdown = async () => {
        try {
          CssltdSessions.disableRemote()
          await InstanceRuntime.disposeInstance(context.use())
        } finally {
          abort.abort()
        }
      }
      process.on("SIGTERM", shutdown)
      process.on("SIGINT", shutdown)
      process.on("SIGHUP", shutdown)
      await new Promise((resolve) => abort.signal.addEventListener("abort", resolve))
    })
  },
})
