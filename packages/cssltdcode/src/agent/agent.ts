import { LayerNode } from "@cssltdcode/core/effect/layer-node"
import { PermissionV1 } from "@cssltdcode/core/v1/permission"
import { Config } from "@/config/config"
import { serviceUse } from "@cssltdcode/core/effect/service-use"
import { Provider } from "@/provider/provider"

import { generateObject, streamObject, type ModelMessage } from "ai"
import { Truncate } from "@/tool/truncate"
import { Auth } from "../auth"
import { ProviderTransform } from "@/provider/transform"

import PROMPT_GENERATE from "./generate.txt"
import PROMPT_COMPACTION from "./prompt/compaction.txt"
import PROMPT_EXPLORE from "./prompt/explore.txt"
import PROMPT_SCOUT from "@/cssltdcode/agent/scout.txt" // cssltdcode_change
import PROMPT_SUMMARY from "./prompt/summary.txt"
import PROMPT_TITLE from "./prompt/title.txt"
import { Permission } from "@/permission"
import { mergeDeep, pipe, sortBy, values } from "remeda"
import { Global } from "@cssltdcode/core/global"
import { CssltdcodePaths } from "@/cssltdcode/paths" // cssltdcode_change
import path from "path"
import { Plugin } from "@/plugin"
import { Skill } from "../skill"
import { Effect, Context, Layer, Schema } from "effect"
import { InstanceState } from "@/effect/instance-state"
import * as Option from "effect/Option"
import * as OtelTracer from "@effect/opentelemetry/Tracer"
import { AbsolutePath, type DeepMutable } from "@cssltdcode/core/schema"
// cssltdcode_change start
import * as CssltdAgent from "@/cssltdcode/agent"
import { RuntimeFlags } from "@/effect/runtime-flags"
import * as AgentRequirements from "@/cssltdcode/agent-requirements"
import * as CssltdReference from "@/cssltdcode/reference"
import { MCP } from "@/mcp"
// cssltdcode_change end
import { ProviderV2 } from "@cssltdcode/core/provider"
import { ModelV2 } from "@cssltdcode/core/model"
import { LocationServiceMap } from "@cssltdcode/core/location-layer"
import { PluginBoot } from "@cssltdcode/core/plugin/boot"
import { Reference } from "@cssltdcode/core/reference"
import { Location } from "@cssltdcode/core/location"

export type RequirementBlockedError = InstanceType<typeof AgentRequirements.BlockedError> // cssltdcode_change

export const Info = Schema.Struct({
  name: Schema.String,
  // cssltdcode_change start
  displayName: Schema.optional(Schema.String),
  source: Schema.optional(Schema.String),
  // cssltdcode_change end
  description: Schema.optional(Schema.String),
  deprecated: Schema.optional(Schema.Boolean), // cssltdcode_change
  mode: Schema.Literals(["subagent", "primary", "all"]),
  native: Schema.optional(Schema.Boolean),
  hidden: Schema.optional(Schema.Boolean),
  topP: Schema.optional(Schema.Finite),
  temperature: Schema.optional(Schema.Finite),
  color: Schema.optional(Schema.String),
  permission: PermissionV1.Ruleset,
  model: Schema.optional(
    Schema.Struct({
      modelID: ModelV2.ID,
      providerID: ProviderV2.ID,
    }),
  ),
  variant: Schema.optional(Schema.String),
  prompt: Schema.optional(Schema.String),
  options: Schema.Record(Schema.String, Schema.Unknown),
  requirements: Schema.optional(AgentRequirements.Requirements), // cssltdcode_change
  steps: Schema.optional(Schema.Finite),
}).annotate({ identifier: "Agent" })
export type Info = DeepMutable<Schema.Schema.Type<typeof Info>>

const GeneratedAgent = Schema.Struct({
  identifier: Schema.String,
  whenToUse: Schema.String,
  systemPrompt: Schema.String,
})

export interface Interface {
  readonly get: (agent: string) => Effect.Effect<Info>
  readonly list: () => Effect.Effect<Info[]>
  readonly defaultInfo: () => Effect.Effect<Info>
  readonly defaultAgent: () => Effect.Effect<string>
  // cssltdcode_change start
  readonly requirementStatus: (agent: string) => Effect.Effect<AgentRequirements.Result>
  readonly guardRequirements: (agent: Info) => Effect.Effect<void, RequirementBlockedError>
  // cssltdcode_change end
  readonly generate: (input: {
    description: string
    model?: { providerID: ProviderV2.ID; modelID: ModelV2.ID }
  }) => Effect.Effect<
    {
      identifier: string
      whenToUse: string
      systemPrompt: string
    },
    Provider.DefaultModelError
  >
}

type State = Omit<Interface, "generate" | "requirementStatus" | "guardRequirements"> & { version: string } // cssltdcode_change

export class Service extends Context.Service<Service, Interface>()("@cssltdcode/Agent") {}

export const use = serviceUse(Service)

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const auth = yield* Auth.Service
    const plugin = yield* Plugin.Service
    const skill = yield* Skill.Service
    const mcp = yield* MCP.Service // cssltdcode_change
    const provider = yield* Provider.Service
    const flags = yield* RuntimeFlags.Service // cssltdcode_change
    const locations = yield* LocationServiceMap

    const state = yield* InstanceState.make<State>(
      Effect.fn("Agent.state")(function* (ctx) {
        const cfg = yield* config.get()
        const skillDirs = yield* skill.dirs()
        // cssltdcode_change start - include global config dirs so agents can read them without prompting
        const referenceDirs = yield* Effect.gen(function* () {
          yield* (yield* PluginBoot.Service).wait()
          yield* CssltdReference.sync({
            references: cfg.references ?? cfg.reference ?? {},
            directory: ctx.directory,
            worktree: ctx.worktree,
          })
          return (yield* (yield* Reference.Service).list()).map((reference) => reference.path)
        }).pipe(Effect.provide(locations.get(Location.Ref.make({ directory: AbsolutePath.make(ctx.directory) }))))
        const whitelistedDirs = [
          Truncate.GLOB,
          path.join(Global.Path.tmp, "*"),
          ...skillDirs.map((dir) => path.join(dir, "*")),
          path.join(Global.Path.config, "*"),
          ...CssltdcodePaths.globalDirs().map((dir) => path.join(dir, "*")),
          ...referenceDirs.map((dir) => path.join(dir, "*")),
        ]
        // cssltdcode_change end
        const readonlyExternalDirectory = {
          "*": "ask",
          ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
        } satisfies Record<string, "allow" | "ask" | "deny">

        const baseDefaults = Permission.fromConfig({ // cssltdcode_change
          "*": "allow",
          doom_loop: "ask",
          external_directory: {
            "*": "ask",
            ...Object.fromEntries(whitelistedDirs.map((dir) => [dir, "allow"])),
          },
          suggest: "deny", // cssltdcode_change
          question: "deny",
          interactive_terminal: "deny", // cssltdcode_change - human-driven tools are primary-agent only
          plan_enter: "deny",
          plan_exit: "deny",
          // cssltdcode_change start
          repo_clone: "deny",
          repo_overview: "deny",
          // cssltdcode_change end
          // mirrors github.com/github/gitignore Node.gitignore pattern for .env files
          read: {
            "*": "allow",
            "*.env": "ask",
            "*.env.*": "ask",
            "*.env.example": "allow",
          },
        })

        // cssltdcode_change start - patch defaults with bash allowlist and recall permission
        const cssltd = CssltdAgent.prepare(cfg)
        const defaults = Permission.merge(baseDefaults, cssltd.defaultsPatch)
        // cssltdcode_change end

        const user = Permission.fromConfig(cfg.permission ?? {})

        const agents: Record<string, Info> = {
          build: {
            name: "build",
            description: "The default agent. Executes tools based on configured permissions.",
            options: {},
            permission: Permission.merge(
              defaults,
              Permission.fromConfig({
                question: "allow",
                // cssltdcode_change start
                interactive_terminal: "allow",
                suggest: "allow",
                // cssltdcode_change end
                plan_enter: "allow",
              }),
              user,
            ),
            mode: "primary",
            native: true,
          },
          plan: {
            name: "plan",
            description: "Plan mode. Disallows all edit tools.",
            options: {},
            permission: Permission.merge(
              defaults,
              Permission.fromConfig({
                question: "allow",
                plan_exit: "allow",
                task: {
                  general: "deny",
                },
                external_directory: {
                  [path.join(Global.Path.data, "plans", "*")]: "allow",
                },
                edit: {
                  "*": "deny",
                  [path.join(".cssltdcode", "plans", "*.md")]: "allow",
                  [path.relative(ctx.worktree, path.join(Global.Path.data, path.join("plans", "*.md")))]: "allow",
                },
              }),
              user,
            ),
            mode: "primary",
            native: true,
          },
          general: {
            name: "general",
            description: `General-purpose agent for researching complex questions and executing multi-step tasks. Use this agent to execute multiple units of work in parallel.`,
            permission: Permission.merge(
              defaults,
              Permission.fromConfig({
                todowrite: "deny",
              }),
              user,
            ),
            options: {},
            mode: "subagent",
            native: true,
          },
          explore: {
            name: "explore",
            permission: Permission.merge(
              defaults,
              Permission.fromConfig({
                "*": "deny",
                grep: "allow",
                glob: "allow",
                list: "allow",
                bash: "allow",
                webfetch: "allow",
                websearch: "allow",
                read: "allow",
                external_directory: readonlyExternalDirectory,
              }),
              user,
            ),
            description: `Fast agent specialized for exploring codebases. Use this when you need to quickly find files by patterns (eg. "src/components/**/*.tsx"), search code for keywords (eg. "API endpoints"), or answer questions about the codebase (eg. "how do API endpoints work?"). When calling this agent, specify the desired thoroughness level: "quick" for basic searches, "medium" for moderate exploration, or "very thorough" for comprehensive analysis across multiple locations and naming conventions.`,
            prompt: PROMPT_EXPLORE,
            options: {},
            mode: "subagent",
            native: true,
          },
          // cssltdcode_change start - retain Cssltd's opt-in repository research agent
          ...(flags.experimentalScout
            ? {
                scout: {
                  name: "scout",
                  permission: Permission.merge(
                    defaults,
                    Permission.fromConfig({
                      "*": "deny",
                      grep: "allow",
                      glob: "allow",
                      webfetch: "allow",
                      websearch: "allow",
                      read: "allow",
                      repo_clone: "allow",
                      repo_overview: "allow",
                      external_directory: {
                        ...readonlyExternalDirectory,
                        [path.join(Global.Path.repos, "*")]: "allow",
                      },
                    }),
                    user,
                  ),
                  description: `Docs and dependency-source specialist. Use this when you need to inspect external documentation, clone dependency repositories into the managed cache, and research library implementation details without modifying the user's workspace.`,
                  prompt: PROMPT_SCOUT,
                  options: {},
                  mode: "subagent" as const,
                  native: true,
                },
              }
            : {}),
          // cssltdcode_change end
          compaction: {
            name: "compaction",
            mode: "primary",
            native: true,
            hidden: true,
            prompt: PROMPT_COMPACTION,
            permission: Permission.merge(
              defaults,
              user, // cssltdcode_change
              Permission.fromConfig({
                "*": "deny",
              }),
            ),
            options: {},
          },
          title: {
            name: "title",
            mode: "primary",
            options: {},
            native: true,
            hidden: true,
            temperature: 0.5,
            permission: Permission.merge(
              defaults,
              user, // cssltdcode_change
              Permission.fromConfig({
                "*": "deny",
              }),
            ),
            prompt: PROMPT_TITLE,
          },
          summary: {
            name: "summary",
            mode: "primary",
            options: {},
            native: true,
            hidden: true,
            permission: Permission.merge(
              defaults,
              user, // cssltdcode_change
              Permission.fromConfig({
                "*": "deny",
              }),
            ),
            prompt: PROMPT_SUMMARY,
          },
        }

        // cssltdcode_change start - rename build→code, add debug/orchestrator/ask, patch plan/explore
        CssltdAgent.patchAgents(agents, defaults, user, cfg, cssltd, ctx.worktree, whitelistedDirs)

        const agentConfigs = CssltdAgent.preprocessConfig(cfg.agent ?? {})
        for (const [key, value] of Object.entries(agentConfigs)) {
          // cssltdcode_change end
          if (value.disable) {
            delete agents[key]
            continue
          }
          let item = agents[key]
          if (!item)
            item = agents[key] = {
              name: key,
              mode: "all",
              permission: Permission.merge(defaults, user),
              options: {},
              native: false,
            }
          if (value.model) item.model = Provider.parseModel(value.model)
          item.variant = value.variant ?? item.variant
          item.prompt = value.prompt ?? item.prompt
          item.description = value.description ?? item.description
          item.temperature = value.temperature ?? item.temperature
          item.topP = value.top_p ?? item.topP
          item.mode = value.mode ?? item.mode
          item.color = value.color ?? item.color
          item.hidden = value.hidden ?? item.hidden
          item.name = value.name ?? item.name
          item.steps = value.steps ?? item.steps
          // cssltdcode_change start - carry metadata as typed fields, never as provider options
          item.displayName = value.displayName ?? item.displayName
          item.source = value.source ?? item.source
          item.requirements = value.requirements ?? item.requirements
          // cssltdcode_change end
          item.options = mergeDeep(item.options, value.options ?? {})
          item.permission = Permission.merge(item.permission, Permission.fromConfig(value.permission ?? {}))
          // cssltdcode_change start
          CssltdAgent.processConfigItem(item)
        }

        function referencePrompt(reference: CssltdReference.Resolved) {
          if (reference.kind === "local") {
            return [
              `You are configured reference @${reference.name}, a read-only research agent for external reference material.`,
              `Local directory: ${reference.path}`,
              `Inspect this directory as the primary reference source. Prefer repo_overview with path ${JSON.stringify(reference.path)} before broader searches. Do not edit files.`,
              `Return exact absolute file paths for findings whenever possible.`,
            ].join("\n\n")
          }

          if (reference.kind === "invalid") {
            return [
              `You are configured reference @${reference.name}, but this reference is not usable yet.`,
              `Configured repository: ${reference.repository}`,
              `Problem: ${reference.message}`,
              `Explain this configuration problem if invoked. Do not edit files or attempt fallback clones.`,
            ].join("\n\n")
          }

          return [
            `You are configured reference @${reference.name}, a read-only research agent for external reference material.`,
            `Repository: ${reference.repository}`,
            ...(reference.branch ? [`Branch/ref: ${reference.branch}`] : []),
            `Cached directory: ${reference.path}`,
            `Cssltd materializes this configured repository before use. Do not call repo_clone for this reference.`,
            `Inspect the cached directory as the primary reference source. Prefer repo_overview with path ${JSON.stringify(reference.path)} before broader searches, then use Glob, Grep, and Read inside that directory. Do not edit files.`,
            `Return exact absolute file paths for findings whenever possible.`,
          ].join("\n\n")
        }

        function referenceDescription(reference: CssltdReference.Resolved) {
          if (reference.kind === "local") return `Scout reference for local directory ${reference.path}`
          if (reference.kind === "git") return `Scout reference for repository ${reference.repository}`
          return `Invalid Scout reference for repository ${reference.repository}`
        }

        if (flags.experimentalScout) {
          const references = cfg.references ?? cfg.reference ?? {}
          const resolvedReferences = CssltdReference.resolveAll({
            references,
            directory: ctx.directory,
            worktree: ctx.worktree,
          })
          for (const resolved of resolvedReferences) {
            if (agents[resolved.name]) continue
            const localPath = resolved.kind === "invalid" ? undefined : resolved.path
            agents[resolved.name] = {
              name: resolved.name,
              description: referenceDescription(resolved),
              permission: Permission.merge(
                agents.scout.permission,
                Permission.fromConfig({
                  repo_clone: "deny",
                  ...(localPath
                    ? {
                        external_directory: {
                          [localPath]: "allow",
                          [path.join(localPath, "*")]: "allow",
                        },
                      }
                    : {}),
                }),
              ),
              prompt: referencePrompt(resolved),
              options: { reference: references[resolved.name], resolved },
              mode: "subagent",
              native: false,
            }
          }
        // cssltdcode_change end
        }

        // Ensure Truncate.GLOB is allowed unless explicitly configured
        for (const name in agents) {
          const agent = agents[name]
          const explicit = agent.permission.some((r) => {
            if (r.permission !== "external_directory") return false
            if (r.action !== "deny") return false
            return r.pattern === Truncate.GLOB
          })
          if (explicit) continue

          agents[name].permission = Permission.merge(
            agents[name].permission,
            Permission.fromConfig({ external_directory: { [Truncate.GLOB]: "allow" } }),
          )
        }

        CssltdAgent.hardenSystemAgents(agents) // cssltdcode_change - keep system utility agents deny-only after config merges

        const get = Effect.fnUntraced(function* (agent: string) {
          return agents[CssltdAgent.resolveKey(agent)] // cssltdcode_change - treat "build" as "code"
        })

        const list = Effect.fnUntraced(function* () {
          const cfg = yield* config.get()
          return pipe(
            agents,
            values(),
            sortBy(
              [(x) => (cfg.default_agent ? x.name === cfg.default_agent : x.name === "code"), "desc"], // cssltdcode_change - renamed from "build" to "code"
              [(x) => x.name, "asc"],
            ),
          )
        })

        const defaultInfo = Effect.fnUntraced(function* () {
          const c = yield* config.get()
          if (c.default_agent) {
            // cssltdcode_change start
            const effective = CssltdAgent.resolveKey(c.default_agent)
            const agent = agents[effective]
            // cssltdcode_change end
            if (!agent) throw new Error(`default agent "${c.default_agent}" not found`)
            if (agent.mode === "subagent") throw new Error(`default agent "${c.default_agent}" is a subagent`)
            if (agent.hidden === true) throw new Error(`default agent "${c.default_agent}" is hidden`)
            return agent
          }
          // cssltdcode_change start - prefer "code" as default agent (key order changes after rename from "build")
          const code = agents.code
          if (code && code.mode !== "subagent" && code.hidden !== true) return code
          // cssltdcode_change end
          const visible = Object.values(agents).find((a) => a.mode !== "subagent" && a.hidden !== true)
          if (!visible) throw new Error("no primary visible agent found")
          return visible
        })

        const defaultAgent = Effect.fnUntraced(function* () {
          return (yield* defaultInfo()).name
        })

        return {
          version: CssltdAgent.cacheKey(cfg), // cssltdcode_change
          get,
          list,
          defaultInfo,
          defaultAgent,
        } satisfies State
      }),
    )

    // cssltdcode_change start - rebuild cached agents when permission-relevant config changes
    const current = Effect.fnUntraced(function* <A>(select: (s: State) => Effect.Effect<A>) {
      const cfg = yield* config.get()
      const s = yield* InstanceState.get(state)
      if (s.version === CssltdAgent.cacheKey(cfg)) return yield* select(s)
      yield* InstanceState.invalidate(state)
      return yield* select(yield* InstanceState.get(state))
    })

    const requirementStatus = Effect.fn("Agent.requirementStatus")(function* (name: string) {
      const ctx = yield* InstanceState.context
      return yield* AgentRequirements.status({
        name,
        directory: ctx.directory,
        config,
        skills: skill,
        mcp,
        agents: { get: (agent) => current((s) => s.get(agent)) },
      })
    })

    const guardRequirements = Effect.fn("Agent.guardRequirements")(function* (agent: Info) {
      const ctx = yield* InstanceState.context
      yield* AgentRequirements.guard({
        agent,
        directory: ctx.directory,
        config,
        skills: skill,
        mcp,
        agents: { get: (name) => current((s) => s.get(name)) },
      })
    })
    // cssltdcode_change end

    return Service.of({
      get: Effect.fn("Agent.get")(function* (agent: string) {
        return yield* current((s) => s.get(agent)) // cssltdcode_change
      }),
      list: Effect.fn("Agent.list")(function* () {
        return yield* current((s) => s.list()) // cssltdcode_change
      }),
      defaultInfo: Effect.fn("Agent.defaultInfo")(function* () {
        return yield* current((s) => s.defaultInfo()) // cssltdcode_change
      }),
      defaultAgent: Effect.fn("Agent.defaultAgent")(function* () {
        return yield* current((s) => s.defaultAgent()) // cssltdcode_change
      }),
      // cssltdcode_change start
      requirementStatus,
      guardRequirements,
      // cssltdcode_change end
      generate: Effect.fn("Agent.generate")(function* (input: {
        description: string
        model?: { providerID: ProviderV2.ID; modelID: ModelV2.ID }
      }) {
        const cfg = yield* config.get()
        const model = input.model ?? (yield* provider.defaultModel())
        const resolved = yield* provider.getModel(model.providerID, model.modelID)
        const language = yield* provider.getLanguage(resolved)

        const system = [PROMPT_GENERATE]
        yield* plugin.trigger("experimental.chat.system.transform", { model: resolved }, { system })
        const existing = yield* InstanceState.useEffect(state, (s) => s.list())

        // TODO: clean this up so provider specific logic doesnt bleed over
        const authInfo = yield* auth.get(model.providerID).pipe(Effect.orDie)
        const isOpenaiOauth = model.providerID === "openai" && authInfo?.type === "oauth"

        const params = {
          // cssltdcode_change start - enable telemetry with custom PostHog tracer
          experimental_telemetry: CssltdAgent.telemetryOptions(cfg),
          // cssltdcode_change end
          temperature: 0.3,
          messages: [
            ...(isOpenaiOauth
              ? []
              : system.map(
                  (item): ModelMessage => ({
                    role: "system",
                    content: item,
                  }),
                )),
            {
              role: "user",
              content: `Create an agent configuration based on this request: "${input.description}".\n\nIMPORTANT: The following identifiers already exist and must NOT be used: ${existing.map((i) => i.name).join(", ")}\n  Return ONLY the JSON object, no other text, do not wrap in backticks`,
            },
          ],
          model: language,
          schema: Object.assign(
            Schema.toStandardSchemaV1(GeneratedAgent),
            Schema.toStandardJSONSchemaV1(GeneratedAgent),
          ),
        } satisfies Parameters<typeof generateObject>[0]

        if (isOpenaiOauth) {
          return yield* Effect.promise(async () => {
            const result = streamObject({
              ...params,
              providerOptions: ProviderTransform.providerOptions(resolved, {
                instructions: system.join("\n"),
                store: false,
              }),
              onError: () => {},
            })
            for await (const part of result.fullStream) {
              if (part.type === "error") throw part.error
            }
            return result.object
          })
        }

        return yield* Effect.promise(() => generateObject(params).then((r) => r.object))
      }),
    })
  }),
)

// cssltdcode_change start - preserve the concrete layer type across Cssltd's Agent/Skill cycle
export const defaultLayer: Layer.Layer<Service> = layer.pipe(
  // cssltdcode_change end
  Layer.provide(Plugin.defaultLayer),
  Layer.provide(Provider.defaultLayer),
  Layer.provide(Auth.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(Skill.defaultLayer),
  // cssltdcode_change start
  Layer.provide(MCP.defaultLayer),
  Layer.provide(RuntimeFlags.defaultLayer),
  // cssltdcode_change end
  Layer.provide(LocationServiceMap.layer),
)

const locationServiceMapNode = LayerNode.make(LocationServiceMap.layer, [])

export const node = LayerNode.make(layer, [
  Config.node,
  Auth.node,
  Plugin.node,
  Skill.node,
  Provider.node,
  // cssltdcode_change start
  MCP.node,
  RuntimeFlags.node,
  // cssltdcode_change end
  locationServiceMapNode,
])

export * as Agent from "./agent"
