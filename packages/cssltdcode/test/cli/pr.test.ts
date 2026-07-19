// cssltdcode_change - new file
import { expect, test } from "bun:test"
import { cliCommand } from "../../src/cli/cmd/pr"

test("cliCommand uses the current script when argv[1] is a file path", () => {
  const result = cliCommand({
    execPath: "/usr/bin/node",
    argv: ["/usr/bin/node", "/tmp/cssltd.js", "pr", "1"],
    exists: (file) => file === "/tmp/cssltd.js",
  })

  expect(result).toEqual(["/usr/bin/node", "/tmp/cssltd.js"])
})

test("cliCommand falls back to execPath when argv[1] is a subcommand", () => {
  const result = cliCommand({
    execPath: "/usr/local/bin/cssltd",
    argv: ["/usr/local/bin/cssltd", "pr", "1"],
    exists: () => false,
  })

  expect(result).toEqual(["/usr/local/bin/cssltd"])
})

test("cliCommand ignores subcommand token even when it exists on disk", () => {
  const result = cliCommand({
    execPath: "/usr/local/bin/cssltd",
    argv: ["/usr/local/bin/cssltd", "pr", "1"],
    exists: (file) => file === "pr",
  })

  expect(result).toEqual(["/usr/local/bin/cssltd"])
})

test("cliCommand falls back to execPath when argv[1] is missing", () => {
  const result = cliCommand({
    execPath: "/usr/local/bin/cssltd",
    argv: ["/usr/local/bin/cssltd"],
    exists: () => false,
  })

  expect(result).toEqual(["/usr/local/bin/cssltd"])
})

test("cliCommand falls back to execPath for bun virtual script paths", () => {
  const unix = cliCommand({
    execPath: "/tmp/cssltd",
    argv: ["/tmp/cssltd", "/$bunfs/root/src/index.js", "pr", "1"],
    exists: () => true,
  })

  const win = cliCommand({
    execPath: "C:/tmp/cssltd.exe",
    argv: ["C:/tmp/cssltd.exe", "B:/~BUN/root/src/index.js", "pr", "1"],
    exists: () => true,
  })

  expect(unix).toEqual(["/tmp/cssltd"])
  expect(win).toEqual(["C:/tmp/cssltd.exe"])
})
