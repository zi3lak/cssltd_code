import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { Catalog } from "@cssltdcode/core/catalog"
import { Credential } from "@cssltdcode/core/credential"
import { PluginV2 } from "@cssltdcode/core/plugin"
import { ProviderPlugins } from "@cssltdcode/core/plugin/provider"
import { CssltdPlugin } from "@cssltdcode/core/plugin/provider/cssltd"
import { ProviderV2 } from "@cssltdcode/core/provider"
import { expectPluginRegistered, it, model, provider, withEnv } from "./provider-helper" // cssltdcode_change

describe("CssltdPlugin", () => {
  it.effect("is registered so legacy referer headers can be applied", () =>
    Effect.sync(() =>
      expectPluginRegistered(
        ProviderPlugins.map((item) => item.id),
        "cssltd",
      ),
    ),
  )

  it.effect("applies legacy referer headers only to cssltd", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(CssltdPlugin)
      const transform = yield* catalog.transform()
      yield* transform((catalog) => {
        const cssltd = provider("cssltd", {
          api: { type: "aisdk", package: "@ai-sdk/openai-compatible", url: "https://api.cssltd.ai/api/gateway" },
          request: { headers: { Existing: "value" }, body: {} },
        })
        catalog.provider.update(cssltd.id, (draft) => {
          draft.api = cssltd.api
          draft.request = cssltd.request
        })
        catalog.provider.update(provider("openrouter").id, () => {})
      })
      expect((yield* catalog.provider.get(ProviderV2.ID.make("cssltd"))).request.headers).toEqual({
        Existing: "value",
        "HTTP-Referer": "https://cssltd.ai/",
        "X-Title": "CSSLTD Code", // cssltdcode_change
      })
      expect((yield* catalog.provider.get(ProviderV2.ID.openrouter)).request.headers).toEqual({})
    }),
  )

  it.effect("uses the exact legacy Cssltd header casing and set", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(CssltdPlugin)
      const transform = yield* catalog.transform()
      yield* transform((catalog) => {
        const item = provider("cssltd", {
          api: { type: "aisdk", package: "@ai-sdk/openai-compatible", url: "https://api.cssltd.ai/api/gateway" },
        })
        catalog.provider.update(item.id, (draft) => {
          draft.api = item.api
        })
      })

      const result = yield* catalog.provider.get(ProviderV2.ID.make("cssltd"))
      expect(result.request.headers).toEqual({
        "HTTP-Referer": "https://cssltd.ai/",
        "X-Title": "CSSLTD Code", // cssltdcode_change
      })
      expect(result.request.headers).not.toHaveProperty("http-referer")
      expect(result.request.headers).not.toHaveProperty("x-title")
      expect(result.request.headers).not.toHaveProperty("X-Source")
    }),
  )

  it.effect("uses the legacy provider-id guard instead of endpoint package matching", () =>
    Effect.gen(function* () {
      const plugin = yield* PluginV2.Service
      const catalog = yield* Catalog.Service
      yield* plugin.add(CssltdPlugin)
      const transform = yield* catalog.transform()
      yield* transform((catalog) => {
        const cssltd = provider("cssltd", {
          api: { type: "aisdk", package: "@ai-sdk/openai-compatible", url: "https://api.cssltd.ai/api/gateway" },
        })
        catalog.provider.update(cssltd.id, (draft) => {
          draft.api = cssltd.api
        })
        const custom = provider("custom-cssltd", {
          api: { type: "aisdk", package: "cssltd" },
        })
        catalog.provider.update(custom.id, (draft) => {
          draft.api = custom.api
        })
      })

      expect((yield* catalog.provider.get(ProviderV2.ID.make("cssltd"))).request.headers).toEqual({
        "HTTP-Referer": "https://cssltd.ai/",
        "X-Title": "CSSLTD Code", // cssltdcode_change
      })
      expect((yield* catalog.provider.get(ProviderV2.ID.make("custom-cssltd"))).request.headers).toEqual({})
    }),
  )

  // cssltdcode_change start
  it.effect("routes the Cssltd catalog through the Cssltd Gateway SDK", () =>
    withEnv({ CSSLTD_API_KEY: undefined, CSSLTD_ORG_ID: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(CssltdPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("cssltd", {
            api: { type: "aisdk", package: "@ai-sdk/openai-compatible", url: "https://api.cssltd.ai/api/gateway" },
            request: { headers: {}, body: { apiKey: "stored-token" } },
          })
          catalog.provider.update(item.id, (draft) => {
            draft.api = item.api
            draft.request = item.request
          })
        })
        const updated = yield* catalog.provider.get(ProviderV2.ID.make("cssltd"))

        expect(updated.api).toEqual({
          type: "aisdk",
          package: "@cssltdcode/cssltd-gateway",
          url: "https://api.cssltd.ai/api/openrouter",
        })
        expect(updated.request.body.cssltdcodeToken).toBe("stored-token")

        const result = yield* plugin.trigger(
          "aisdk.sdk",
          {
            model: model("cssltd", "cssltd-auto/free"),
            package: "@cssltdcode/cssltd-gateway",
            options: updated.request.body,
          },
          {},
        )
        expect(result.sdk).toBeDefined()
        expect(typeof result.sdk.languageModel).toBe("function")
        expect(typeof result.sdk.anthropic).toBe("function")
      }),
    ),
  )

  it.effect("keeps authenticated credentials ahead of inherited environment keys", () =>
    withEnv({ CSSLTD_API_KEY: "environment-token", CSSLTD_ORG_ID: "environment-org" }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(CssltdPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => {
          const item = provider("cssltd", {
            enabled: { via: "credential", credentialID: Credential.ID.make("cred_cssltd") },
            request: {
              headers: {},
              body: { apiKey: "authenticated-token", cssltdcodeOrganizationId: "authenticated-org" },
            },
          })
          catalog.provider.update(item.id, (draft) => {
            draft.enabled = item.enabled
            draft.request = item.request
          })
        })
        const result = yield* catalog.provider.get(ProviderV2.ID.make("cssltd"))

        expect(result.enabled).toEqual({ via: "credential", credentialID: Credential.ID.make("cred_cssltd") })
        expect(result.request.body.cssltdcodeToken).toBe("authenticated-token")
        expect(result.request.body.cssltdcodeOrganizationId).toBe("environment-org")
      }),
    ),
  )

  it.effect("keeps anonymous Cssltd models available without credentials", () =>
    withEnv({ CSSLTD_API_KEY: undefined, CSSLTD_ORG_ID: undefined }, () =>
      Effect.gen(function* () {
        const plugin = yield* PluginV2.Service
        const catalog = yield* Catalog.Service
        yield* plugin.add(CssltdPlugin)
        const transform = yield* catalog.transform()
        yield* transform((catalog) => catalog.provider.update(ProviderV2.ID.make("cssltd"), () => {}))
        const result = yield* catalog.provider.get(ProviderV2.ID.make("cssltd"))

        expect(result.enabled).toEqual({ via: "custom", data: { anonymous: true } })
        expect(result.request.body.cssltdcodeToken).toBe("anonymous")
      }),
    ),
  )
  // cssltdcode_change end
})
