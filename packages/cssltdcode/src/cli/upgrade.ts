import { Config } from "@/config/config"
import { AppRuntime } from "@/effect/app-runtime"
import { Flag } from "@cssltdcode/core/flag/flag"
import { Installation } from "@/installation"
import { InstallationVersion } from "@cssltdcode/core/installation/version"
import { GlobalBus } from "@/bus/global"

// cssltdcode_change start - INACTIVE: no release channel exists yet (no npm
// package, GitHub Releases, Homebrew/Choco/Scoop — see README.md "Install").
// This whole auto-update path is scaffolding for once a real channel exists;
// until then it must stay a guaranteed no-op rather than silently probing
// registries. Do not remove this guard without first wiring up a real,
// published distribution channel in `@/installation`.
const RELEASE_CHANNEL_CONFIGURED = false
// cssltdcode_change end

export async function upgrade() {
  if (!RELEASE_CHANNEL_CONFIGURED) return
  const config = await AppRuntime.runPromise(Config.Service.use((cfg) => cfg.getGlobal()))
  if (config.autoupdate === false || Flag.CSSLTD_DISABLE_AUTOUPDATE) return
  const method = await Installation.method()
  // cssltdcode_change start - only auto-upgrade for npm/yarn/pnpm/bun
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
