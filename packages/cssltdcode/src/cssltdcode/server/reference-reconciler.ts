import { Config } from "@/config/config"
import { InstanceRef } from "@/effect/instance-ref"
import { isInterrupted } from "@/cssltdcode/effect/cause"
import * as CssltdReference from "@/cssltdcode/reference"
import { InstanceStore } from "@/project/instance-store"
import { LocationServiceMap } from "@cssltdcode/core/location-layer"
import { Location } from "@cssltdcode/core/location"
import { PluginBoot } from "@cssltdcode/core/plugin/boot"
import { ReferenceReconciler } from "@cssltdcode/server/cssltdcode/reference-reconciler"
import { Effect, Layer } from "effect"

const reconcile = Effect.gen(function* () {
  const config = yield* Config.Service
  const store = yield* InstanceStore.Service
  return Effect.gen(function* () {
    const location = yield* Location.Service
    const ctx = yield* store.load({ directory: location.directory })
    const cfg = yield* config.get().pipe(Effect.provideService(InstanceRef, ctx))
    yield* PluginBoot.Service.use((boot) => boot.wait())
    yield* CssltdReference.sync({
      references: cfg.references ?? cfg.reference ?? {},
      directory: ctx.directory,
      worktree: ctx.worktree,
    }).pipe(
      Effect.catchCause((cause) =>
        isInterrupted(cause) ? Effect.interrupt : Effect.logWarning("reference sync failed", { cause }),
      ),
    )
  })
})

export const layer = Layer.effect(ReferenceReconciler, reconcile)
export const locations = Layer.effect(
  LocationServiceMap,
  Effect.gen(function* () {
    const locations = yield* LocationServiceMap
    const initialize = yield* reconcile
    return LocationServiceMap.of({
      ...locations,
      get: (ref) => Layer.effectDiscard(initialize).pipe(Layer.provideMerge(locations.get(ref))),
      contextEffect: (ref) =>
        Effect.gen(function* () {
          const context = yield* locations.contextEffect(ref)
          yield* initialize.pipe(Effect.provide(context))
          return context
        }),
    })
  }),
).pipe(Layer.provide(LocationServiceMap.layer))
