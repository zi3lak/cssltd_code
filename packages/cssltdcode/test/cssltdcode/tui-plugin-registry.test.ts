import { expect, test } from "bun:test"
import { internalTuiPlugins } from "@/plugin/tui/internal"

const cssltd = [
  "internal:home-news",
  "internal:home-onboarding",
  "internal:cssltd-attention",
  "internal:cssltd-home-footer",
  "internal:cssltd-permissions",
  "internal:cssltd-sidebar-footer",
  "internal:cssltd-sidebar-memory",
  "internal:cssltd-memory-palette",
  "internal:cssltd-sidebar-background-processes",
  "internal:cssltd-sidebar-indexing",
  "internal:cssltd-sidebar-pr",
  "internal:cssltd-sidebar-usage",
  "internal:sandbox",
  "internal:remote",
  "internal:reload",
]

test("internal TUI registry preserves every Cssltd plugin before upstream builtins", () => {
  const ids = internalTuiPlugins({ experimentalEventSystem: false, experimentalSessionSwitcher: false }).map(
    (plugin) => plugin.id,
  )

  expect(ids.slice(0, cssltd.length)).toEqual(cssltd)
  expect(new Set(ids).size).toBe(ids.length)
  expect(ids).toContain("internal:sidebar-context")
  expect(ids).toContain("diff-viewer")
})

test("experimental Cssltd TUI plugins remain wired", () => {
  const ids = internalTuiPlugins({ experimentalEventSystem: true, experimentalSessionSwitcher: true }).map(
    (plugin) => plugin.id,
  )

  expect(ids).toContain("internal:session-v2-debug")
  expect(ids).toContain("internal:session-switcher")
})
