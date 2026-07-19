import { describe, expect, test } from "bun:test"
import { buildRequestHeaders } from "../src/provider"

describe("Cssltd provider request headers", () => {
  test("request headers override provider defaults", () => {
    const headers = buildRequestHeaders(
      {
        "content-type": "application/json",
        "x-cssltdcode-feature": "vscode-extension",
        "x-default-only": "kept",
      },
      {
        "x-cssltdcode-feature": "agent-manager",
        "x-request-only": "kept-too",
      },
    )

    expect(headers.get("content-type")).toBe("application/json")
    expect(headers.get("x-cssltdcode-feature")).toBe("agent-manager")
    expect(headers.get("x-default-only")).toBe("kept")
    expect(headers.get("x-request-only")).toBe("kept-too")
  })
})
