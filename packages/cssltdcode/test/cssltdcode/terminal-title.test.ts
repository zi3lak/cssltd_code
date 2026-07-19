import { describe, expect, test } from "bun:test"
import { CssltdTerminalTitle } from "../../src/cssltdcode/cli/cmd/tui/terminal-title"

const base = "Cssltd CLI"

function data(input: Partial<CssltdTerminalTitle.Data> = {}): CssltdTerminalTitle.Data {
  return {
    session: [{ id: "parent", title: "Build status" }],
    session_status: {},
    permission: {},
    question: {},
    suggestion: {},
    network: {},
    message: {},
    part: {},
    ...input,
  }
}

describe("CssltdTerminalTitle", () => {
  test("format_noneStyle_hidesStatusIcon", () => {
    expect(CssltdTerminalTitle.format({ base, title: "Build status", indicator: "working" })).toBe(
      "Cssltd CLI | Build status",
    )
  })

  test("format_noIndicator_returnsBaseTitle", () => {
    expect(CssltdTerminalTitle.format({ base, indicator: "none", icon: "unicode" })).toBe("Cssltd CLI")
  })

  test("format_unicodeStyle_usesUnicodeIcons", () => {
    expect(CssltdTerminalTitle.format({ base, indicator: "working", icon: "unicode" })).toBe("◔ Cssltd CLI")
    expect(CssltdTerminalTitle.format({ base, indicator: "attention", icon: "unicode" })).toBe("⚠ Cssltd CLI")
    expect(CssltdTerminalTitle.format({ base, indicator: "finished", icon: "unicode" })).toBe("✓ Cssltd CLI")
  })

  test("format_emojiStyle_usesEmojiIcons", () => {
    expect(CssltdTerminalTitle.format({ base, indicator: "working", icon: "emojis" })).toBe("💭 Cssltd CLI")
    expect(CssltdTerminalTitle.format({ base, indicator: "attention", icon: "emojis" })).toBe("🔶 Cssltd CLI")
    expect(CssltdTerminalTitle.format({ base, indicator: "finished", icon: "emojis" })).toBe("✅ Cssltd CLI")
  })

  test("format_longSessionTitle_truncatesToExistingLimit", () => {
    expect(
      CssltdTerminalTitle.format({
        base,
        title: "12345678901234567890123456789012345678901234567890",
        indicator: "working",
        icon: "unicode",
      }),
    ).toBe("◔ Cssltd CLI | 1234567890123456789012345678901234567...")
  })

  test("session_newIdleSession_hasNoIndicator", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data(),
        done: {},
      }),
    ).toEqual({ title: "Cssltd CLI | Build status", id: "parent", active: false, indicator: "none" })
  })

  test("session_busySession_isWorking", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data({ session_status: { parent: { type: "busy" } } }),
        done: {},
        icon: "unicode",
      }),
    ).toEqual({ title: "◔ Cssltd CLI | Build status", id: "parent", active: true, indicator: "working" })
  })

  test("session_pendingPermission_overridesBusy", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data({
          session_status: { parent: { type: "busy" } },
          permission: { parent: [{}] },
        }),
        done: {},
      }).indicator,
    ).toBe("attention")
  })

  test("session_childQuestion_marksParentAttention", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data({
          session: [
            { id: "parent", title: "Build status" },
            { id: "child", title: "Child", parentID: "parent" },
          ],
          question: { child: [{ blocking: true }] },
        }),
        done: {},
      }).indicator,
    ).toBe("attention")
  })

  test("session_latestAssistantPlanExit_marksAttention", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data({
          message: { parent: [{ id: "m1", role: "assistant" }] },
          part: {
            m1: [{ type: "tool", tool: "plan_exit", state: { status: "completed" } }],
          },
        }),
        done: {},
      }).indicator,
    ).toBe("attention")
  })

  test("session_latestUserAfterPlanExit_clearsPlanExitAttention", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data({
          message: {
            parent: [
              { id: "m1", role: "assistant" },
              { id: "m2", role: "user" },
            ],
          },
          part: {
            m1: [{ type: "tool", tool: "plan_exit", state: { status: "completed" } }],
          },
        }),
        done: {},
      }).indicator,
    ).toBe("none")
  })

  test("session_doneIdleSession_isFinished", () => {
    expect(
      CssltdTerminalTitle.session({
        base,
        id: "parent",
        data: data(),
        done: { parent: true },
      }).indicator,
    ).toBe("finished")
  })
})
