// cssltdcode_change - new file
import { describe, expect, test } from "bun:test"
import { CssltdRunAuto } from "../../src/cssltdcode/cli/run-auto"

describe("CssltdRunAuto", () => {
  test("tracks task child sessions without allowing unrelated sessions", () => {
    const state = CssltdRunAuto.create("ses_root")

    expect(CssltdRunAuto.allowed(state, "ses_root")).toBe(true)
    expect(CssltdRunAuto.allowed(state, "ses_child")).toBe(false)

    CssltdRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_root",
      state: {
        metadata: {
          sessionId: "ses_child",
        },
      },
    })

    expect(CssltdRunAuto.allowed(state, "ses_child")).toBe(true)
    expect(CssltdRunAuto.allowed(state, "ses_other")).toBe(false)
  })

  test("ignores malformed or non-root task metadata", () => {
    const state = CssltdRunAuto.create("ses_root")

    CssltdRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_root",
      state: {
        metadata: {
          sessionId: "",
        },
      },
    })
    CssltdRunAuto.track(state, {
      type: "tool",
      tool: "task",
      sessionID: "ses_other",
      state: {
        metadata: {
          sessionId: "ses_wrong",
        },
      },
    })
    CssltdRunAuto.track(state, {
      type: "text",
      sessionID: "ses_root",
      state: {},
    })

    expect(CssltdRunAuto.allowed(state, "ses_wrong")).toBe(false)
    expect(CssltdRunAuto.allowed(state, "")).toBe(false)
  })
})
