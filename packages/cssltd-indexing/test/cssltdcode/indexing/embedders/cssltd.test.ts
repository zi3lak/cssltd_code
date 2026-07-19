import { beforeEach, describe, expect, mock, test } from "bun:test"
import { mockEmbeddingsCreate, openAIMockFactory, setOpenAIConstructorHook } from "./__helpers__/openai-mock"

mock.module("openai", openAIMockFactory)

import { CssltdEmbedder, CSSLTD_INDEXING_FEATURE } from "../../../../src/indexing/embedders/cssltd"

describe("CssltdEmbedder", () => {
  beforeEach(() => {
    mockEmbeddingsCreate.mockReset()
    setOpenAIConstructorHook(undefined)
  })

  test("uses Cssltd Gateway headers and configured embedding model", async () => {
    const seen: unknown[] = []
    setOpenAIConstructorHook((cfg) => seen.push(cfg))
    mockEmbeddingsCreate.mockResolvedValue({
      data: [{ embedding: [0.1, 0.2] }],
      usage: { prompt_tokens: 1, total_tokens: 1 },
    })

    const embedder = new CssltdEmbedder({
      apiKey: "cssltd-token",
      organizationId: "org_123",
      modelId: "mistralai/mistral-embed-2312",
    })

    await embedder.createEmbeddings(["hello"])

    expect(seen[0]).toEqual({
      baseURL: "https://api.cssltd.ai/api/gateway/",
      apiKey: "cssltd-token",
      defaultHeaders: {
        "X-CSSLTDCODE-FEATURE": CSSLTD_INDEXING_FEATURE,
        "X-CSSLTDCODE-ORGANIZATIONID": "org_123",
      },
    })
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
      input: ["hello"],
      model: "mistralai/mistral-embed-2312",
      encoding_format: "base64",
    })
  })

  test("normalizes custom gateway base URLs", () => {
    const seen: unknown[] = []
    setOpenAIConstructorHook((cfg) => seen.push(cfg))

    new CssltdEmbedder({
      apiKey: "cssltd-token",
      baseUrl: "https://example.test/api/openrouter/",
      modelId: "mistralai/mistral-embed-2312",
    })

    expect((seen[0] as { baseURL: string }).baseURL).toBe("https://example.test/api/gateway/")
  })
})
