import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Catalog } from "@cssltdcode/core/catalog"
import { Connector } from "@cssltdcode/core/connector"
import { Credential } from "@cssltdcode/core/credential"
import { Database } from "@cssltdcode/core/database/database"
import { EventV2 } from "@cssltdcode/core/event"
import { Flag } from "@cssltdcode/core/flag/flag"
import { Location } from "@cssltdcode/core/location"
import { ModelsDev } from "@cssltdcode/core/models-dev"
import { PluginV2 } from "@cssltdcode/core/plugin"
import { ModelsDevPlugin } from "@cssltdcode/core/plugin/models-dev"
import { Policy } from "@cssltdcode/core/policy"
import { AbsolutePath } from "@cssltdcode/core/schema"
import { location } from "../fixture/location"
import { testEffect } from "../lib/effect"

const events = EventV2.defaultLayer
const locationLayer = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make(import.meta.dir) })),
)
const plugins = PluginV2.layer.pipe(Layer.provide(events))
const policy = Policy.layer.pipe(Layer.provide(locationLayer))
const credentials = Credential.layer.pipe(Layer.provide(Database.layerFromPath(":memory:")), Layer.provide(events))
const catalog = Catalog.layer.pipe(Layer.provide(Layer.mergeAll(events, locationLayer, plugins, policy, credentials)))
const connectors = Connector.locationLayer.pipe(Layer.provide(credentials), Layer.provide(events))
const layer = Layer.mergeAll(catalog, connectors, credentials, events, locationLayer, plugins)
const it = testEffect(layer)

describe("ModelsDevPlugin", () => {
  it.effect("registers key connectors for providers with environment variables", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => {
        const previous = {
          path: Flag.CSSLTD_MODELS_PATH,
          disabled: Flag.CSSLTD_DISABLE_MODELS_FETCH,
        }
        Flag.CSSLTD_MODELS_PATH = path.join(import.meta.dir, "fixtures", "models-dev.json")
        Flag.CSSLTD_DISABLE_MODELS_FETCH = true
        return previous
      }),
      () =>
        Effect.gen(function* () {
          yield* ModelsDevPlugin.effect
          const connectors = yield* Connector.Service
          expect(yield* connectors.list()).toEqual([
            new Connector.Info({
              id: Connector.ID.make("acme"),
              name: "Acme",
              methods: [
                new Connector.KeyMethod({ id: Connector.MethodID.make("api-key"), type: "key", label: "API Key" }),
              ],
            }),
          ])
        }).pipe(Effect.provide(ModelsDev.defaultLayer)),
      (previous) =>
        Effect.sync(() => {
          Flag.CSSLTD_MODELS_PATH = previous.path
          Flag.CSSLTD_DISABLE_MODELS_FETCH = previous.disabled
        }),
    ),
  )
})
