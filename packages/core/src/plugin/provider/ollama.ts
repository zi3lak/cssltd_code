import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider"
import { ModelV2 } from "../../model"

const id = ProviderV2.ID.make("ollama")

// CSSLTD: local Ollama is a first-class provider. On startup we probe the local
// server (CSSLTD_OLLAMA_URL, then OLLAMA_HOST, then localhost:11434) and expose
// every installed model through Ollama's OpenAI-compatible endpoint. Nothing is
// registered when no server is running, so the provider list stays clean.
const PROBE_TIMEOUT_MS = 400

function baseUrl(): string {
  const raw = process.env.CSSLTD_OLLAMA_URL ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"
  const withProto = raw.includes("://") ? raw : `http://${raw}`
  return withProto.replace(/\/+$/, "")
}

type Detected = { base: string; models: string[] } | null

let probe: Promise<Detected> | undefined

function detect(): Promise<Detected> {
  probe ??= (async () => {
    const base = baseUrl()
    try {
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
      if (!res.ok) return null
      const data = (await res.json()) as { models?: { name?: string; model?: string }[] }
      const models = (data.models ?? [])
        .map((m) => m.name ?? m.model)
        .filter((name): name is string => typeof name === "string" && name.length > 0)
      if (models.length === 0) return null
      return { base, models }
    } catch {
      return null
    }
  })()
  return probe
}

export const OllamaPlugin = PluginV2.define({
  id: PluginV2.ID.make("ollama"),
  effect: Effect.gen(function* () {
    return {
      "catalog.transform": Effect.fn(function* (evt) {
        const detected = yield* Effect.promise(() => detect())
        if (!detected) return
        evt.provider.update(id, (provider) => {
          provider.name = "Ollama (local)"
          provider.api = {
            type: "aisdk",
            package: "@ai-sdk/openai-compatible",
            url: `${detected.base}/v1`,
          }
          provider.request.body.name = "ollama"
          provider.request.body.apiKey = provider.request.body.apiKey ?? "ollama"
          if (!provider.enabled) provider.enabled = { via: "custom", data: { local: true } }
        })
        for (const name of detected.models) {
          evt.model.update(id, ModelV2.ID.make(name), (model) => {
            model.name = name
            model.capabilities.tools = true
            model.capabilities.input = ["text"]
            model.capabilities.output = ["text"]
            if (model.limit.context === 0) model.limit.context = 32768
            if (model.limit.output === 0) model.limit.output = 8192
          })
        }
      }),
    }
  }),
})
