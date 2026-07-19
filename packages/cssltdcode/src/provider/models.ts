// cssltdcode_change - new file
import { Config } from "@/config/config"
import { Auth } from "@/auth"
import { ModelCache } from "./model-cache"
import * as Core from "@cssltdcode/core/models-dev"
import { Context, Effect, Layer } from "effect"
import { AI_SDK_PROVIDERS, CSSLTD_OPENROUTER_BASE, PROMPTS } from "@cssltdcode/cssltd-gateway"
import { overlay } from "@/cssltdcode/anaconda-desktop/provider"
import { LayerNode } from "@cssltdcode/core/effect/layer-node"

export const Model = Core.Model
export type Model = Core.Model
export const Provider = Core.Provider
export type Provider = Core.Provider
export const CatalogModelStatus = Core.CatalogModelStatus
export type CatalogModelStatus = Core.CatalogModelStatus

export interface Interface extends Core.Interface {}

export class Service extends Context.Service<Service, Interface>()("@cssltdcode/ModelsDev") {}

function baseURL(url: string | undefined, org: string | undefined) {
  if (!url) return
  const base = url.replace(/\/+$/, "")
  if (org) {
    if (base.includes("/api/organizations/")) return base
    if (base.endsWith("/api")) return `${base}/organizations/${org}`
    return `${base}/api/organizations/${org}`
  }
  if (base.includes("/openrouter")) return base
  if (base.endsWith("/api")) return `${base}/openrouter`
  return `${base}/api/openrouter`
}

export const layer: Layer.Layer<Service, never, Core.Service | Config.Service | Auth.Service | ModelCache.Service> =
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const core = yield* Core.Service
      const config = yield* Config.Service
      const auth = yield* Auth.Service
      const cache = yield* ModelCache.Service

      const get = Effect.fn("ModelsDev.get")(function* () {
        const providers = overlay(yield* core.get())
        delete providers.cssltd

        const cfg = yield* config.get()
        const disabled = new Set(cfg.disabled_providers ?? [])
        const enabled = cfg.enabled_providers ? new Set(cfg.enabled_providers) : undefined
        const allowed = (!enabled || enabled.has("cssltd")) && !disabled.has("cssltd")
        const apt = cfg.provider?.apertis?.options
        const aptURL = apt?.baseURL ?? "https://api.apertis.ai/v1"
        const aptOpts = apt?.baseURL ? { baseURL: apt.baseURL } : {}

        const addApertis = Effect.fnUntraced(function* () {
          if (providers.apertis) return
          const models = yield* cache.fetch("apertis", aptOpts).pipe(Effect.catch(() => Effect.succeed({})))
          providers.apertis = {
            id: "apertis",
            name: "Apertis",
            env: ["APERTIS_API_KEY"],
            api: aptURL,
            npm: "@ai-sdk/openai-compatible",
            models,
          }
          if (Object.keys(models).length === 0)
            yield* cache.refresh("apertis", aptOpts).pipe(Effect.ignore, Effect.forkDetach)
        })

        // cssltd_change start - local Ollama autodetect: when a server responds on
        // CSSLTD_OLLAMA_URL / OLLAMA_HOST / localhost:11434, expose every installed
        // model through Ollama's OpenAI-compatible endpoint with zero configuration.
        const addOllama = Effect.fnUntraced(function* () {
          if (providers.ollama) return
          const raw = process.env.CSSLTD_OLLAMA_URL ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"
          const base = (raw.includes("://") ? raw : `http://${raw}`).replace(/\/+$/, "")
          type Tags = { models?: { name?: string; model?: string }[] }
          const tags: Tags | null = yield* Effect.promise(() =>
            globalThis
              .fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(400) })
              .then((res): Promise<Tags | null> => (res.ok ? (res.json() as Promise<Tags>) : Promise.resolve(null)))
              .catch(() => null),
          )
          const names = (tags?.models ?? [])
            .map((m) => m.name ?? m.model)
            .filter((name): name is string => typeof name === "string" && name.length > 0)
          if (names.length === 0) return
          providers.ollama = {
            id: "ollama",
            name: "Ollama (local)",
            env: [],
            api: `${base}/v1`,
            npm: "@ai-sdk/openai-compatible",
            models: Object.fromEntries(
              names.map((name) => [
                name,
                {
                  id: name,
                  name,
                  release_date: "",
                  attachment: false,
                  reasoning: false,
                  temperature: true,
                  tool_call: true,
                  cost: { input: 0, output: 0 },
                  limit: { context: 32768, output: 8192 },
                  modalities: { input: ["text" as const], output: ["text" as const] },
                },
              ]),
            ),
          }
        })
        // cssltd_change end

        if (!allowed) {
          yield* addOllama()
          yield* addApertis()
          return providers
        }

        const opts = cfg.provider?.cssltd?.options
        const info = yield* auth.get("cssltd").pipe(Effect.catch(() => Effect.succeed(undefined)))
        const org = opts?.cssltdcodeOrganizationId ?? (info?.type === "oauth" ? info.accountId : undefined)
        const url = baseURL(opts?.baseURL, org)
        const fetch = {
          ...(url ? { baseURL: url } : {}),
          ...(org ? { cssltdcodeOrganizationId: org } : {}),
        }
        const models = yield* cache.fetch("cssltd", fetch).pipe(Effect.catch(() => Effect.succeed({})))
        providers.cssltd = {
          id: "cssltd",
          name: "Cssltd Gateway",
          env: ["CSSLTD_API_KEY"],
          api: CSSLTD_OPENROUTER_BASE.endsWith("/") ? CSSLTD_OPENROUTER_BASE : `${CSSLTD_OPENROUTER_BASE}/`,
          npm: "@cssltdcode/cssltd-gateway",
          models,
        }
        if (Object.keys(models).length === 0) yield* cache.refresh("cssltd", fetch).pipe(Effect.ignore, Effect.forkDetach)
        yield* addOllama()
        yield* addApertis()
        return providers
      })

      return Service.of({ get, refresh: core.refresh })
    }),
  )

export const defaultLayer = layer.pipe(
  Layer.provide(Core.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(Auth.defaultLayer),
  Layer.provide(ModelCache.defaultLayer),
)

export const node = LayerNode.make(layer, [Core.node, Config.node, Auth.node, ModelCache.node])

export { AI_SDK_PROVIDERS, PROMPTS }
export * as ModelsDev from "./models"
