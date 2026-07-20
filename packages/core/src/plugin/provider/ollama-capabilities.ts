// Shared by packages/core/src/plugin/provider/ollama.ts and
// packages/cssltdcode/src/provider/models.ts, which both autodetect a local
// Ollama server. `/api/tags` only returns model names, so capabilities used
// to be hardcoded (tools always on, no vision, a fixed 32k/8k context/output)
// regardless of what the model actually supports. This queries `/api/show`
// per model instead, which exposes real capabilities on Ollama servers new
// enough to report them.

export type OllamaCapabilities = {
  tools: boolean
  vision: boolean
  context?: number
  output?: number
}

type ShowResponse = {
  capabilities?: string[]
  model_info?: Record<string, unknown>
}

function firstNumber(info: Record<string, unknown> | undefined, suffix: string): number | undefined {
  if (!info) return undefined
  for (const [key, value] of Object.entries(info)) {
    if (key.endsWith(suffix) && typeof value === "number") return value
  }
  return undefined
}

export async function fetchOllamaCapabilities(
  base: string,
  model: string,
  timeoutMs = 400,
): Promise<OllamaCapabilities> {
  try {
    const res = await fetch(`${base}/api/show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { tools: false, vision: false }
    const data = (await res.json()) as ShowResponse
    // Older Ollama servers don't report `capabilities` at all; treat that as
    // "unknown" rather than "supports everything".
    const capabilities = new Set(data.capabilities ?? [])
    return {
      tools: capabilities.has("tools"),
      vision: capabilities.has("vision"),
      context: firstNumber(data.model_info, ".context_length"),
      output: firstNumber(data.model_info, ".output_length") ?? firstNumber(data.model_info, ".prediction_length"),
    }
  } catch {
    return { tools: false, vision: false }
  }
}
