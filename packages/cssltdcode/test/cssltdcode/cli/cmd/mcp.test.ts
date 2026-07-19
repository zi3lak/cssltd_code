import { describe, expect, test } from "bun:test"
import { CssltdcodeMcpConfig } from "@/cssltdcode/cli/cmd/mcp"

const added = `{
  "permission": {
    "bash": "allow"
  },
  "mcp": {
    "linear": {
      "type": "remote",
      "url": "https://mcp.linear.app/mcp",
      "oauth": {}
    }
  },
}`

describe("CssltdcodeMcpConfig.format", () => {
  test("writes strict JSON for cssltd.json", () => {
    const output = CssltdcodeMcpConfig.format("/tmp/cssltd.json", added)

    expect(JSON.parse(output)).toEqual({
      permission: { bash: "allow" },
      mcp: {
        linear: {
          type: "remote",
          url: "https://mcp.linear.app/mcp",
          oauth: {},
        },
      },
    })
    expect(output).not.toEndWith(",\n}")
  })

  test("preserves JSONC formatting for cssltd.jsonc", () => {
    expect(CssltdcodeMcpConfig.format("/tmp/cssltd.jsonc", added)).toBe(added)
  })
})
