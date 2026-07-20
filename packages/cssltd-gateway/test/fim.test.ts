import { describe, expect, test } from "bun:test"
import { resolveFimTarget } from "../src/fim"

describe("FIM target resolution", () => {
  test("keeps gateway autocomplete models on Cssltd Gateway", () => {
    expect(resolveFimTarget("cssltd", "mistralai/codestral-2508")).toEqual({
      provider: "cssltd",
      model: "mistralai/codestral-2508",
      url: "https://gateway.cssltd.internal/api/fim/completions",
    })
    expect(resolveFimTarget("cssltd", "inception/mercury-edit-2")).toEqual({
      provider: "cssltd",
      model: "inception/mercury-edit-2",
      url: "https://gateway.cssltd.internal/api/fim/completions",
    })
  })

  test("routes explicit provider autocomplete models directly", () => {
    expect(resolveFimTarget("mistral", "codestral-2508")).toEqual({
      provider: "mistral",
      model: "codestral-2508",
    })
    expect(resolveFimTarget("inception", "mercury-edit-2")).toEqual({
      provider: "inception",
      model: "mercury-edit-2",
      url: "https://api.inceptionlabs.ai/v1/fim/completions",
    })
  })

  test("preserves gateway model pass-through behavior", () => {
    expect(resolveFimTarget()).toEqual({
      provider: "cssltd",
      model: "mistralai/codestral-2501",
      url: "https://gateway.cssltd.internal/api/fim/completions",
    })
    expect(resolveFimTarget(undefined, "mistralai/codestral-2508")).toEqual({
      provider: "cssltd",
      model: "mistralai/codestral-2508",
      url: "https://gateway.cssltd.internal/api/fim/completions",
    })
    expect(resolveFimTarget(undefined, "inception/mercury-edit")).toEqual({
      provider: "cssltd",
      model: "inception/mercury-edit",
      url: "https://gateway.cssltd.internal/api/fim/completions",
    })
    expect(resolveFimTarget("cssltd", "custom/fim-model")).toEqual({
      provider: "cssltd",
      model: "custom/fim-model",
      url: "https://gateway.cssltd.internal/api/fim/completions",
    })
  })
})
