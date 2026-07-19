import { describe, test, expect } from "bun:test"
import path from "path"

// Regression guard for branding drift in user-facing MCP strings.
//
// History: upstream CssltdCode has repeatedly overwritten the Cssltd-branded
// toast message and MCP client `name` field during large refactors — most
// recently in upstream PR #22913 (commit 5fccdc9fc, "refactor: collapse mcp
// barrel into mcp/index.ts") which Cssltd picked up via the v1.4.7 merge (PR
// #9346, commit 57630eaf1). The original fix was PR #7174.
//
// This test asserts the surviving Cssltd-branded strings directly against the
// source so that the next upstream churn on this file fails the Cssltd test
// suite instead of shipping an "cssltdcode mcp auth" popup to end users.

const mcpSource = path.join(__dirname, "..", "..", "src", "mcp", "index.ts")

describe("Cssltd MCP branding", () => {
  test("auth toast tells the user to run `cssltd mcp auth`, never `cssltdcode mcp auth`", async () => {
    const src = await Bun.file(mcpSource).text()
    expect(src).toContain("Run: cssltd mcp auth ${key}")
    expect(src).not.toContain("Run: cssltdcode mcp auth")
  })

  test("MCP `Client` instances identify themselves as `cssltd`", async () => {
    const src = await Bun.file(mcpSource).text()
    // `name: "cssltdcode"` is the upstream default and appears in the protocol
    // handshake / client identification fields. Any new `new Client({ ... })`
    // must use the Cssltd brand.
    const cssltdcodeClientName = /name:\s*"cssltdcode"/g
    expect(src.match(cssltdcodeClientName)).toBeNull()
  })
})
