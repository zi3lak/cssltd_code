// cssltdcode_change - new file

import { expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Effect, Layer, Option } from "effect"
import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { FSUtil } from "@cssltdcode/core/fs-util"
import { EffectFlock } from "@cssltdcode/core/util/effect-flock"
import { Config } from "../../src/config/config"
import { Auth } from "../../src/auth"
import { Account } from "../../src/account/account"
import { Env } from "../../src/env"
import { Git } from "../../src/git"
import { Npm } from "@cssltdcode/core/npm"
import { provideTestInstance } from "../fixture/fixture"
import { Filesystem } from "../../src/util/filesystem"
import { CrossSpawnSpawner } from "@cssltdcode/core/cross-spawn-spawner"
import { HttpClient } from "effect/unstable/http"
import { tmpdir } from "../fixture/fixture"

const infra = CrossSpawnSpawner.defaultLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)),
)

const emptyAccount = Layer.mock(Account.Service)({
  active: () => Effect.succeed(Option.none()),
  activeOrg: () => Effect.succeed(Option.none()),
})

const emptyAuth = Layer.mock(Auth.Service)({
  all: () => Effect.succeed({}),
})

const noopNpm = Layer.mock(Npm.Service)({
  install: () => Effect.void,
  add: () => Effect.die("not implemented"),
  which: () => Effect.succeed(Option.none()),
})

const unexpectedHttp = HttpClient.make((request) =>
  Effect.die(`unexpected http request: ${request.method} ${request.url}`),
)

const layer = Config.layer.pipe(
  Layer.provide(Git.defaultLayer),
  Layer.provide(EffectFlock.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Env.defaultLayer),
  Layer.provide(emptyAuth),
  Layer.provide(emptyAccount),
  Layer.provideMerge(infra),
  Layer.provide(noopNpm),
  Layer.provide(Layer.succeed(HttpClient.HttpClient, unexpectedHttp)),
)

const load = () => Effect.runPromise(Config.Service.use((svc) => svc.get()).pipe(Effect.scoped, Effect.provide(layer)))
const save = (config: Config.Info) =>
  Effect.runPromise(Config.Service.use((svc) => svc.update(config)).pipe(Effect.scoped, Effect.provide(layer)))

async function writeConfig(dir: string, config: unknown) {
  await Filesystem.write(path.join(dir, "cssltd.json"), JSON.stringify(config, null, 2))
}

test("project config update creates .cssltd/cssltd.jsonc and reloads it", async () => {
  await using tmp = await tmpdir()
  await provideTestInstance({
    directory: tmp.path,
    fn: async () => {
      await save({ model: "updated/model" } as any)

      const written = await Filesystem.readJson<{ model: string }>(path.join(tmp.path, ".cssltd", "cssltd.jsonc"))
      expect(written.model).toBe("updated/model")

      const loaded = await load()
      expect(loaded.model).toBe("updated/model")
    },
  })
})

test("project config update skips empty delete-only writes when no config exists", async () => {
  await using tmp = await tmpdir()
  await provideTestInstance({
    directory: tmp.path,
    fn: async () => {
      await save({ provider: { missing: null } } as any)

      await expect(fs.access(path.join(tmp.path, ".cssltd", "cssltd.jsonc"))).rejects.toThrow()
    },
  })
})

test("project config update prefers existing root cssltd.json", async () => {
  await using tmp = await tmpdir()
  await writeConfig(tmp.path, { username: "alice" })

  await provideTestInstance({
    directory: tmp.path,
    fn: async () => {
      await save({ model: "updated/model" } as any)

      const merged = await Filesystem.readJson<{ model: string; username: string }>(path.join(tmp.path, "cssltd.json"))
      expect(merged.model).toBe("updated/model")
      expect(merged.username).toBe("alice")
    },
  })
})

test("project config update patches ancestor .cssltd/cssltd.json from nested directory", async () => {
  await using tmp = await tmpdir()
  const child = path.join(tmp.path, "nested", "workspace")
  await fs.mkdir(child, { recursive: true })
  await fs.mkdir(path.join(tmp.path, ".cssltd"), { recursive: true })
  await writeConfig(path.join(tmp.path, ".cssltd"), { username: "alice" })

  await provideTestInstance({
    directory: child,
    fn: async () => {
      await save({ model: "updated/model" } as any)

      const merged = await Filesystem.readJson<{ model: string; username: string }>(
        path.join(tmp.path, ".cssltd", "cssltd.json"),
      )
      expect(merged.model).toBe("updated/model")
      expect(merged.username).toBe("alice")
      await expect(fs.access(path.join(child, ".cssltd", "cssltd.json"))).rejects.toThrow()
    },
  })
})
