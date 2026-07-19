import { describe, expect, test } from "bun:test"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { hasIndexingPlugin, isIndexingPlugin, normalizePluginName } from "../../../src/detect"

describe("indexing plugin detection", () => {
  test("bundles detect module for browser targets", async () => {
    const dir = await mkdtemp(`${tmpdir()}/cssltd-indexing-detect-`)
    const result = await Bun.build({
      entrypoints: [fileURLToPath(new URL("../../../src/detect.ts", import.meta.url))],
      minify: true,
      outdir: dir,
      target: "browser",
    })

    expect(result.success).toBe(true)
  })

  test("normalizes supported plugin forms", () => {
    expect(normalizePluginName("cssltd-indexing")).toBe("cssltd-indexing")
    expect(normalizePluginName("cssltd-indexing@1.2.3")).toBe("cssltd-indexing")
    expect(normalizePluginName("@cssltdcode/cssltd-indexing")).toBe("@cssltdcode/cssltd-indexing")
    expect(normalizePluginName("@cssltdcode/cssltd-indexing@1.2.3")).toBe("@cssltdcode/cssltd-indexing")
    expect(normalizePluginName("../../packages/cssltd-indexing")).toBe("@cssltdcode/cssltd-indexing")
    expect(normalizePluginName("file:///tmp/.cssltdcode/plugin/cssltd-indexing.js")).toBe("cssltd-indexing")
    expect(normalizePluginName("file:///tmp/node_modules/@cssltdcode/cssltd-indexing/index.js")).toBe(
      "@cssltdcode/cssltd-indexing",
    )
    expect(normalizePluginName("file:///tmp/repo/packages/cssltd-indexing/src/index.ts")).toBe("@cssltdcode/cssltd-indexing")
  })

  test("detects supported indexing plugin specifiers", () => {
    const values = [
      "cssltd-indexing",
      "cssltd-indexing@1.2.3",
      "@cssltdcode/cssltd-indexing",
      "@cssltdcode/cssltd-indexing@1.2.3",
      "../../packages/cssltd-indexing",
      "file:///tmp/.cssltdcode/plugin/cssltd-indexing.js",
      "file:///tmp/node_modules/@cssltdcode/cssltd-indexing/index.js",
      "file:///tmp/repo/packages/cssltd-indexing/src/index.ts",
    ]

    for (const value of values) {
      expect(isIndexingPlugin(value)).toBe(true)
    }
  })

  test("ignores unrelated plugin specifiers", () => {
    expect(isIndexingPlugin("@cssltdcode/cssltd-gateway")).toBe(false)
    expect(isIndexingPlugin("file:///tmp/.cssltdcode/plugin/index.js")).toBe(false)
    expect(hasIndexingPlugin(["@cssltdcode/cssltd-gateway", "foo@1.0.0"])).toBe(false)
  })

  test("detects indexing plugin in merged plugin lists", () => {
    expect(
      hasIndexingPlugin(["@cssltdcode/cssltd-gateway", "file:///tmp/node_modules/@cssltdcode/cssltd-indexing/index.js"]),
    ).toBe(true)
  })
})
