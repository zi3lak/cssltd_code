import { describe, expect, test } from "bun:test"
import path from "path"

const root = path.join(__dirname, "..", "..")

describe("Cssltd OAuth branding", () => {
  test("Codex OAuth browser flow uses Cssltd branding", async () => {
    const src = await Bun.file(path.join(root, "src", "plugin", "openai", "codex.ts")).text()

    expect(src).toContain('originator: "cssltd"')
    expect(src).toContain('"User-Agent": `cssltd/${InstallationVersion}`')
    expect(src).toContain("return to Cssltd")
    expect(src).not.toContain('originator: "cssltdcode"')
    expect(src).not.toContain("return to CssltdCode")
  })

  test("extracted core OAuth browser flow uses Cssltd branding", async () => {
    const src = await Bun.file(path.join(root, "..", "core", "src", "plugin", "provider", "openai-auth.ts")).text()

    expect(src).toContain('originator: "cssltd"')
    expect(src).toContain('"User-Agent": `cssltd/${InstallationVersion}`')
    expect(src).toContain("<title>Cssltd</title>")
    expect(src).not.toContain('originator: "cssltdcode"')
    expect(src).not.toContain("<title>CssltdCode</title>")
  })

  test("MCP OAuth callback page uses Cssltd branding", async () => {
    const src = await Bun.file(path.join(root, "src", "mcp", "oauth-callback.ts")).text()

    expect(src).toContain("return to Cssltd")
    expect(src).not.toContain("return to CssltdCode")
  })
})
