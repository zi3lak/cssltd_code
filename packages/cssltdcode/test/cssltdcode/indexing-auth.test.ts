import { describe, expect, test } from "bun:test"
import {
  hasCssltdIndexingAuth,
  resolveCssltdIndexingAuth,
  shouldDefaultIndexingToCssltd,
} from "../../src/cssltdcode/indexing-auth"

describe("Cssltd indexing auth resolution", () => {
  test("detects auth from explicit indexing Cssltd config", () => {
    const auth = resolveCssltdIndexingAuth({
      config: { indexing: { cssltd: { apiKey: "idx-token", baseUrl: "https://idx.test", organizationId: "org_idx" } } },
    })

    expect(auth).toEqual({ apiKey: "idx-token", baseUrl: "https://idx.test", organizationId: "org_idx" })
    expect(hasCssltdIndexingAuth({ config: { indexing: { cssltd: { apiKey: "idx-token" } } } })).toBe(true)
  })

  test("detects auth from provider config, provider state, auth storage, and env", () => {
    expect(
      resolveCssltdIndexingAuth({ config: { provider: { cssltd: { options: { apiKey: "cfg-token" } } } } }).apiKey,
    ).toBe("cfg-token")
    expect(resolveCssltdIndexingAuth({ provider: { options: { cssltdcodeToken: "provider-token" } } }).apiKey).toBe(
      "provider-token",
    )
    expect(resolveCssltdIndexingAuth({ auth: { type: "oauth", access: "oauth-token", accountId: "org_oauth" } })).toEqual(
      {
        apiKey: "oauth-token",
        organizationId: "org_oauth",
      },
    )
    expect(resolveCssltdIndexingAuth({ env: { CSSLTD_API_KEY: "env-token", CSSLTD_ORG_ID: "org_env" } })).toEqual({
      apiKey: "env-token",
      organizationId: "org_env",
    })
  })

  test("defaults to Cssltd only when no provider or other embedder config is present", () => {
    const auth = { apiKey: "cssltd-token" }

    expect(shouldDefaultIndexingToCssltd({}, auth)).toBe(true)
    expect(shouldDefaultIndexingToCssltd({ provider: "openai" }, auth)).toBe(false)
    expect(shouldDefaultIndexingToCssltd({ openai: { apiKey: "openai-key" } }, auth)).toBe(false)
    expect(shouldDefaultIndexingToCssltd({ ollama: { baseUrl: "http://localhost:11434" } }, auth)).toBe(false)
  })
})
