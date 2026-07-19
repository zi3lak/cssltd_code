import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { Flag } from "@cssltdcode/core/flag/flag"
import * as Log from "@cssltdcode/core/util/log"
import { Server } from "../../../src/server/server"
import { resetDatabase } from "../../fixture/db"
import { disposeAllInstances, tmpdir } from "../../fixture/fixture"

void Log.init({ print: false })

type Source = {
  order: number
  kind: string
  scope: string
  label: string
  source: string
  path?: string
  exists: boolean
  editable: boolean
  reason?: string
}

type Body = {
  sources: Source[]
}

const env = {
  CSSLTD_CONFIG: process.env.CSSLTD_CONFIG,
  CSSLTD_CONFIG_CONTENT: process.env.CSSLTD_CONFIG_CONTENT,
  CSSLTD_CONFIG_DIR: process.env.CSSLTD_CONFIG_DIR,
  CSSLTD_DISABLE_PROJECT_CONFIG: process.env.CSSLTD_DISABLE_PROJECT_CONFIG,
  CSSLTD_TEST_MANAGED_CONFIG_DIR: process.env.CSSLTD_TEST_MANAGED_CONFIG_DIR,
  flagConfig: Flag.CSSLTD_CONFIG,
}

afterEach(async () => {
  restore()
  await disposeAllInstances()
  await resetDatabase()
})

function restore() {
  set("CSSLTD_CONFIG", env.CSSLTD_CONFIG)
  set("CSSLTD_CONFIG_CONTENT", env.CSSLTD_CONFIG_CONTENT)
  set("CSSLTD_CONFIG_DIR", env.CSSLTD_CONFIG_DIR)
  set("CSSLTD_DISABLE_PROJECT_CONFIG", env.CSSLTD_DISABLE_PROJECT_CONFIG)
  set("CSSLTD_TEST_MANAGED_CONFIG_DIR", env.CSSLTD_TEST_MANAGED_CONFIG_DIR)
  Flag.CSSLTD_CONFIG = env.flagConfig
}

function set(key: keyof typeof process.env, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key]
    return
  }
  process.env[key] = value
}

async function sources(dir: string) {
  const response = await Server.Default().app.request("/config/sources", {
    headers: { "x-cssltd-directory": dir },
  })
  expect(response.status).toBe(200)
  return (await response.json()) as Body
}

function order(body: Body, file: string) {
  const hit = body.sources.find((source) => source.path === file)
  expect(hit).toBeDefined()
  return hit!.order
}

describe("config source routes", () => {
  test("lists source metadata in load order without config contents", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "env.json"), "{}")
        await Bun.write(path.join(dir, "cssltd.json"), "{}")

        for (const root of [".cssltdcode", ".cssltdcode", ".cssltd"]) {
          const local = path.join(dir, root)
          await fs.mkdir(local, { recursive: true })
          await Bun.write(path.join(local, "cssltd.jsonc"), "{}")
        }

        const extra = path.join(dir, "extra")
        await fs.mkdir(extra, { recursive: true })
        await Bun.write(path.join(extra, "cssltdcode.json"), "{}")

        const managed = path.join(dir, "managed")
        await fs.mkdir(managed, { recursive: true })
        await Bun.write(path.join(managed, "cssltd.json"), "{}")
      },
    })

    const envFile = path.join(tmp.path, "env.json")
    const projectFile = path.join(tmp.path, "cssltd.json")
    const cssltdcodeFile = path.join(tmp.path, ".cssltdcode", "cssltd.jsonc")
    const configFile = path.join(tmp.path, ".cssltd", "cssltd.jsonc")
    const extraFile = path.join(tmp.path, "extra", "cssltdcode.json")
    const managedFile = path.join(tmp.path, "managed", "cssltd.json")

    process.env.CSSLTD_CONFIG = envFile
    Flag.CSSLTD_CONFIG = envFile
    process.env.CSSLTD_CONFIG_CONTENT = '{"username":"secret-inline-value"}'
    process.env.CSSLTD_CONFIG_DIR = path.join(tmp.path, "extra")
    process.env.CSSLTD_TEST_MANAGED_CONFIG_DIR = path.join(tmp.path, "managed")

    const body = await sources(tmp.path)
    const inline = body.sources.find((source) => source.source === "CSSLTD_CONFIG_CONTENT")

    expect(order(body, envFile)).toBeLessThan(order(body, projectFile))
    expect(order(body, projectFile)).toBeLessThan(order(body, cssltdcodeFile))
    expect(order(body, cssltdcodeFile)).toBeLessThan(order(body, configFile))
    expect(body.sources.some((source) => source.path === cssltdcodeFile)).toBe(true)
    expect(order(body, configFile)).toBeLessThan(order(body, extraFile))
    expect(inline?.order).toBeGreaterThan(order(body, extraFile))
    expect(inline?.order).toBeLessThan(order(body, managedFile))

    expect(body.sources.find((source) => source.path === configFile)).toMatchObject({
      kind: "config-dir-file",
      scope: "project",
      exists: true,
      editable: true,
    })
    expect(body.sources.find((source) => source.path === managedFile)).toMatchObject({
      kind: "managed-file",
      scope: "managed",
      exists: true,
      editable: false,
    })
    expect(JSON.stringify(body)).not.toContain("secret-inline-value")
  })

  test("shows project config disabled by environment", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Bun.write(path.join(dir, "cssltd.json"), "{}")
        await fs.mkdir(path.join(dir, ".cssltd"), { recursive: true })
        await Bun.write(path.join(dir, ".cssltd", "cssltd.json"), "{}")
      },
    })

    process.env.CSSLTD_DISABLE_PROJECT_CONFIG = "1"

    const body = await sources(tmp.path)

    expect(body.sources.some((source) => source.path === path.join(tmp.path, "cssltd.json"))).toBe(false)
    expect(body.sources.some((source) => source.path === path.join(tmp.path, ".cssltd", "cssltd.json"))).toBe(false)
    expect(body.sources.find((source) => source.source === "CSSLTD_DISABLE_PROJECT_CONFIG")).toMatchObject({
      kind: "runtime-env",
      scope: "env",
      exists: true,
      editable: false,
    })
  })
})
