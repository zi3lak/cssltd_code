import { LayerNode } from "@cssltdcode/core/effect/layer-node"
import { Ripgrep } from "@cssltdcode/core/ripgrep"
import { PlanExitTool } from "./plan"
import { Session } from "@/session/session"
import { QuestionTool } from "./question"
// cssltdcode_change start
import { SuggestTool } from "../cssltdcode/suggestion/tool"
import { Command } from "@/command"
// cssltdcode_change end
import { ShellTool } from "./shell"
import { EditTool } from "./edit"
import { GlobTool } from "./glob"
import { GrepTool } from "./grep"
import { ReadTool } from "./read"
import { TaskTool } from "./task"
import { Database } from "@cssltdcode/core/database/database"
import { TodoWriteTool } from "./todo"
import { WebFetchTool } from "./webfetch"
import { WriteTool } from "./write"
import { InvalidTool } from "./invalid"
import { SkillTool } from "./skill"
import * as Tool from "./tool"
import { Config } from "@/config/config"
import { type ToolContext as PluginToolContext, type ToolDefinition } from "@cssltdcode/plugin"
import type { JSONSchema7, JSONSchema7Definition } from "@ai-sdk/provider"
import { Schema } from "effect"
import z from "zod"
import { Plugin } from "../plugin"
import { Provider } from "@/provider/provider"

import { WebSearchTool } from "./websearch"
import { CssltdToolRegistry } from "../cssltdcode/tool/registry" // cssltdcode_change
import { Notebook } from "@/cssltdcode/notebook/service" // cssltdcode_change
import { AgentManager } from "@/cssltdcode/agent-manager/service" // cssltdcode_change
import { RepoOverviewTool } from "@/cssltdcode/tool/repo-overview" // cssltdcode_change
import { RepoCloneTool } from "./repo_clone" // cssltdcode_change
import { Flag } from "@cssltdcode/core/flag/flag" // cssltdcode_change
import { Auth } from "@/auth" // cssltdcode_change
import { LspTool } from "./lsp"
import * as Truncate from "./truncate"
import { ApplyPatchTool } from "./apply_patch"
import { Glob } from "@cssltdcode/core/util/glob"
import path from "path"
import { pathToFileURL } from "url"
import { Effect, Layer, Context, Option } from "effect" // cssltdcode_change
import { CrossSpawnSpawner } from "@cssltdcode/core/cross-spawn-spawner"
import { Format } from "../format"
import { InstanceState } from "@/effect/instance-state"
import { EffectBridge } from "@/effect/bridge"
import { Question } from "../question"
import { Todo } from "../session/todo"
import { LSP } from "@/lsp/lsp"
import { Instruction } from "../session/instruction"
import { FSUtil } from "@cssltdcode/core/fs-util"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Bus } from "../bus"
import { Agent } from "../agent/agent"
import { Skill } from "../skill"
import { Permission } from "@/permission"
import { SessionStatus } from "@/session/status" // cssltdcode_change
import { Git } from "@/git" // cssltdcode_change
import { BackgroundJob } from "@/background/job"
import { RuntimeFlags } from "@/effect/runtime-flags"
import * as ToolNetwork from "@/cssltdcode/sandbox/network" // cssltdcode_change
import { MemoryService } from "@cssltdcode/cssltd-memory/effect/service" // cssltdcode_change
import { ProviderV2 } from "@cssltdcode/core/provider"
import { ModelV2 } from "@cssltdcode/core/model"
import { RepositoryCache } from "@cssltdcode/core/repository-cache" // cssltdcode_change
import { RipgrepBinary } from "@cssltdcode/core/ripgrep/binary" // cssltdcode_change
import { AppProcess } from "@cssltdcode/core/process" // cssltdcode_change

export function webSearchEnabled(
  providerID: ProviderV2.ID,
  flags = { exa: Flag.CSSLTD_ENABLE_EXA, parallel: Flag.CSSLTD_ENABLE_PARALLEL },
) {
  return providerID === ProviderV2.ID.cssltd || flags.exa || flags.parallel // cssltdcode_change
}

type TaskDef = Tool.InferDef<typeof TaskTool>
type ReadDef = Tool.InferDef<typeof ReadTool>

type State = {
  custom: Tool.Def[]
  builtin: Tool.Def[]
  task: TaskDef
  read: ReadDef
}

export interface Interface {
  readonly ids: () => Effect.Effect<string[]>
  readonly all: () => Effect.Effect<Tool.Def[]>
  readonly named: () => Effect.Effect<{ task: TaskDef; read: ReadDef }>
  // cssltdcode_change start
  readonly tools: (model: {
    providerID: ProviderV2.ID
    modelID: ModelV2.ID
    family?: string
    agent: Agent.Info
  }) => Effect.Effect<Tool.Def[]>
  // cssltdcode_change end
}

export class Service extends Context.Service<Service, Interface>()("@cssltdcode/ToolRegistry") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const plugin = yield* Plugin.Service
    const agents = yield* Agent.Service
    const skill = yield* Skill.Service // cssltdcode_change - keep the available skill summary in model-facing tool context
    const truncate = yield* Truncate.Service
    const flags = yield* RuntimeFlags.Service

    const invalid = yield* InvalidTool
    const task = yield* TaskTool
    const read = yield* ReadTool
    const question = yield* QuestionTool
    const todo = yield* TodoWriteTool
    const lsptool = yield* LspTool
    const plan = yield* PlanExitTool
    const webfetch = yield* WebFetchTool
    const websearch = yield* WebSearchTool
    const clone = yield* RepoCloneTool // cssltdcode_change
    const overview = yield* RepoOverviewTool // cssltdcode_change
    const shell = yield* ShellTool
    const globtool = yield* GlobTool
    const writetool = yield* WriteTool
    const edit = yield* EditTool
    const greptool = yield* GrepTool
    const patchtool = yield* ApplyPatchTool
    const skilltool = yield* SkillTool
    const agent = yield* Agent.Service
    // cssltdcode_change start
    const suggesttool = yield* SuggestTool
    const manager = Option.getOrUndefined(yield* Effect.serviceOption(AgentManager.Service))
    const notebook = Option.getOrUndefined(yield* Effect.serviceOption(Notebook.Service))
    const cssltdToolInfos = yield* CssltdToolRegistry.infos(manager, notebook).pipe(Effect.provide(MemoryService.layer))
    // cssltdcode_change end

    const state = yield* InstanceState.make<State>(
      Effect.fn("ToolRegistry.state")(function* (ctx) {
        const custom: Tool.Def[] = []

        function fromPlugin(id: string, def: ToolDefinition): Tool.Def {
          // Plugin tools still expose Zod args publicly; keep that compatibility
          // boxed at the registry boundary and give the LLM the original JSON Schema.
          // Normalize missing args to `{}` once — pre-1.14.49 the code was
          // `z.object(def.args)` and Zod silently tolerated undefined (#27451, #27630).
          const args = def.args ?? {}
          const entries = Object.entries(args)
          const allZod = entries.every((entry) => isZodType(entry[1]))
          const zodParams = allZod ? z.object(args) : undefined
          const jsonSchema = zodParams ? zodJsonSchema(zodParams) : legacyJsonSchema(entries)
          const parameters = zodParams
            ? Schema.declare<unknown>((u): u is unknown => zodParams.safeParse(u).success)
            : Schema.Unknown
          return {
            id,
            parameters,
            jsonSchema,
            description: def.description,
            execute: (args, toolCtx) =>
              Effect.gen(function* () {
                // Bridge the host's Effect-based `ask` into a Promise-returning
                // function for the plugin to make sure context persists
                const bridge = yield* EffectBridge.make()
                const pluginCtx: PluginToolContext = {
                  ...toolCtx,
                  ask: (req) => bridge.promise(toolCtx.ask(req)),
                  directory: ctx.directory,
                  worktree: ctx.worktree,
                }
                const result = yield* Effect.promise(() => def.execute(args as any, pluginCtx))
                const output = typeof result === "string" ? result : result.output
                const metadata = typeof result === "string" ? {} : (result.metadata ?? {})
                const attachments = typeof result === "string" ? undefined : result.attachments
                const info = yield* agent.get(toolCtx.agent)
                const out = yield* truncate.output(output, {}, info)
                return {
                  title: typeof result === "string" ? "" : (result.title ?? ""),
                  output: out.truncated ? out.content : output,
                  attachments,
                  metadata: {
                    ...metadata,
                    truncated: out.truncated,
                    ...(out.truncated && { outputPath: out.outputPath }),
                  },
                }
              }).pipe(
                Effect.withSpan("Tool.execute", {
                  attributes: {
                    "tool.name": id,
                    "session.id": toolCtx.sessionID,
                    "message.id": toolCtx.messageID,
                    ...(toolCtx.callID ? { "tool.call_id": toolCtx.callID } : {}),
                  },
                }),
              ),
          }
        }

        const dirs = yield* config.directories()
        const matches = dirs.flatMap((dir) =>
          Glob.scanSync("{tool,tools}/*.{js,ts}", { cwd: dir, absolute: true, dot: true, symlink: true }),
        )
        if (matches.length) yield* config.waitForDependencies()
        for (const match of matches) {
          const namespace = path.basename(match, path.extname(match))
          // `match` is an absolute filesystem path from `Glob.scanSync(..., { absolute: true })`.
          // Import it as `file://` so Node on Windows accepts the dynamic import.
          const mod = yield* Effect.promise(() => import(pathToFileURL(match).href))
          for (const [id, def] of Object.entries(mod)) {
            if (!isPluginTool(def)) continue
            custom.push(fromPlugin(id === "default" ? namespace : `${namespace}_${id}`, def))
          }
        }

        const plugins = yield* plugin.list()
        for (const p of plugins) {
          for (const [id, def] of Object.entries(p.tool ?? {})) {
            custom.push(fromPlugin(id, def))
          }
        }

        // cssltdcode_change start
        const cfg = yield* config.get()
        const global = yield* config.getGlobal()
        const indexing = CssltdToolRegistry.indexing(cfg, global)
        // cssltdcode_change end
        const questionEnabled = ["app", "cli", "desktop", "vscode"].includes(flags.client) || flags.enableQuestionTool // cssltdcode_change: add vscode client

        const tool = yield* Effect.all({
          invalid: Tool.init(invalid),
          shell: Tool.init(shell),
          read: Tool.init(read),
          glob: Tool.init(globtool),
          grep: Tool.init(greptool),
          edit: Tool.init(edit),
          write: Tool.init(writetool),
          task: Tool.init(task),
          fetch: Tool.init(webfetch),
          todo: Tool.init(todo),
          search: Tool.init(websearch),
          clone: Tool.init(clone), // cssltdcode_change
          overview: Tool.init(overview), // cssltdcode_change
          skill: Tool.init(skilltool),
          patch: Tool.init(patchtool),
          question: Tool.init(question),
          lsp: Tool.init(lsptool),
          plan: Tool.init(plan),
          suggest: Tool.init(suggesttool), // cssltdcode_change
        })

        // cssltdcode_change start
        const cssltd = yield* CssltdToolRegistry.build(cssltdToolInfos, {
          agent: agents,
          truncate,
          indexing: indexing ?? false,
        })
        // cssltdcode_change end

        return {
          custom,
          // cssltdcode_change start
          builtin: CssltdToolRegistry.describe(
            [
              tool.invalid,
              ...(questionEnabled ? [tool.question] : []),
              tool.shell,
              tool.read,
              tool.glob,
              tool.grep,
              tool.edit,
              tool.write,
              tool.task,
              tool.fetch,
              tool.todo,
              tool.search,
              ...(flags.experimentalScout ? [tool.clone, tool.overview] : []), // cssltdcode_change
              tool.skill,
              tool.patch,
              tool.plan,
              ...(["cli", "vscode"].includes(flags.client) ? [tool.suggest] : []),
              ...CssltdToolRegistry.extra(cssltd, cfg),
              ...(flags.experimentalLspTool ? [tool.lsp] : []),
            ],
            cssltd,
          ),
          // cssltdcode_change end
          task: tool.task,
          read: tool.read,
        }
      }),
    )

    const all: Interface["all"] = Effect.fn("ToolRegistry.all")(function* () {
      const s = yield* InstanceState.get(state)
      return [...s.builtin.map(ToolNetwork.builtin), ...s.custom] as Tool.Def[] // cssltdcode_change
    })

    const ids: Interface["ids"] = Effect.fn("ToolRegistry.ids")(function* () {
      return (yield* all()).map((tool) => tool.id)
    })

    const describeTask = Effect.fn("ToolRegistry.describeTask")(function* (agent: Agent.Info) {
      const items = (yield* agents.list()).filter((item) => item.mode !== "primary")
      const filtered = items.filter(
        (item) => Permission.evaluate("task", item.name, agent.permission).action !== "deny",
      )
      const list = filtered.toSorted((a, b) => a.name.localeCompare(b.name))
      const description = list
        .map(
          (item) =>
            `- ${item.name}: ${item.description ?? "This subagent should only be called manually by the user."}`,
        )
        .join("\n")
      return ["Available agent types and the tools they have access to:", description].join("\n")
    })

    // cssltdcode_change start - retain the concise skill inventory added to the skill tool description
    const describeSkill = Effect.fn("ToolRegistry.describeSkill")(function* (agent: Agent.Info) {
      const list = yield* skill.available(agent)
      if (list.length === 0) return "No skills are currently available."
      return [
        "Load a specialized skill that provides domain-specific instructions and workflows.",
        "",
        "When a task matches one of the available skills below, load its full instructions with this tool.",
        "",
        Skill.fmt(list, { verbose: false }),
      ].join("\n")
    })
    // cssltdcode_change end

    const tools: Interface["tools"] = Effect.fn("ToolRegistry.tools")(function* (input) {
      const filtered = (yield* all()).filter((tool) => {
        if (!CssltdToolRegistry.available(tool, input.agent)) return false // cssltdcode_change
        if (tool.id === WebSearchTool.id) {
          return webSearchEnabled(input.providerID, { exa: flags.enableExa, parallel: flags.enableParallel })
        }

        const usePatch = CssltdToolRegistry.usePatch(input) // cssltdcode_change
        if (tool.id === ApplyPatchTool.id) return usePatch
        if (tool.id === EditTool.id) return !usePatch // cssltdcode_change

        return true
      })
      const cssltdFiltered = yield* CssltdToolRegistry.applyVisibility(filtered) // cssltdcode_change

      return yield* Effect.forEach(
        cssltdFiltered, // cssltdcode_change
        Effect.fnUntraced(function* (tool: Tool.Def) {
          const output = {
            description: tool.description,
            parameters: tool.parameters,
            jsonSchema: tool.jsonSchema,
          }
          yield* plugin.trigger("tool.definition", { toolID: tool.id }, output)
          const jsonSchema =
            output.parameters === tool.parameters || output.jsonSchema !== tool.jsonSchema
              ? output.jsonSchema
              : undefined
          // cssltdcode_change start
          const result = {
            id: tool.id,
            description: [
              output.description,
              tool.id === TaskTool.id ? yield* describeTask(input.agent) : undefined,
              tool.id === SkillTool.id ? yield* describeSkill(input.agent) : undefined,
            ]
              .filter(Boolean)
              .join("\n"),
            parameters: output.parameters,
            jsonSchema,
            execute: tool.execute,
            formatValidationError: tool.formatValidationError,
          }
          return ToolNetwork.isBuiltin(tool) ? ToolNetwork.builtin(result) : result
          // cssltdcode_change end
        }),
        { concurrency: "unbounded" },
      )
    })

    const named: Interface["named"] = Effect.fn("ToolRegistry.named")(function* () {
      const s = yield* InstanceState.get(state)
      return { task: s.task, read: s.read }
    })

    return Service.of({ ids, all, named, tools })
  }),
)

// cssltdcode_change start - keep Cssltd registry requirements type-checked
export const defaultLayer: Layer.Layer<Service> = Layer.suspend(
  // cssltdcode_change end
  () =>
    layer
      .pipe(
        Layer.provide(Config.defaultLayer),
        Layer.provide(Plugin.defaultLayer),
        Layer.provide(Question.defaultLayer),
        Layer.provide(Todo.defaultLayer),
        Layer.provide(Skill.defaultLayer),
        Layer.provide(Agent.defaultLayer),
        Layer.provide(Session.defaultLayer),
        Layer.provide(BackgroundJob.defaultLayer),
        Layer.provide(Provider.defaultLayer),
        Layer.provide(Git.defaultLayer), // cssltdcode_change
        Layer.provide(LSP.defaultLayer),
        Layer.provide(Instruction.defaultLayer),
        Layer.provide(FSUtil.defaultLayer),
        Layer.provide(Bus.layer),
        Layer.provide(EventV2Bridge.defaultLayer),
        Layer.provide(ToolNetwork.httpLayer), // cssltdcode_change
        Layer.provide(Format.defaultLayer),
        Layer.provide(CrossSpawnSpawner.defaultLayer),
        // cssltdcode_change start
        Layer.provide(
          Ripgrep.layer.pipe(
            Layer.provide(RipgrepBinary.layer),
            Layer.provide(AppProcess.defaultLayer),
            Layer.provide(ToolNetwork.httpLayer),
            Layer.provide(FSUtil.defaultLayer),
            Layer.provide(CrossSpawnSpawner.defaultLayer),
          ),
        ),
        // cssltdcode_change end
      )
      // cssltdcode_change start - provide Cssltd-owned registry dependencies
      .pipe(
        Layer.provide(Command.defaultLayer),
        Layer.provide(AgentManager.defaultLayer),
        Layer.provide(Notebook.defaultLayer),
        Layer.provide(Database.defaultLayer),
        Layer.provide(RuntimeFlags.defaultLayer),
        Layer.provide(SessionStatus.defaultLayer),
        Layer.provide(RepositoryCache.defaultLayer),
        Layer.provide(Truncate.defaultLayer), // cssltdcode_change - split the pipe to stay within Effect's overload limit
      )
      .pipe(Layer.provide(Auth.defaultLayer)),
  // cssltdcode_change end
)

function isZodType(value: unknown): value is z.ZodType {
  return typeof value === "object" && value !== null && "_zod" in value
}

function isPluginTool(value: unknown): value is ToolDefinition {
  return typeof value === "object" && value !== null && "args" in value && "description" in value && "execute" in value
}

function isJsonSchemaDefinition(value: unknown): value is JSONSchema7Definition {
  return typeof value === "boolean" || (typeof value === "object" && value !== null && !Array.isArray(value))
}

function legacyJsonSchema(entries: [string, unknown][]): JSONSchema7 {
  const properties = Object.fromEntries(
    entries.filter((entry): entry is [string, JSONSchema7Definition] => isJsonSchemaDefinition(entry[1])),
  )
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
  }
}

function zodJsonSchema(schema: z.ZodType): JSONSchema7 {
  const result = normalizeZodJsonSchema(z.toJSONSchema(schema, { io: "input", metadata: zodMetadataRegistry(schema) }))
  if (!isJsonSchemaObject(result)) throw new Error("plugin tool Zod schema produced a non-object JSON Schema")
  const { $defs, ...rest } = result
  return (
    $defs && isJsonSchemaObject($defs) ? { ...rest, definitions: $defs as JSONSchema7["definitions"] } : rest
  ) as JSONSchema7
}

function zodMetadataRegistry(schema: z.ZodType) {
  const registry = z.registry<Record<string, unknown>>()
  const seen = new WeakSet<object>()
  const collect = (value: unknown) => {
    if (typeof value !== "object" || value === null) return
    if (seen.has(value)) return
    seen.add(value)

    if (isZodType(value)) {
      const metadata = typeof value.meta === "function" ? value.meta() : undefined
      const description = typeof value.description === "string" ? value.description : undefined
      const merged = {
        ...(metadata && typeof metadata === "object" ? metadata : {}),
        ...(description ? { description } : {}),
      }
      if (Object.keys(merged).length) registry.add(value, merged)
      collect(value._zod.def)
      return
    }

    for (const item of Object.values(value)) collect(item)
  }
  collect(schema)
  return registry
}

function normalizeZodJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => normalizeZodJsonSchema(item))
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry) =>
        (entry[0] === "exclusiveMaximum" || entry[0] === "exclusiveMinimum") && typeof entry[1] === "boolean"
          ? false
          : true,
      )
      .map(([key, item]) => [key, normalizeZodJsonSchema(item)]),
  )
}

function isJsonSchemaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// cssltdcode_change start - preserve Cssltd registry dependencies and sandbox-aware HTTP in the upstream node graph
const networkNode = LayerNode.make(ToolNetwork.httpLayer, [])
const busNode = LayerNode.make(Bus.layer, [])
const notebookNode = LayerNode.make(Notebook.defaultLayer, [])
const repositoryCacheNode = LayerNode.make(RepositoryCache.defaultLayer, [])

export const node = LayerNode.make(layer.pipe(Layer.provide(Ripgrep.defaultLayer)), [
  Config.node,
  Plugin.node,
  Question.node,
  Todo.node,
  Agent.node,
  Skill.node,
  Session.node,
  BackgroundJob.node,
  Provider.node,
  LSP.node,
  Instruction.node,
  FSUtil.node,
  EventV2Bridge.node,
  networkNode,
  CrossSpawnSpawner.node,
  Format.node,
  Truncate.node,
  RuntimeFlags.node,
  Database.node,
  Command.node,
  Git.node,
  busNode,
  Auth.node,
  SessionStatus.node,
  notebookNode,
  repositoryCacheNode,
])
// cssltdcode_change end

export * as ToolRegistry from "./registry"
