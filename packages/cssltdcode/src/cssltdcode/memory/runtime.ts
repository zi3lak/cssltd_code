import { Global } from "@cssltdcode/core/global"
import * as Log from "@cssltdcode/core/util/log"
import { MemoryInstance } from "@cssltdcode/cssltd-memory/effect/instance"
import { MemoryLog } from "@cssltdcode/cssltd-memory/effect/log"
import { MemoryPaths } from "@cssltdcode/cssltd-memory/effect/paths"
import { bind } from "@/cssltdcode/instance"
import { MemoryEvents } from "./events"

const log = Log.create({ service: "memory" })

let installed = false

/** Wire the package's injectable seams to cssltdcode at process startup: the instance-context binder
 * (so async package calls survive the host ALS), the diagnostic logger, host paths (resolved from
 * Global), and the Bus-backed event sink. Idempotent. */
export function installMemoryRuntime() {
  if (installed) return
  installed = true
  MemoryPaths.configure(() => ({ data: Global.Path.data }))
  MemoryInstance.setBinder((fn) => bind(fn))
  MemoryLog.setWarn((message, meta) => log.warn(message, meta))
  MemoryEvents.install()
}
