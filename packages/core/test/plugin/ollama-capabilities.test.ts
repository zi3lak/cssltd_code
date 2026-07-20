import { afterEach, describe, expect, test } from "bun:test"
import { fetchOllamaCapabilities } from "@cssltdcode/core/plugin/provider/ollama-capabilities"

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockShowResponse(body: unknown, ok = true) {
  globalThis.fetch = (() =>
    Promise.resolve({
      ok,
      json: () => Promise.resolve(body),
    })) as unknown as typeof fetch
}

describe("fetchOllamaCapabilities", () => {
  test("reports tools and vision when the server lists them", async () => {
    mockShowResponse({
      capabilities: ["completion", "tools", "vision"],
      model_info: { "llama.context_length": 131072 },
    })
    const caps = await fetchOllamaCapabilities("http://127.0.0.1:11434", "llava")
    expect(caps).toEqual({ tools: true, vision: true, context: 131072, output: undefined })
  })

  test("does not assume tool/vision support when the server omits capabilities", async () => {
    mockShowResponse({ model_info: {} })
    const caps = await fetchOllamaCapabilities("http://127.0.0.1:11434", "old-model")
    expect(caps.tools).toBe(false)
    expect(caps.vision).toBe(false)
  })

  test("falls back to unknown capabilities on a non-ok response", async () => {
    mockShowResponse({}, false)
    const caps = await fetchOllamaCapabilities("http://127.0.0.1:11434", "missing-model")
    expect(caps).toEqual({ tools: false, vision: false })
  })

  test("falls back to unknown capabilities when the request throws", async () => {
    globalThis.fetch = (() => Promise.reject(new Error("network error"))) as unknown as typeof fetch
    const caps = await fetchOllamaCapabilities("http://127.0.0.1:11434", "unreachable")
    expect(caps).toEqual({ tools: false, vision: false })
  })
})
