import { Cause, Context, Effect, Layer } from "effect"
import { EffectBridge } from "@/effect/bridge"
import { CssltdSessions } from "@/cssltd-sessions/cssltd-sessions"
import * as Log from "@cssltdcode/core/util/log"
import { Global } from "@cssltdcode/core/global"
import { InstallationVersion } from "@cssltdcode/core/installation/version"
import path from "node:path"
import { Bus } from "@/bus"
import { Provider } from "@/provider/provider"
import { Session } from "@/session/session"
import { SessionSummary } from "@/session/summary"
import { SessionExport } from "@/cssltdcode/session-export"
import { createWorkspaceProvider } from "@/cssltdcode/session-export/workspace-provider"
import { Instance } from "@/cssltdcode/instance"
import { Identity } from "@cssltdcode/cssltd-telemetry"
import { MemoryLifecycle } from "@/cssltdcode/memory/turn"
import { MemoryService } from "@cssltdcode/cssltd-memory/effect/service"
import { MemoryEvents } from "@/cssltdcode/memory/events"
import { installMemoryRuntime } from "@/cssltdcode/memory/runtime"
import { CssltdToolRegistry } from "@/cssltdcode/tool/registry"
import { LayerNode } from "@cssltdcode/core/effect/layer-node"

const log = Log.create({ service: "cssltdcode-bootstrap" })

export namespace CssltdcodeBootstrap {
  export interface Interface {
    readonly init: () => Effect.Effect<void, unknown>
  }

  export class Service extends Context.Service<Service, Interface>()("@cssltdcode/Bootstrap") {}

  export const layer = Layer.effect(
    Service,
    Effect.gen(function* () {
      // Bind the package memory effect layer to cssltdcode (paths, instance binder, logger, event sink).
      installMemoryRuntime()
      const cssltd = yield* CssltdSessions.Service
      const bus = yield* Bus.Service
      const sessions = yield* Session.Service
      const summary = yield* SessionSummary.Service
      const provider = yield* Provider.Service
      const memory = yield* MemoryService.Service

      const init = Effect.fn("CssltdcodeBootstrap.init")(function* () {
        yield* cssltd.init()
        yield* MemoryLifecycle.subscribe({ bus, sessions, summary, provider, memory })
        // Invalidate enabled cache on every memory state mutation (properties.directory holds the memory root).
        yield* bus.subscribeCallback(MemoryEvents.Status, (evt) =>
          CssltdToolRegistry.invalidateMemoryEnabled(evt.properties.directory),
        )
        yield* bus.subscribeCallback(MemoryEvents.Updated, (evt) =>
          CssltdToolRegistry.invalidateMemoryEnabled(evt.properties.directory),
        )
        // cssltdcode_change start - session export bootstrap
        yield* Effect.gen(function* () {
          if (!SessionExport.enabled) return
          const anon = yield* EffectBridge.fromPromise(() =>
            Identity.getMachineId().catch((err) => {
              log.warn("session export identity failed", { err })
              return undefined
            }),
          )
          SessionExport.init({
            agentVersion: InstallationVersion,
            anonId: anon,
            dbPath: path.join(Global.Path.data, "session-export.db"),
            workspaceKey: Instance.directory,
            subscribeAll: (cb) => Bus.subscribeAll(cb),
            snapshotProvider: createWorkspaceProvider({
              root: Instance.directory,
              statePath: path.join(Global.Path.data, "session-export-workspace.json"),
            }),
          })
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => log.warn("session export bootstrap failed", { err: Cause.squash(cause) })),
          ),
        )
        // cssltdcode_change end
        yield* EffectBridge.fromPromise(() =>
          import("@/cssltdcode/indexing").then((mod) => mod.CssltdIndexing.init()),
        ).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => log.warn("indexing bootstrap failed", { err: Cause.squash(cause) })),
          ),
          Effect.forkDetach,
        )
      })

      return Service.of({ init })
    }),
  )

  export const defaultLayer = layer.pipe(
    Layer.provide([
      CssltdSessions.defaultLayer,
      Session.defaultLayer,
      SessionSummary.defaultLayer,
      Provider.defaultLayer,
      MemoryService.layer,
      Bus.defaultLayer,
    ]),
  )

  const memory = LayerNode.make(MemoryService.layer, [])
  export const node = LayerNode.make(layer, [
    CssltdSessions.node,
    Session.node,
    SessionSummary.node,
    Provider.node,
    memory,
    Bus.node,
  ])
}
