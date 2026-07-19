import { afterEach, describe, expect, test } from "bun:test"
import { Option, Redacted } from "effect"
import { Flag } from "@cssltdcode/core/flag/flag"
import { ServerAuth } from "../../src/server/auth"

const original = {
  CSSLTD_SERVER_PASSWORD: Flag.CSSLTD_SERVER_PASSWORD,
  CSSLTD_SERVER_USERNAME: Flag.CSSLTD_SERVER_USERNAME,
}

afterEach(() => {
  Flag.CSSLTD_SERVER_PASSWORD = original.CSSLTD_SERVER_PASSWORD
  Flag.CSSLTD_SERVER_USERNAME = original.CSSLTD_SERVER_USERNAME
})

describe("ServerAuth", () => {
  test("does not emit auth headers without a password", () => {
    Flag.CSSLTD_SERVER_PASSWORD = undefined
    Flag.CSSLTD_SERVER_USERNAME = "alice"

    expect(ServerAuth.header()).toBeUndefined()
    expect(ServerAuth.headers()).toBeUndefined()
  })

  test("defaults to the cssltd username", () => {
    // cssltdcode_change
    Flag.CSSLTD_SERVER_PASSWORD = "secret"
    Flag.CSSLTD_SERVER_USERNAME = undefined

    expect(ServerAuth.headers()).toEqual({
      Authorization: `Basic ${Buffer.from("cssltd:secret").toString("base64")}`, // cssltdcode_change
    })
  })

  test("uses the configured username", () => {
    Flag.CSSLTD_SERVER_PASSWORD = "secret"
    Flag.CSSLTD_SERVER_USERNAME = "alice"

    expect(ServerAuth.headers()).toEqual({
      Authorization: `Basic ${Buffer.from("alice:secret").toString("base64")}`,
    })
  })

  test("prefers explicit credentials", () => {
    Flag.CSSLTD_SERVER_PASSWORD = "secret"
    Flag.CSSLTD_SERVER_USERNAME = "alice"

    expect(ServerAuth.headers({ password: "cli-secret", username: "bob" })).toEqual({
      Authorization: `Basic ${Buffer.from("bob:cli-secret").toString("base64")}`,
    })
  })

  test("validates decoded credentials against effect config", () => {
    const config = { password: Option.some("secret"), username: "alice" }

    expect(ServerAuth.required(config)).toBe(true)
    expect(ServerAuth.authorized({ username: "alice", password: Redacted.make("secret") }, config)).toBe(true)
    expect(ServerAuth.authorized({ username: "cssltd", password: Redacted.make("secret") }, config)).toBe(false) // cssltdcode_change
  })
})
