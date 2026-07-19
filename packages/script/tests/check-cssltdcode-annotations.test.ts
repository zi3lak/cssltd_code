import { describe, expect, test } from "bun:test"
import path from "node:path"

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".yml", ".yaml", ".toml", ".sh", ".bash", ".zsh"])
const FILES = new Map<string, string>()
const SCOPES = [
  "packages/cssltdcode",
  "packages/extensions",
  "packages/ui",
  "packages/shared",
  "packages/script",
  "packages/storybook",
  "script",
  ".github",
  "github",
]
const EXEMPT_SCOPES = [
  "script/upstream",
  "script/check-cssltdcode-annotations.ts",
  "packages/script/tests/check-cssltdcode-annotations.test.ts",
  ".github/workflows/check-cssltdcode-annotations.yml",
]

function isChecked(file: string) {
  const norm = file.replaceAll("\\", "/")
  return SCOPES.some((scope) => norm === scope || norm.startsWith(`${scope}/`))
}

function isExempt(file: string) {
  const norm = file.replaceAll("\\", "/").toLowerCase()
  if (norm.split("/").some((part) => part.includes("cssltdcode") || part.startsWith("cssltd-"))) return true
  return EXEMPT_SCOPES.some((scope) => norm === scope || norm.startsWith(`${scope}/`))
}

function isSource(file: string) {
  const ext = path.extname(file)
  if (SOURCE_EXTS.has(ext)) return true
  if (ext) return false
  return FILES.get(file)?.startsWith("#!") ?? false
}

const MARKER_PREFIX = /(?:\/\/|\{?\s*\/\*|#)\s*cssltdcode_change\b/

function hasMarker(line: string) {
  return MARKER_PREFIX.test(line)
}

function coveredLines(text: string): Set<number> {
  const lines = text.split(/\r?\n/)
  const covered = new Set<number>()

  const first = lines.find((x) => x.trim() !== "" && !x.startsWith("#!"))
  if (first?.match(/(?:\/\/|\{?\s*\/\*|#)\s*cssltdcode_change\s*-\s*new\s*file\b/)) {
    for (let i = 1; i <= lines.length; i++) covered.add(i)
    return covered
  }

  let block = false
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1
    const line = lines[i] ?? ""

    if (line.match(/(?:\/\/|\{?\s*\/\*|#)\s*cssltdcode_change\s+start\b/)) {
      block = true
      covered.add(n)
      continue
    }

    if (line.match(/(?:\/\/|\{?\s*\/\*|#)\s*cssltdcode_change\s+end\b/)) {
      covered.add(n)
      block = false
      continue
    }

    if (block) {
      covered.add(n)
      continue
    }

    if (hasMarker(line)) covered.add(n)
  }

  return covered
}

// ─── hasMarker tests ──────────────────────────────────────────────────────────

describe("hasMarker", () => {
  const cases: Array<[string, boolean]> = [
    // JS-style inline
    ["// cssltdcode_change", true],
    ["  // cssltdcode_change", true],
    ["const x = 1 // cssltdcode_change", true],
    ["// cssltdcode_change start", true],
    ["// cssltdcode_change end", true],
    ["// cssltdcode_change - new file", true],
    ["//   cssltdcode_change", true],
    ["// cssltdcode_change  ", true],

    // JSX-style inline
    ["{/* cssltdcode_change */}", true],
    ["  {/* cssltdcode_change */}", true],
    ["{/* cssltdcode_change start */}", true],
    ["{/* cssltdcode_change end */}", true],
    ["{/* cssltdcode_change - new file */}", true],
    ["{/* cssltdcode_change - CssltdNews added */}", true],
    ["{/*   cssltdcode_change */}", true],
    ["{/* cssltdcode_change  */}", true],

    // bare /* */ style
    ["/* cssltdcode_change */", true],
    ["  /* cssltdcode_change */", true],
    ["/* cssltdcode_change start */", true],
    ["/* cssltdcode_change end */", true],

    // YAML/TOML/shell-style inline
    ["# cssltdcode_change", true],
    ["  # cssltdcode_change", true],
    ["name: test # cssltdcode_change", true],
    ['name = "zed" # cssltdcode_change', true],
    ['export FOO="bar" # cssltdcode_change', true],
    ["# cssltdcode_change start", true],
    ["# cssltdcode_change end", true],

    // Non-markers
    ["const x = 1", false],
    ["<text fg={color}>{label}</text>", false],
    ["// some other comment", false],
    ["{/* just a comment */}", false],
    ["/* something else */", false],
    // typo variants — should NOT match (missing word boundary)
    ["// cssltdcode_changes", false],
    ["// cssltdcode_changelog", false],
    ["/* cssltdcode_change_log */", false],
    ["{/* cssltdcode_changes */}", false],
    ["// cssltdcode_changeable", false],
    ["", false],
    ["  ", false],
  ]

  test.each(cases)("input %j → %j", (input, expected) => {
    expect(hasMarker(input)).toBe(expected)
  })
})

// ─── isExempt tests ───────────────────────────────────────────────────────────

describe("isExempt", () => {
  const cases: Array<[string, boolean]> = [
    // exempt — "cssltdcode" in path
    ["packages/cssltdcode/src/cssltdcode/foo.ts", true],
    ["packages/cssltdcode/test/cssltdcode/bar.test.ts", true],
    ["packages/cssltdcode/src/some/cssltdcode/deep/path.ts", true],
    ["packages/cssltdcode/src/cssltdcode/deep/nested/file.tsx", true],
    ["packages/cssltdcode/src/cssltd-sessions/session.ts", true],
    ["packages/cssltd-ui/src/components/icon.tsx", true],
    ["packages/cssltd-vscode/src/extension.ts", true],
    ["script/upstream/merge.ts", true],
    ["script/check-cssltdcode-annotations.ts", true],
    ["packages/script/tests/check-cssltdcode-annotations.test.ts", true],
    [".github/workflows/check-cssltdcode-annotations.yml", true],
    // exempt — "cssltdcode" in filename
    ["packages/cssltdcode/src/foo/cssltdcode.ts", true],
    ["packages/cssltdcode/src/bar/cssltdcode.test.ts", true],
    ["packages/cssltdcode/src/file.cssltdcode.ts", true],
    // exempt — case-insensitive
    ["packages/cssltdcode/src/CssltdCode/foo.ts", true],
    ["packages/cssltdcode/src/CSSLTDCODE/bar.ts", true],
    // NOT exempt
    ["packages/cssltdcode/src/index.ts", false],
    ["packages/cssltdcode/src/cli/cmd/tui/routes/home.tsx", false],
    ["packages/cssltdcode/src/cli/cmd/tui/routes/session/index.tsx", false],
    ["packages/cssltdcode/src/tool/registry.ts", false],
    ["packages/cssltdcode/src/config/config.ts", false],
    ["packages/cssltdcode/src/indexing/search-service.ts", false],
    ["packages/ui/src/components/icon.tsx", false],
    ["packages/extensions/zed/extension.toml", false],
    ["github/script/release", false],
    ["github/script/publish", false],
    ["script/changelog.ts", false],
    // cssltdcode_change is not the same as cssltdcode
    ["packages/cssltdcode/src/check-cssltdcode-annotations.ts", false],
  ]

  test.each(cases)("%j → exempt=%j", (file, expected) => {
    expect(isExempt(file)).toBe(expected)
  })
})

describe("isChecked", () => {
  const cases: Array<[string, boolean]> = [
    ["packages/cssltdcode/src/index.ts", true],
    ["packages/ui/src/components/icon.tsx", true],
    ["sdks/vscode/src/extension.ts", false],
    ["packages/extensions/zed/extension.toml", true],
    ["packages/shared/src/index.ts", true],
    ["packages/script/src/index.ts", true],
    ["packages/storybook/.storybook/main.ts", true],
    ["script/check-cssltdcode-annotations.ts", true],
    [".github/workflows/test.yml", true],
    ["github/action.yml", true],
    ["github/script/release", true],
    ["github/script/publish", true],
    ["packages/cssltd-ui/src/components/icon.tsx", false],
    ["packages/cssltd-vscode/src/extension.ts", false],
    ["packages/sdk/js/src/index.ts", false],
    ["README.md", false],
  ]

  test.each(cases)("%j → checked=%j", (file, expected) => {
    expect(isChecked(file)).toBe(expected)
  })
})

// ─── isSource tests ───────────────────────────────────────────────────────────

describe("isSource", () => {
  const cases: Array<[string, boolean]> = [
    ["foo.ts", true],
    ["foo.tsx", true],
    ["foo/bar.tsx", true],
    ["foo.js", true],
    ["foo.jsx", true],
    [".json", false],
    ["workflow.yml", true],
    ["workflow.yaml", true],
    ["extension.toml", true],
    ["script.sh", true],
    ["script.bash", true],
    ["script.zsh", true],
    [".md", false],
    [".txt", false],
    ["Makefile", false],
    ["github/script/release", true],
    ["github/script/plain", false],
    ["foo.go", false],
    ["foo.rs", false],
  ]

  test.each(cases)("%j → isSource=%j", (file, expected) => {
    FILES.set("github/script/release", "#!/usr/bin/env bash\n")
    FILES.set("github/script/plain", "set -euo pipefail\n")
    expect(isSource(file)).toBe(expected)
    FILES.clear()
  })
})

// ─── coveredLines tests ───────────────────────────────────────────────────────

describe("coveredLines", () => {
  test("empty file", () => {
    const covered = coveredLines("")
    expect(covered.size).toBe(0)
  })

  test("file with only whitespace", () => {
    const covered = coveredLines("   \n\n  \n")
    expect(covered.size).toBe(0)
  })

  test("whole-file JS annotation", () => {
    const covered = coveredLines("// cssltdcode_change - new file\nexport const x = 1\nexport const y = 2")
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("whole-file JS annotation after shebang", () => {
    const covered = coveredLines("#!/usr/bin/env bun\n// cssltdcode_change - new file\nexport const x = 1")
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("whole-file JSX annotation", () => {
    const covered = coveredLines("{/* cssltdcode_change - new file */}\nexport const x = 1\nexport const y = 2")
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("whole-file YAML annotation", () => {
    const covered = coveredLines("# cssltdcode_change - new file\nname: test\non: pull_request")
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("whole-file TOML annotation", () => {
    const covered = coveredLines('# cssltdcode_change - new file\nid = "cssltdcode"\nname = "CssltdCode"')
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("whole-file shell annotation after shebang", () => {
    const covered = coveredLines("#!/usr/bin/env bash\n# cssltdcode_change - new file\nset -euo pipefail")
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("JS block markers", () => {
    const text = [
      "const a = 1",
      "// cssltdcode_change start",
      "const b = 2",
      "const c = 3",
      "// cssltdcode_change end",
      "const d = 4",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([2, 3, 4, 5])) // block markers + content
  })

  test("JSX block markers", () => {
    const text = [
      "const a = 1",
      "{/* cssltdcode_change start */}",
      "const b = 2",
      "const c = 3",
      "{/* cssltdcode_change end */}",
      "const d = 4",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([2, 3, 4, 5]))
  })

  test("mixed JS and JSX block markers (nested)", () => {
    const text = [
      "// cssltdcode_change start",
      "{/* cssltdcode_change start */}",
      "const b = 2",
      "{/* cssltdcode_change end */}",
      "// cssltdcode_change end",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3, 4, 5]))
  })

  test("bare /* */ block markers", () => {
    const text = ["/* cssltdcode_change start */", "const b = 2", "/* cssltdcode_change end */"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("YAML block markers", () => {
    const text = ["# cssltdcode_change start", "name: test", "# cssltdcode_change end"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("TOML block markers", () => {
    const text = ["# cssltdcode_change start", 'id = "cssltdcode"', "# cssltdcode_change end"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("shell block markers", () => {
    const text = ["# cssltdcode_change start", "set -euo pipefail", "# cssltdcode_change end"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("inline JS marker covers only that line", () => {
    const text = ["const a = 1", "const b = 2 // cssltdcode_change", "const c = 3"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([2]))
  })

  test("inline JSX marker covers only that line", () => {
    const text = ["const a = 1", "{/* cssltdcode_change */}", "const c = 3"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([2]))
  })

  test("inline JS marker with code on same line", () => {
    const text = "const url = Flag.CSSLTD_MODELS_URL || 'https://models.dev' // cssltdcode_change\n"
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1]))
  })

  test("JSX block marker with descriptive suffix", () => {
    const text = [
      "{/* cssltdcode_change start - Cssltd-specific error display */}",
      "<ErrorDisplay />",
      "{/* cssltdcode_change end */}",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("multiple independent blocks", () => {
    const text = [
      "// cssltdcode_change start",
      "const a = 1",
      "// cssltdcode_change end",
      "const b = 2",
      "{/* cssltdcode_change start */}",
      "const c = 3",
      "{/* cssltdcode_change end */}",
      "const d = 4",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3, 5, 6, 7]))
  })

  test("marker line with extra text after marker is still covered", () => {
    const text = [
      "const a = 1",
      "// cssltdcode_change start - this is cssltd specific",
      "const b = 2",
      "// cssltdcode_change end",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([2, 3, 4]))
  })

  test("nested block — inner block ends, outer continues", () => {
    const text = [
      "// cssltdcode_change start",
      "{/* cssltdcode_change start */}",
      "const b = 2",
      "{/* cssltdcode_change end */}",
      "const c = 3",
      "// cssltdcode_change end",
    ].join("\n")
    const covered = coveredLines(text)
    // Line 1: start, block=true
    // Line 2: inner start, block=true (covered by block)
    // Line 3: covered by block
    // Line 4: inner end, block=false, covered by end marker
    // Line 5: NOT covered (block is false, no inline marker)
    // Line 6: outer end, block already false, covered by end marker
    expect(covered).toEqual(new Set([1, 2, 3, 4, 6]))
  })

  test("whitespace before marker is handled", () => {
    const text = ["  {/* cssltdcode_change start */}", "    const b = 2", "  {/* cssltdcode_change end */}"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })
})

// ─── checkLine integration tests ──────────────────────────────────────────────
// Simulates what the main loop does for each added line

describe("checkLine (main loop simulation)", () => {
  function check(text: string, addedLines: number[]): string[] {
    const covered = coveredLines(text)
    const lines = text.split(/\r?\n/)
    const violations: string[] = []
    for (const n of addedLines) {
      const line = lines[n - 1] ?? ""
      const trim = line.trim()
      if (!trim) continue
      if (hasMarker(trim)) continue
      if (!covered.has(n)) violations.push(`line ${n}: ${trim}`)
    }
    return violations
  }

  test("covered line reports no violation", () => {
    const text = ["// cssltdcode_change start", "const cssltd = 1", "// cssltdcode_change end"].join("\n")
    expect(check(text, [2])).toEqual([])
  })

  test("uncovered line reports violation", () => {
    const text = ["const uncovered = 1", "const also_uncovered = 2"].join("\n")
    expect(check(text, [1, 2])).toEqual(["line 1: const uncovered = 1", "line 2: const also_uncovered = 2"])
  })

  test("empty lines are skipped", () => {
    const text = ["const x = 1", "", "  ", "", "const y = 2"].join("\n")
    expect(check(text, [1, 2, 3, 4, 5])).toEqual(["line 1: const x = 1", "line 5: const y = 2"])
  })

  test("marker lines are skipped even if uncovered", () => {
    // This shouldn't normally happen, but the loop should skip it
    const text = ["{/* cssltdcode_change */}", "{/* cssltdcode_change start */}"].join("\n")
    expect(check(text, [1, 2])).toEqual([])
  })

  test("real-world TSX home.tsx pattern", () => {
    const text = [
      '<box width="100%" maxWidth={75}>',
      "  {/* cssltdcode_change start */}",
      "  <Show when={indexingOn()}>",
      "    <text fg={indexingColor()}>{indexingLabel()}</text>",
      "  </Show>",
      "  {/* cssltdcode_change end */}",
      "</box>",
    ].join("\n")
    // Only the first and last lines (opening/closing box) should be uncovered
    expect(check(text, [1, 7])).toEqual([`line 1: <box width="100%" maxWidth={75}>`, `line 7: </box>`])
    // Middle lines are covered
    expect(check(text, [2, 3, 4, 5, 6])).toEqual([])
  })

  test("real-world TSX session index.tsx pattern", () => {
    const text = [
      "const foo = 1",
      "{/* cssltdcode_change start */}",
      '<Match when={props.part.tool === "semantic_search"}>',
      "<SemanticSearch {...toolprops} />",
      "</Match>",
      "{/* cssltdcode_change end */}",
      "const bar = 2",
    ].join("\n")
    // Lines 1 and 7 are uncovered (not in any block)
    expect(check(text, [1, 7])).toEqual(["line 1: const foo = 1", "line 7: const bar = 2"])
    // Lines 2-6 are covered
    expect(check(text, [2, 3, 4, 5, 6])).toEqual([])
  })

  test("real-world TSX sidebar.tsx pattern", () => {
    const text = [
      "<box>",
      "                {/* cssltdcode_change start */}",
      "                <SessionTree />",
      "                {/* cssltdcode_change end */}",
      "</box>",
      "          {/* cssltdcode_change start */}",
      "          <div>other content</div>",
      "          {/* cssltdcode_change end */}",
    ].join("\n")
    expect(check(text, [1, 5])).toEqual(["line 1: <box>", "line 5: </box>"])
    expect(check(text, [2, 3, 4, 6, 7, 8])).toEqual([])
  })

  test("real-world TSX permission.tsx inline pattern", () => {
    const text = [
      "{/* cssltdcode_change */}",
      "<PermissionDeniedCard />",
      "{/* cssltdcode_change */}",
      "<AnotherCssltdComponent />",
    ].join("\n")
    expect(check(text, [2, 4])).toEqual(["line 2: <PermissionDeniedCard />", "line 4: <AnotherCssltdComponent />"])
    expect(check(text, [1, 3])).toEqual([])
  })

  test("JS-style session/index.tsx pattern (from existing codebase)", () => {
    const text = ["const foo = 1", "<Toast />", "{/* cssltdcode_change */}", "<Footer />", "</box>"].join("\n")
    // Line 2 (<Toast />) is NOT covered — it's between <Toast /> and the marker
    expect(check(text, [2, 4])).toEqual(["line 2: <Toast />", "line 4: <Footer />"])
    expect(check(text, [3])).toEqual([])
  })

  test("whole-file annotated file — no violations even for unmarked lines", () => {
    const text = [
      "// cssltdcode_change - new file",
      "export const cssltdFeature = true",
      "export const alsoCssltd = 123",
      "export const notMarked = 'oops'",
    ].join("\n")
    expect(check(text, [2, 3, 4])).toEqual([])
  })
})

// ─── Diff parser (revert detection) ──────────────────────────────────────────
// Mirrors the pure parsing logic in script/check-cssltdcode-annotations.ts:addedLines.
// Given a `git diff --unified=0` output, returns the set of added line numbers
// and a flag indicating whether the diff removes any cssltdcode_change marker
// (i.e. the change is reverting Cssltd modifications back to upstream).

function parseDiff(diff: string): { added: Set<number>; revert: boolean } {
  const added = new Set<number>()
  let revert = false
  const all = diff.split("\n")

  let i = 0
  while (i < all.length) {
    const header = all[i] ?? ""
    const m = header.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)
    if (!m) {
      i++
      continue
    }

    const start = Number(m[1])
    let pos = 0
    let j = i + 1
    while (j < all.length) {
      const hl = all[j] ?? ""
      if (hl.startsWith("@@") || hl.startsWith("diff ")) break
      if (hl.startsWith("+") && !hl.startsWith("+++")) {
        added.add(start + pos)
        pos++
      } else if (hl.startsWith("-") && !hl.startsWith("---") && hasMarker(hl.slice(1))) {
        revert = true
      }
      j++
    }

    i = j
  }

  return { added, revert }
}

describe("parseDiff (revert detection)", () => {
  test("normal addition — no marker removed, not a revert", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "--- a/foo.ts",
      "+++ b/foo.ts",
      "@@ -10,0 +11,2 @@",
      "+const a = 1",
      "+const b = 2",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([11, 12]))
    expect(out.revert).toBe(false)
  })

  test("revert: hunk removes cssltdcode_change marker block and adds upstream original", () => {
    // Mirrors the abort-leak.test.ts case from PR #9908
    const diff = [
      "diff --git a/test.ts b/test.ts",
      "--- a/test.ts",
      "+++ b/test.ts",
      "@@ -16,3 +16 @@ describe(...)",
      "-  // cssltdcode_change start - TODO: skip flaky test",
      "-  test.skip('foo', async () => {",
      "-    // cssltdcode_change end",
      "+  test('foo', async () => {",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([16]))
    expect(out.revert).toBe(true)
  })

  test("revert: inline marker removed, upstream original added", () => {
    const diff = [
      "diff --git a/test.ts b/test.ts",
      "@@ -5 +5 @@",
      "-const url = Flag.X || 'fallback' // cssltdcode_change",
      "+const url = Flag.X",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([5]))
    expect(out.revert).toBe(true)
  })

  test("file-level revert: marker removed in one hunk covers other hunks", () => {
    // Mirrors the prompt.test.ts case from PR #9908: cssltdcode_change marker
    // is removed in hunk A, while a separate hunk B replaces references that
    // depended on the removed Cssltd construct.
    const diff = [
      "diff --git a/test.ts b/test.ts",
      "@@ -218 +217,0 @@",
      "-const unixSkip = it.live.skip // cssltdcode_change - skip flaky tests",
      "@@ -1589 +1583 @@ unixSkip(",
      "-unixSkip(",
      "+unix(",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([1583]))
    expect(out.revert).toBe(true)
  })

  test("multiple cssltdcode_change start/end markers removed across hunks", () => {
    const diff = [
      "diff --git a/test.ts b/test.ts",
      "@@ -1432,2 +1431 @@",
      "-// cssltdcode_change start - flaky on Linux CI",
      "-unixSkip(",
      "+unix(",
      "@@ -1469 +1466,0 @@",
      "-// cssltdcode_change end",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([1431]))
    expect(out.revert).toBe(true)
  })

  test("YAML/shell marker removal also triggers revert", () => {
    const diff = [
      "diff --git a/foo.yml b/foo.yml",
      "@@ -10 +10 @@",
      "-      - uses: actions/checkout@v6 # cssltdcode_change",
      "+      - uses: actions/checkout@v4",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([10]))
    expect(out.revert).toBe(true)
  })

  test("JSX marker removal triggers revert", () => {
    const diff = [
      "diff --git a/foo.tsx b/foo.tsx",
      "@@ -5,3 +5 @@",
      "-{/* cssltdcode_change start */}",
      "-<CssltdThing />",
      "-{/* cssltdcode_change end */}",
      "+<UpstreamThing />",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([5]))
    expect(out.revert).toBe(true)
  })

  test("multi-line addition with no marker removed is not a revert", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "@@ -10,0 +11,3 @@",
      "+const a = 1",
      "+const b = 2",
      "+const c = 3",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added).toEqual(new Set([11, 12, 13]))
    expect(out.revert).toBe(false)
  })

  test("removal-only hunk (no additions) still flips revert flag", () => {
    const diff = [
      "diff --git a/foo.ts b/foo.ts",
      "@@ -1,1 +0,0 @@",
      "-// cssltdcode_change start",
      "@@ -5,1 +0,0 @@",
      "-// cssltdcode_change end",
    ].join("\n")
    const out = parseDiff(diff)
    expect(out.added.size).toBe(0)
    expect(out.revert).toBe(true)
  })

  test("empty diff", () => {
    const out = parseDiff("")
    expect(out.added.size).toBe(0)
    expect(out.revert).toBe(false)
  })

  test("diff header lines are ignored", () => {
    const diff = ["diff --git a/foo.ts b/foo.ts", "--- a/foo.ts", "+++ b/foo.ts"].join("\n")
    const out = parseDiff(diff)
    expect(out.added.size).toBe(0)
    expect(out.revert).toBe(false)
  })
})

// ─── Regex edge cases ─────────────────────────────────────────────────────────

describe("MARKER_PREFIX regex edge cases", () => {
  test("handles { followed immediately by /*", () => {
    expect(hasMarker("{/* cssltdcode_change */}")).toBe(true)
  })

  test("handles { followed by whitespace then /*", () => {
    expect(hasMarker("{ /* cssltdcode_change */}")).toBe(true)
  })

  test("handles just /* with no brace", () => {
    expect(hasMarker("/* cssltdcode_change */")).toBe(true)
  })

  test("handles // with no spaces", () => {
    expect(hasMarker("//cssltdcode_change")).toBe(true)
  })

  test("handles // with lots of spaces", () => {
    expect(hasMarker("//    cssltdcode_change")).toBe(true)
  })

  test("handles # with lots of spaces", () => {
    expect(hasMarker("#    cssltdcode_change")).toBe(true)
  })

  test("does not match {/* without cssltdcode_change", () => {
    expect(hasMarker("{/* some other comment */}")).toBe(false)
  })

  test("does not match /* without cssltdcode_change", () => {
    expect(hasMarker("/* just a comment */")).toBe(false)
  })

  test("does not match cssltdcode_changes (word boundary)", () => {
    expect(hasMarker("// cssltdcode_changes")).toBe(false)
    expect(hasMarker("// cssltdcode_changelog")).toBe(false)
    expect(hasMarker("{/* cssltdcode_changes */}")).toBe(false)
    expect(hasMarker("// cssltdcode_changeable")).toBe(false)
  })
})

// ─── isExempt — Windows paths ─────────────────────────────────────────────────

describe("isExempt — Windows backslash paths", () => {
  test("Windows paths with backslashes", () => {
    expect(isExempt("packages\\cssltdcode\\src\\cssltdcode\\foo.ts")).toBe(true)
    expect(isExempt("packages\\cssltdcode\\test\\cssltdcode\\bar.test.ts")).toBe(true)
    expect(isExempt("packages\\cssltdcode\\src\\index.ts")).toBe(false)
  })
})

// ─── coveredLines — additional patterns ───────────────────────────────────────

describe("coveredLines — additional patterns", () => {
  test("block with descriptive suffix is still recognized", () => {
    const text = [
      "{/* cssltdcode_change start - Cssltd-specific indexing display */}",
      "<IndexingStatus />",
      "{/* cssltdcode_change end */}",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("empty file content", () => {
    const covered = coveredLines("// cssltdcode_change start\n  \n// cssltdcode_change end")
    expect(covered).toEqual(new Set([1, 2, 3]))
  })

  test("multiple separate JS inline markers", () => {
    const text = [
      "const a = 1 // cssltdcode_change",
      "const b = 2",
      "const c = 3 // cssltdcode_change",
      "const d = 4",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 3]))
  })

  test("consecutive block markers (no content)", () => {
    const text = ["// cssltdcode_change start", "// cssltdcode_change end"].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2]))
  })

  test("block immediately followed by another start", () => {
    const text = [
      "// cssltdcode_change start",
      "const a = 1",
      "// cssltdcode_change end",
      "{/* cssltdcode_change start */}",
      "const b = 2",
      "{/* cssltdcode_change end */}",
    ].join("\n")
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([1, 2, 3, 4, 5, 6]))
  })

  test("trailing empty line after block end is not covered", () => {
    const text = "// cssltdcode_change start\nconst a = 1\n// cssltdcode_change end\n\n"
    const covered = coveredLines(text)
    // Block ends at line 3; trailing empty line 4 is outside the block
    expect(covered).toEqual(new Set([1, 2, 3]))
  })
})

// ─── checkLine — additional patterns ─────────────────────────────────────────

describe("checkLine — additional patterns", () => {
  function check(text: string, addedLines: number[]): string[] {
    const covered = coveredLines(text)
    const lines = text.split(/\r?\n/)
    const violations: string[] = []
    for (const n of addedLines) {
      const line = lines[n - 1] ?? ""
      const trim = line.trim()
      if (!trim) continue
      if (hasMarker(trim)) continue
      if (!covered.has(n)) violations.push(`line ${n}: ${trim}`)
    }
    return violations
  }

  test("real-world dialog-status.tsx pattern — multiple inline blocks", () => {
    // Based on actual file: packages/cssltdcode/src/cli/cmd/tui/component/dialog-status.tsx
    const text = [
      "{/* cssltdcode_change start */}",
      "<CssltdDialog>",
      "{/* cssltdcode_change end */}",
      "const normal = 1",
      "  {/* cssltdcode_change start */}",
      "  <CssltdDialog />",
      "  {/* cssltdcode_change end */}",
    ].join("\n")
    // Lines 4 is uncovered
    expect(check(text, [4])).toEqual(["line 4: const normal = 1"])
    // Lines 1-3 and 5-7 are covered
    expect(check(text, [1, 2, 3, 5, 6, 7])).toEqual([])
  })

  test("real-world TUI routes — line between marker and code should be uncovered", () => {
    // A common mistake: putting code on a different line from the marker
    const text = ["{/* cssltdcode_change start */}", "", "<CssltdIndexing />", "", "{/* cssltdcode_change end */}"].join("\n")
    // Empty lines (2, 4) are skipped
    expect(check(text, [3])).toEqual([])
    // All non-empty lines (1, 3, 5) are covered
    expect(check(text, [1, 3, 5])).toEqual([])
  })

  test("end marker on same line as content is covered", () => {
    const text = "const a = 1\n{/* cssltdcode_change end */} // block already closed, still covered\n"
    const covered = coveredLines(text)
    expect(covered).toEqual(new Set([2]))
  })

  test("end marker closes block correctly", () => {
    const text = [
      "// cssltdcode_change start",
      "const a = 1",
      "// cssltdcode_change end",
      "const b = 2", // uncovered
    ].join("\n")
    expect(check(text, [1, 2, 3, 4])).toEqual(["line 4: const b = 2"])
  })
})
