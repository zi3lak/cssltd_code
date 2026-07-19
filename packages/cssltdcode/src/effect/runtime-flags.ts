import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("CSSLTD_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@cssltdcode/RuntimeFlags", {
  autoShare: bool("CSSLTD_AUTO_SHARE"),
  pure: bool("CSSLTD_PURE"),
  disableDefaultPlugins: bool("CSSLTD_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("CSSLTD_DISABLE_CHANNEL_DB"), // cssltdcode_change
  disableEmbeddedWebUi: bool("CSSLTD_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("CSSLTD_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("CSSLTD_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("CSSLTD_SKIP_MIGRATIONS"), // cssltdcode_change
  disableClaudeCodePrompt: Config.all({
    broad: bool("CSSLTD_DISABLE_CLAUDE_CODE"),
    direct: bool("CSSLTD_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("CSSLTD_DISABLE_CLAUDE_CODE"),
    direct: bool("CSSLTD_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("CSSLTD_ENABLE_EXA"),
    legacy: bool("CSSLTD_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("CSSLTD_ENABLE_PARALLEL"),
    legacy: bool("CSSLTD_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("CSSLTD_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("CSSLTD_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("CSSLTD_EXPERIMENTAL_SCOUT"), // cssltdcode_change
  experimentalReferences: enabledByExperimental("CSSLTD_EXPERIMENTAL_REFERENCES"),
  experimentalBackgroundSubagents: enabledByExperimental("CSSLTD_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("CSSLTD_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("CSSLTD_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("CSSLTD_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("CSSLTD_EXPERIMENTAL_PLAN_MODE"),
  experimentalEventSystem: enabledByExperimental("CSSLTD_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalSessionSwitcher: enabledByExperimental("CSSLTD_EXPERIMENTAL_SESSION_SWITCHER"), // cssltdcode_change
  experimentalWorkspaces: enabledByExperimental("CSSLTD_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("CSSLTD_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("CSSLTD_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("CSSLTD_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("CSSLTD_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("CSSLTD_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("CSSLTD_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.defaultLayer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const defaultLayer = Service.defaultLayer.pipe(Layer.orDie)

export const node = LayerNode.make(defaultLayer, [])

export * as RuntimeFlags from "./runtime-flags"
import { LayerNode } from "@cssltdcode/core/effect/layer-node"
