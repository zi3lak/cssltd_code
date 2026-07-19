import { describe, expect } from "bun:test"
import { Effect } from "effect"
import path from "path"
import { mkdir } from "node:fs/promises" // cssltdcode_change
import { cliIt } from "../lib/cli-process"

describe("cssltdcode mcp add (non-interactive subprocess)", () => {
  cliIt.concurrent(
    "adds a remote server with HTTP headers",
    ({ home, cssltdcode }) =>
      Effect.gen(function* () {
        const result = yield* cssltdcode.spawn([
          "mcp",
          "add",
          "github",
          "--url",
          "https://example.com/mcp",
          "--header",
          "Authorization=Bearer {env:GITHUB_TOKEN}",
          "--header",
          "X-Option=one=two",
        ])
        cssltdcode.expectExit(result, 0)

        const config = yield* Effect.promise(() =>
          Bun.file(path.join(home, ".config", "cssltd", "cssltd.json")).json(), // cssltdcode_change
        )
        expect(config.mcp.github).toEqual({
          type: "remote",
          url: "https://example.com/mcp",
          headers: {
            Authorization: "Bearer {env:GITHUB_TOKEN}",
            "X-Option": "one=two",
          },
        })
      }),
    60_000,
  )

  cliIt.concurrent(
    "adds a local server while preserving argv and environment values",
    ({ home, cssltdcode }) =>
      Effect.gen(function* () {
        const result = yield* cssltdcode.spawn([
          "mcp",
          "add",
          "local",
          "--env",
          "API_KEY=secret",
          "--env",
          "VALUE=one=two",
          "--",
          "npx",
          "-y",
          "@example/server",
          "--label",
          "two words",
        ])
        cssltdcode.expectExit(result, 0)

        const config = yield* Effect.promise(() =>
          Bun.file(path.join(home, ".config", "cssltd", "cssltd.json")).json(), // cssltdcode_change
        )
        expect(config.mcp.local).toEqual({
          type: "local",
          command: ["npx", "-y", "@example/server", "--label", "two words"],
          environment: {
            API_KEY: "secret",
            VALUE: "one=two",
          },
        })
      }),
    60_000,
  )

  // cssltdcode_change start
  cliIt.concurrent(
    "writes to CSSLTD_CONFIG_DIR without touching the default profile",
    ({ home, cssltdcode }) =>
      Effect.gen(function* () {
        const profile = path.join(home, "profile")
        yield* Effect.promise(() => mkdir(profile, { recursive: true }))
        const result = yield* cssltdcode.spawn(
          ["mcp", "add", "profile", "--url", "https://example.com/profile"],
          { env: { CSSLTD_CONFIG_DIR: profile } },
        )
        cssltdcode.expectExit(result, 0)

        const config = yield* Effect.promise(() => Bun.file(path.join(profile, "cssltd.json")).json())
        expect(config.mcp.profile).toEqual({ type: "remote", url: "https://example.com/profile" })
        expect(yield* Effect.promise(() => Bun.file(path.join(home, ".config", "cssltd", "cssltd.json")).exists())).toBe(
          false,
        )
      }),
    60_000,
  )
        // cssltdcode_change end
})
