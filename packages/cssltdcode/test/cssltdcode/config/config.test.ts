import { $ } from "bun"
import { afterEach, describe, expect, test } from "bun:test"
import { Effect, Layer, Option, Schema } from "effect"
import { NodeFileSystem, NodePath } from "@effect/platform-node"
import path from "path"
import { Global } from "@cssltdcode/core/global"
import { FSUtil } from "@cssltdcode/core/fs-util"
import { EffectFlock } from "@cssltdcode/core/util/effect-flock"
import * as CrossSpawnSpawner from "@cssltdcode/core/cross-spawn-spawner"
import { Npm } from "@cssltdcode/core/npm"
import { HttpClient } from "effect/unstable/http"
import { Account } from "../../../src/account/account"
import { Auth } from "../../../src/auth"
import { Config } from "../../../src/config/config"
import { ConfigMarkdown } from "../../../src/config/markdown"
import { ConfigParse } from "../../../src/config/parse"
import { Env } from "../../../src/env"
import { Git } from "../../../src/git"
import { CssltdIndexing } from "../../../src/cssltdcode/indexing"
import { CssltdcodeConfig } from "../../../src/cssltdcode/config/config"
import { provideTestInstance } from "../../fixture/fixture"
import { Filesystem } from "../../../src/util/filesystem"
import { disposeAllInstances, tmpdir } from "../../fixture/fixture"

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
const clear = () =>
  Effect.runPromise(Config.Service.use((svc) => svc.invalidate()).pipe(Effect.scoped, Effect.provide(layer)))
const saveGlobal = (config: Config.Info) =>
  Effect.runPromise(Config.Service.use((svc) => svc.updateGlobal(config)).pipe(Effect.scoped, Effect.provide(layer)))
const saveProject = (config: Config.Info) =>
  Effect.runPromise(Config.Service.use((svc) => svc.update(config)).pipe(Effect.scoped, Effect.provide(layer)))

async function writeConfig(dir: string, config: object, name = "cssltd.json") {
  await Filesystem.write(path.join(dir, name), JSON.stringify(config))
}

function decode(input: unknown): Config.Info {
  const config = Schema.decodeUnknownSync(Config.Info)(input)
  return {
    ...config,
    skills: config.skills && {
      paths: config.skills.paths && [...config.skills.paths],
      urls: config.skills.urls && [...config.skills.urls],
    },
  }
}

const cfg: Partial<Config.Info> = {
  plugin: ["@cssltdcode/cssltd-indexing"],
  indexing: {
    provider: "ollama",
    vectorStore: "qdrant",
    ollama: {
      baseUrl: "http://127.0.0.1:1",
    },
  },
}

afterEach(async () => {
  delete process.env.CSSLTD_MD_TEST
  await clear()
  await disposeAllInstances()
})

describe("markdown substitutions", () => {
  test("applies file and env substitutions to parsed markdown body", async () => {
    process.env.CSSLTD_MD_TEST = "env content"
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(path.join(dir, "body.md"), "file content")
        await Filesystem.write(
          path.join(dir, "SKILL.md"),
          ["---", "name: test", "description: Test", "---", "{file:body.md}", "{env:CSSLTD_MD_TEST}"].join("\n"),
        )
      },
    })

    const md = await ConfigMarkdown.parse(path.join(tmp.path, "SKILL.md"), { trusted: true })

    expect(md.content).toContain("file content")
    expect(md.content).toContain("env content")
  })
})

describe("global config updates", () => {
  test("preserves concurrent permission updates", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()
    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await provideTestInstance({
        directory: tmp.path,
        fn: async () => {
          await Effect.runPromise(
            Config.Service.use((svc) =>
              Effect.all(
                Array.from({ length: 10 }, (_, index) =>
                  svc.updateGlobal(
                    { permission: { external_directory: { [`/skills/${index}/*`]: "allow" } } },
                    { dispose: false },
                  ),
                ),
                { concurrency: "unbounded" },
              ),
            ).pipe(Effect.scoped, Effect.provide(layer)),
          )

          const config = await Bun.file(path.join(globalTmp.path, "cssltd.jsonc")).json()
          expect(Object.keys(config.permission.external_directory)).toHaveLength(10)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })
})

describe("cssltdcode indexing config", () => {
  test("ignores retired semantic indexing flags in existing configs", async () => {
    await using tmp = await tmpdir({ git: true })
    await writeConfig(tmp.path, {
      experimental: { semantic_indexing: true, batch_tool: true },
    })

    await provideTestInstance({
      directory: tmp.path,
      fn: async () => {
        const config = await load()
        expect(config.experimental?.batch_tool).toBe(true)
        expect(config.experimental).not.toHaveProperty("semantic_indexing")
      },
    })
  })

  test("keeps global indexing enabled in global config", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()

    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await writeConfig(globalTmp.path, {
        $schema: "https://app.cssltd.ai/config.json",
        indexing: {
          enabled: true,
          provider: "ollama",
        },
      })

      await provideTestInstance({
        directory: tmp.path,
        fn: async () => {
          const config = await load()
          const global = await Effect.runPromise(
            Config.Service.use((svc) => svc.getGlobal()).pipe(Effect.scoped, Effect.provide(layer)),
          )
          expect(config.indexing?.provider).toBe("ollama")
          expect(config.indexing?.enabled).toBeUndefined()
          expect(global.indexing?.enabled).toBe(true)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })

  test("uses global indexing enabled when project enablement is unset", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir({ git: true, config: cfg })

    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await writeConfig(globalTmp.path, {
        $schema: "https://app.cssltd.ai/config.json",
        indexing: {
          enabled: true,
        },
      })

      await provideTestInstance({
        directory: tmp.path,
        fn: async () => {
          const global = await Effect.runPromise(
            Config.Service.use((svc) => svc.getGlobal()).pipe(Effect.scoped, Effect.provide(layer)),
          )
          const config = await load()
          const input = CssltdIndexing.input(config.indexing, global.indexing)
          expect(input.enabled).toBe(true)
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })

  test("project indexing enabled overrides global enablement", async () => {
    const input = CssltdIndexing.input({ enabled: false }, { enabled: true })
    expect(input.enabled).toBe(false)
    expect(CssltdIndexing.input(undefined, { enabled: true }).enabled).toBe(true)
    expect(CssltdIndexing.input({ enabled: true }, { enabled: false }).enabled).toBe(true)
  })

  test("creates missing project config as .cssltd/cssltd.jsonc", async () => {
    await using tmp = await tmpdir({ git: true })

    await provideTestInstance({
      directory: tmp.path,
      fn: async () => {
        await saveProject({ indexing: { enabled: true } })
      },
    })

    expect(await Bun.file(path.join(tmp.path, ".cssltd", "cssltd.jsonc")).exists()).toBe(true)
    expect(await Bun.file(path.join(tmp.path, ".cssltd", "cssltd.json")).exists()).toBe(false)
  })

  test("accepts delete sentinels for indexing model overrides", () => {
    const patch = decode({ indexing: { model: null, dimension: null } })
    const merged = CssltdcodeConfig.mergeConfig(
      {
        indexing: {
          provider: "openai",
          model: "text-embedding-3-large",
          dimension: 3072,
        },
      },
      patch,
    )
    const input = CssltdIndexing.input(patch.indexing)

    expect(merged.indexing).toEqual({ provider: "openai" })
    expect(input.modelId).toBeUndefined()
    expect(input.modelDimension).toBeUndefined()
  })
})

describe("cssltdcode sandbox config", () => {
  test("prevents project config from weakening sandbox policy", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir({ git: true })

    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await writeConfig(globalTmp.path, {
        $schema: "https://app.cssltd.ai/config.json",
        sandbox: {
          enabled: true,
          network: "deny",
          writable_paths: ["/tmp/global"],
          allowed_hosts: ["api.github.com"],
        },
      })
      await writeConfig(tmp.path, {
        sandbox: {
          enabled: false,
          network: "allow",
          writable_paths: ["/tmp/project"],
          allowed_hosts: ["evil.example"],
        },
      })

      await provideTestInstance({
        directory: tmp.path,
        fn: async () => {
          const config = await load()
          expect(config.sandbox).toEqual({
            enabled: true,
            network: "deny",
            writable_paths: ["/tmp/global"],
            allowed_hosts: ["api.github.com"],
          })
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })

  test("allows project config to strengthen sandbox policy", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir({ git: true })

    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await writeConfig(globalTmp.path, {
        sandbox: {
          enabled: false,
          network: "allow",
          writable_paths: ["/tmp/global"],
          allowed_hosts: ["api.github.com"],
        },
      })
      await writeConfig(tmp.path, {
        sandbox: {
          enabled: true,
          network: "deny",
          writable_paths: ["/tmp/project"],
          allowed_hosts: ["evil.example"],
        },
      })

      await provideTestInstance({
        directory: tmp.path,
        fn: async () => {
          const config = await load()
          expect(config.sandbox).toEqual({
            enabled: true,
            network: "deny",
            writable_paths: ["/tmp/global"],
            allowed_hosts: [],
          })
        },
      })
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })
})

describe("custom provider model config", () => {
  test("persists and removes reasoning across a global config reload", async () => {
    await using globalTmp = await tmpdir()
    const file = path.join(globalTmp.path, "cssltd.json")
    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await writeConfig(globalTmp.path, {
        provider: {
          custom: {
            name: "Custom",
            models: { model: { name: "Model" } },
          },
        },
      })
      await saveGlobal(
        decode({
          provider: {
            custom: {
              models: { model: { reasoning: true } },
            },
          },
        }),
      )
      const added = JSON.parse(await Bun.file(file).text())
      expect(added.provider.custom.models.model.reasoning).toBe(true)

      await saveGlobal(
        decode({
          provider: {
            custom: {
              models: { model: { reasoning: null } },
            },
          },
        }),
      )
      const written = JSON.parse(await Bun.file(file).text())
      expect(written.provider.custom.models.model).not.toHaveProperty("reasoning")

      await clear()
      const reloaded = await Effect.runPromise(
        Config.Service.use((svc) => svc.getGlobal()).pipe(Effect.scoped, Effect.provide(layer)),
      )
      expect(reloaded.provider?.custom?.models?.model?.reasoning).toBeUndefined()
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })
})

describe("subagent variant overrides", () => {
  test("removes one model override without removing sibling models", () => {
    const patch = decode({
      subagent_variant_overrides: {
        "anthropic/claude-sonnet-4-6": null,
      },
    })
    const merged = CssltdcodeConfig.mergeConfig(
      {
        subagent_variant_overrides: {
          "anthropic/claude-sonnet-4-6": "high",
          "openai/gpt-5": "xhigh",
        },
      },
      patch,
    )

    expect(patch.subagent_variant_overrides?.["anthropic/claude-sonnet-4-6"]).toBeNull()
    expect(merged.subagent_variant_overrides).toEqual({ "openai/gpt-5": "xhigh" })
  })

  test("accepts a delete sentinel for the complete override map", () => {
    const patch = decode({ subagent_variant_overrides: null })
    const merged = CssltdcodeConfig.mergeConfig(
      {
        subagent_variant_overrides: {
          "anthropic/claude-sonnet-4-6": "high",
        },
      },
      patch,
    )

    expect(patch.subagent_variant_overrides).toBeNull()
    expect(merged.subagent_variant_overrides).toBeUndefined()
  })
})

describe("agent config", () => {
  test("accepts delete sentinels for agent model and variant overrides", () => {
    const patch = decode({ agent: { explore: { model: null, variant: null } } })
    const merged = CssltdcodeConfig.mergeConfig(
      {
        agent: {
          explore: {
            model: "cssltd/anthropic/claude-sonnet-4-6",
            variant: "high",
          },
        },
      },
      patch,
    )

    expect(patch.agent?.explore?.model).toBeNull()
    expect(patch.agent?.explore?.variant).toBeNull()
    expect(merged.agent).toBeUndefined()
  })

  test("removes an agent variant override without removing its model", () => {
    const patch = decode({ agent: { explore: { variant: null } } })
    const merged = CssltdcodeConfig.mergeConfig(
      {
        agent: {
          explore: {
            model: "cssltd/anthropic/claude-sonnet-4-6",
            variant: "high",
          },
        },
      },
      patch,
    )

    expect(patch.agent?.explore?.variant).toBeNull()
    expect(merged.agent?.explore).toEqual({ model: "cssltd/anthropic/claude-sonnet-4-6" })
  })

  test("removes agent model and variant overrides from global JSONC config", async () => {
    await using globalTmp = await tmpdir()
    const file = path.join(globalTmp.path, "cssltd.jsonc")
    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = globalTmp.path
    await clear()
    await disposeAllInstances()

    try {
      await Filesystem.write(
        file,
        [
          "{",
          "  // Preserve this comment while clearing overrides.",
          '  "agent": {',
          '    "explore": {',
          '      "model": "cssltd/anthropic/claude-sonnet-4-6",',
          '      "variant": "high",',
          '      "description": "Keep me"',
          "    }",
          "  }",
          "}",
        ].join("\n"),
      )
      const patch = decode({ agent: { explore: { model: null, variant: null } } })

      await saveGlobal(patch)

      const written = await Bun.file(file).text()
      expect(written).toContain("// Preserve this comment while clearing overrides.")
      expect(written).not.toContain('"model"')
      expect(written).not.toContain('"variant"')
      expect(written).toContain('"description": "Keep me"')
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })
})

describe("project config directory precedence", () => {
  test("prefers .cssltd over legacy .cssltdcode and ignores .cssltdcode", async () => {
    await using tmp = await tmpdir()
    const entries = [
      {
        root: ".cssltdcode",
        source: "cssltdcode",
        config: {
          username: "cssltdcode",
          model: "test/cssltdcode",
          small_model: "test/cssltdcode",
        },
        names: ["shared", "legacy", "cssltdcode-only"],
      },
      {
        root: ".cssltdcode",
        source: "cssltdcode",
        config: {
          username: "cssltdcode",
          model: "test/cssltdcode",
        },
        names: ["shared", "legacy"],
      },
      {
        root: ".cssltd",
        source: "cssltd",
        config: {
          username: "cssltd",
        },
        names: ["shared"],
      },
    ] as const

    for (const item of entries) {
      const dir = path.join(tmp.path, item.root)
      await writeConfig(dir, {
        $schema: "https://app.cssltd.ai/config.json",
        ...item.config,
      })
      for (const name of item.names) {
        await Filesystem.write(
          path.join(dir, "command", `${name}.md`),
          `---\ndescription: ${item.source} command\n---\n${item.source} command template`,
        )
        await Filesystem.write(
          path.join(dir, "agent", `${name}.md`),
          `---\ndescription: ${item.source} agent\nmode: subagent\n---\n${item.source} agent prompt`,
        )
      }
      await Filesystem.write(path.join(dir, "plugin", `${item.source}.ts`), "export default {}")
    }

    await provideTestInstance({
      directory: tmp.path,
      fn: async () => {
        const config = await load()

        expect(config.username).toBe("cssltd")
        expect(config.model).toBe("test/cssltdcode")
        expect(config.small_model).toBeUndefined()

        expect(config.command?.shared).toMatchObject({
          description: "cssltd command",
          template: "cssltd command template",
        })
        expect(config.command?.legacy).toMatchObject({
          description: "cssltdcode command",
          template: "cssltdcode command template",
        })
        expect(config.command?.["cssltdcode-only"]).toBeUndefined()

        expect(config.agent?.shared).toMatchObject({
          description: "cssltd agent",
          prompt: "cssltd agent prompt",
        })
        expect(config.agent?.legacy).toMatchObject({
          description: "cssltdcode agent",
          prompt: "cssltdcode agent prompt",
        })
        expect(config.agent?.["cssltdcode-only"]).toBeUndefined()

        const plugins = JSON.stringify(config.plugin)
        expect(plugins).toContain("cssltdcode.ts")
        expect(plugins).toContain("cssltd.ts")
        expect(plugins).not.toContain("cssltdcode.ts")
      },
    })
  })
})

describe("linked worktree config", () => {
  test("uses primary config directories as local fallbacks", async () => {
    await using primary = await tmpdir({ git: true })
    const worktree = path.join(path.dirname(primary.path), `${path.basename(primary.path)}-config-feature`)
    await Bun.write(path.join(primary.path, "cssltd.json"), JSON.stringify({ model: "test/primary" }))
    await $`git add cssltd.json`.cwd(primary.path).quiet()
    await $`git commit -m config`.cwd(primary.path).quiet()
    await $`git worktree add -b config-sibling-worktree ${worktree}`.cwd(primary.path).quiet()

    try {
      await Bun.write(path.join(worktree, "cssltd.json"), JSON.stringify({ model: "test/worktree" }))
      await Bun.write(
        path.join(primary.path, ".cssltd", "cssltd.jsonc"),
        JSON.stringify({ username: "primary-dir", indexing: { enabled: true } }),
      )
      await Bun.write(path.join(worktree, ".cssltd", "cssltd.jsonc"), JSON.stringify({ username: "worktree-dir" }))

      const config = await provideTestInstance({ directory: worktree, fn: load })

      expect(config.model).toBe("test/worktree")
      expect(config.username).toBe("worktree-dir")
      expect(config.indexing?.enabled).toBe(true)
    } finally {
      await $`git worktree remove --force ${worktree}`.cwd(primary.path).quiet().nothrow()
    }
  })

  test("uses nested primary config directories as local fallbacks", async () => {
    await using primary = await tmpdir({ git: true })
    const worktree = path.join(path.dirname(primary.path), `${path.basename(primary.path)}-config-nested`)
    const directory = path.join(worktree, "packages", "app")
    await $`git worktree add -b config-nested-worktree ${worktree}`.cwd(primary.path).quiet()

    try {
      await Bun.write(path.join(directory, "placeholder"), "")
      await Bun.write(
        path.join(primary.path, "packages", ".cssltdcode", "cssltd.jsonc"),
        JSON.stringify({ snapshot: true, autoupdate: false, share: "auto", default_agent: "cssltdcode-only" }),
      )
      await Bun.write(
        path.join(primary.path, "packages", ".cssltdcode", "cssltd.jsonc"),
        JSON.stringify({ snapshot: true, autoupdate: "notify", share: "disabled" }),
      )
      await Bun.write(path.join(primary.path, "packages", ".cssltd", "cssltd.jsonc"), JSON.stringify({ snapshot: false }))
      await Bun.write(path.join(directory, ".cssltd", "cssltd.jsonc"), JSON.stringify({ share: "manual" }))

      const config = await provideTestInstance({ directory, fn: load })

      expect(config.snapshot).toBe(false)
      expect(config.autoupdate).toBe("notify")
      expect(config.share).toBe("manual")
      expect(config.default_agent).toBeUndefined()
    } finally {
      await $`git worktree remove --force ${worktree}`.cwd(primary.path).quiet().nothrow()
    }
  })

  test("keeps CSSLTD_CONFIG_DIR above the primary fallback", async () => {
    await using primary = await tmpdir({ git: true })
    await using explicit = await tmpdir()
    const worktree = path.join(path.dirname(primary.path), `${path.basename(primary.path)}-config-explicit`)
    await $`git worktree add -b config-explicit-worktree ${worktree}`.cwd(primary.path).quiet()
    await Bun.write(path.join(primary.path, ".cssltd", "cssltd.jsonc"), JSON.stringify({ username: "primary-dir" }))
    await Bun.write(path.join(explicit.path, "cssltd.jsonc"), JSON.stringify({ username: "explicit-dir" }))
    const previous = process.env["CSSLTD_CONFIG_DIR"]
    process.env["CSSLTD_CONFIG_DIR"] = explicit.path

    try {
      const config = await provideTestInstance({ directory: worktree, fn: load })
      expect(config.username).toBe("explicit-dir")
    } finally {
      if (previous === undefined) delete process.env["CSSLTD_CONFIG_DIR"]
      else process.env["CSSLTD_CONFIG_DIR"] = previous
      await $`git worktree remove --force ${worktree}`.cwd(primary.path).quiet().nothrow()
    }
  })
})

describe("cssltdcode config migration notice", () => {
  const withGlobalConfig = async <T>(dir: string, fn: () => Promise<T> | T): Promise<T> => {
    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = dir
    try {
      return await fn()
    } finally {
      ;(Global.Path as { config: string }).config = prev
    }
  }

  test("detects a project .cssltdcode directory", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()
    await Filesystem.write(path.join(tmp.path, ".cssltdcode", "cssltdcode.json"), JSON.stringify({ model: "test/legacy" }))

    // Isolate the global config dir so a real ~/.config/cssltdcode on the host cannot interfere.
    await withGlobalConfig(path.join(globalTmp.path, "cssltd"), () => {
      const found = CssltdcodeConfig.detectCssltdcodeConfig({ directory: tmp.path, scanProject: true })
      expect(found).toEqual([path.join(tmp.path, ".cssltdcode")])
    })
  })

  test("detects a global cssltdcode config directory", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()
    const cssltdcodeDir = path.join(globalTmp.path, "cssltdcode")
    await Filesystem.write(path.join(cssltdcodeDir, "cssltdcode.json"), JSON.stringify({ model: "test/legacy" }))

    await withGlobalConfig(path.join(globalTmp.path, "cssltd"), () => {
      const found = CssltdcodeConfig.detectCssltdcodeConfig({ directory: tmp.path, scanProject: true })
      expect(found).toEqual([cssltdcodeDir])
    })
  })

  test("skips the project scan when disabled", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()
    await Filesystem.write(path.join(tmp.path, ".cssltdcode", "cssltdcode.json"), JSON.stringify({ model: "test/legacy" }))

    await withGlobalConfig(path.join(globalTmp.path, "cssltd"), () => {
      const found = CssltdcodeConfig.detectCssltdcodeConfig({ directory: tmp.path, scanProject: false })
      expect(found).toEqual([])
    })
  })

  test("builds a dismissible notification when cssltdcode config exists", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()
    await Filesystem.write(path.join(tmp.path, ".cssltdcode", "cssltdcode.json"), JSON.stringify({ model: "test/legacy" }))

    await withGlobalConfig(path.join(globalTmp.path, "cssltd"), () => {
      const notice = CssltdcodeConfig.cssltdcodeConfigNotification({ directory: tmp.path, scanProject: true })
      expect(notice?.id).toBe(CssltdcodeConfig.CSSLTDCODE_NOTIFICATION_ID)
      expect(notice?.message).toContain(path.join(tmp.path, ".cssltdcode"))
      expect(notice?.action?.actionURL).toBe(CssltdcodeConfig.CONFIG_DOCS_URL)
      expect(notice?.showIn).toEqual(["cli", "extension"])
    })
  })

  test("returns no notification when nothing needs migrating", async () => {
    await using globalTmp = await tmpdir()
    await using tmp = await tmpdir()

    await withGlobalConfig(path.join(globalTmp.path, "cssltd"), () => {
      const notice = CssltdcodeConfig.cssltdcodeConfigNotification({ directory: tmp.path, scanProject: true })
      expect(notice).toBeUndefined()
    })
  })
})

describe("bash permission migration", () => {
  for (const action of ["allow", "ask", "deny"] as const) {
    test(`preserves string-form ${action} permission in jsonc`, async () => {
      const input = `{
  "$schema": "https://app.cssltd.ai/config.json",
  "permission": "${action}"
}`
      await using tmp = await tmpdir({
        init: async (dir) => {
          await Filesystem.write(path.join(dir, "cssltd.jsonc"), input)
        },
      })

      const prev = Global.Path.config
      ;(Global.Path as { config: string }).config = tmp.path
      await clear()
      await disposeAllInstances()

      try {
        await CssltdcodeConfig.migrateBashPermission()

        const file = path.join(tmp.path, "cssltd.jsonc")
        const text = await Filesystem.readText(file)
        const parsed = ConfigParse.schema(Config.Info, ConfigParse.jsonc(text, file), file)
        expect(text).toBe(input)
        expect(parsed.permission?.["*"]).toBe(action)
        expect(parsed.permission?.bash).toBeUndefined()
      } finally {
        ;(Global.Path as { config: string }).config = prev
        await clear()
        await disposeAllInstances()
      }
    })

    test(`preserves string-form ${action} permission in json`, async () => {
      const input = JSON.stringify({
        $schema: "https://app.cssltd.ai/config.json",
        permission: action,
      })
      await using tmp = await tmpdir({
        init: async (dir) => {
          await Filesystem.write(path.join(dir, "cssltd.json"), input)
        },
      })

      const prev = Global.Path.config
      ;(Global.Path as { config: string }).config = tmp.path
      await clear()
      await disposeAllInstances()

      try {
        await CssltdcodeConfig.migrateBashPermission()

        const file = path.join(tmp.path, "cssltd.json")
        const text = await Filesystem.readText(file)
        const parsed = ConfigParse.schema(Config.Info, ConfigParse.jsonc(text, file), file)
        expect(text).toBe(input)
        expect(parsed.permission?.["*"]).toBe(action)
        expect(parsed.permission?.bash).toBeUndefined()
      } finally {
        ;(Global.Path as { config: string }).config = prev
        await clear()
        await disposeAllInstances()
      }
    })
  }

  test("migrates object-form global permission in jsonc", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        await Filesystem.write(
          path.join(dir, "cssltd.jsonc"),
          `{
  "$schema": "https://app.cssltd.ai/config.json",
  "permission": {
    "read": "allow"
  }
}`,
        )
      },
    })

    const prev = Global.Path.config
    ;(Global.Path as { config: string }).config = tmp.path
    await clear()
    await disposeAllInstances()

    try {
      await CssltdcodeConfig.migrateBashPermission()

      const file = path.join(tmp.path, "cssltd.jsonc")
      const text = await Filesystem.readText(file)
      const parsed = ConfigParse.schema(Config.Info, ConfigParse.jsonc(text, file), file)
      expect(parsed.permission?.read).toBe("allow")
      expect(parsed.permission?.bash).toBe("allow")
    } finally {
      ;(Global.Path as { config: string }).config = prev
      await clear()
      await disposeAllInstances()
    }
  })
})
