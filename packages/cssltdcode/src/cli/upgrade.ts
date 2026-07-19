import { Config } from "@/config/config"
import { AppRuntime } from "@/effect/app-runtime"
import { Flag } from "@cssltdcode/core/flag/flag"
import { Installation } from "@/installation"
import { InstallationVersion } from "@cssltdcode/core/installation/version"
import { GlobalBus } from "@/bus/global"

export async function upgrade() {
  const config = await AppRuntime.runPromise(Config.Service.use((cfg) => cfg.getGlobal()))
  if (config.autoupdate === false || Flag.CSSLTD_DISABLE_AUTOUPDATE) return
  const method = await Installation.method()
  // cssltdcode_change start - only auto-upgrade for npm/yarn/pnpm/bun (we only publish @cssltdcode/cli via npm registry)
  if (method !== "npm" && method !== "yarn" && method !== "pnpm" && method !== "bun") return
  // cssltdcode_change end
  const latest = await Installation.latest(method).catch(() => {})
  if (!latest) return

  if (Flag.CSSLTD_ALWAYS_NOTIFY_UPDATE) {
    GlobalBus.emit("event", {
      directory: "global",
      payload: {
        type: Installation.Event.UpdateAvailable.type,
        properties: { version: latest },
      },
    })
    return
  }

  if (InstallationVersion === latest) return

  const kind = Installation.getReleaseType(InstallationVersion, latest)

  if (config.autoupdate === "notify" || kind !== "patch") {
    GlobalBus.emit("event", {
      directory: "global",
      payload: {
        type: Installation.Event.UpdateAvailable.type,
        properties: { version: latest },
      },
    })
    return
  }

  await Installation.upgrade(method, latest)
    .then(() =>
      GlobalBus.emit("event", {
        directory: "global",
        payload: {
          type: Installation.Event.Updated.type,
          properties: { version: latest },
        },
      }),
    )
    .catch(() => {})
}
