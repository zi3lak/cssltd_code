import { describe, expect, test } from "bun:test"
import { CssltdPtySelfCommand } from "../../src/cssltdcode/pty/self-command"

describe("pty self-command", () => {
  test("does not forward bundled bun entrypoints", () => {
    const proc = {
      argv: ["/tmp/cssltd", "/$bunfs/root/src/index.js"],
      execArgv: ["--user-agent=cssltd/test", "--use-system-ca", "--"],
      execPath: "/tmp/cssltd",
      cwd: "/tmp",
    }

    const cmd = CssltdPtySelfCommand.command(proc)
    expect(cmd).toStrictEqual({ command: "/tmp/cssltd", args: [] })
    expect(CssltdPtySelfCommand.resolve({ command: "cssltd", cwd: "/tmp/project" }, cmd)).toStrictEqual({
      command: "/tmp/cssltd",
      args: [],
      cwd: "/tmp/project",
    })
    expect(
      CssltdPtySelfCommand.command({
        ...proc,
        argv: ["C:/tmp/cssltd.exe", "B:/~BUN/root/src/index.js"],
      }).args,
    ).toStrictEqual([])
    expect(
      CssltdPtySelfCommand.command({
        ...proc,
        argv: ["C:/tmp/cssltd.exe", "b:\\~BUN\\root\\src\\index.js"],
      }).args,
    ).toStrictEqual([])
  })

  test("forwards source entrypoints", () => {
    const cmd = CssltdPtySelfCommand.command({
      argv: ["/tmp/bun", "/tmp/cssltd/src/index.ts"],
      execArgv: ["--conditions=browser", "--cwd", "packages/cssltdcode"],
      execPath: "/tmp/bun",
      cwd: "/tmp/cssltd",
    })
    expect(cmd).toStrictEqual({
      command: "/tmp/bun",
      args: ["--conditions=browser", "/tmp/cssltd/src/index.ts"],
      cwd: "/tmp/cssltd",
    })
    expect(CssltdPtySelfCommand.resolve({ command: "cssltd", cwd: "/tmp/project" }, cmd)).toStrictEqual({
      command: "/tmp/bun",
      args: ["--conditions=browser", "/tmp/cssltd/src/index.ts", "/tmp/project"],
      cwd: "/tmp/cssltd",
    })
  })
})
