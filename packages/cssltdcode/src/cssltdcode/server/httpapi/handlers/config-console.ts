import { Account } from "@/account/account"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import * as InstanceState from "@/effect/instance-state"
import { CssltdcodeConfigOverlay } from "@/cssltdcode/config/overlay"
import { CssltdcodeConfigSources } from "@/cssltdcode/config/sources"
import { CssltdcodeModelState } from "@/cssltdcode/config/model-state"
import { ConfigRules } from "@/cssltdcode/server/routes/config-rules"
import { CssltdcodeKeybinds } from "@/cssltdcode/tui/keybinds"
import { CssltdcodeTuiConfig } from "@/cssltdcode/tui/config"
import { disposeAllInstancesAndEmitGlobalDisposed } from "@/server/global-lifecycle"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"
import { markInstanceForDisposal } from "@/server/routes/instance/httpapi/lifecycle"
import { Effect, Option } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import {
  ConfigModelStatePatch,
  ConfigOverlayPatch,
  ConfigOverlayQuery,
  ConfigRulesPatch,
  TuiConfigPatch,
  TuiConfigQuery,
} from "../groups/config-console"

export const configConsoleHandlers = HttpApiBuilder.group(InstanceHttpApi, "config-console", (handlers) =>
  Effect.gen(function* () {
    const config = yield* Config.Service
    const auth = yield* Auth.Service
    const account = yield* Account.Service

    const overlay = Effect.fn("ConfigConsoleHttpApi.overlay")(function* (ctx: {
      query: typeof ConfigOverlayQuery.Type
    }) {
      const instance = yield* InstanceState.context
      const all = yield* auth.all().pipe(Effect.orElseSucceed(() => ({})))
      const active = yield* account.active().pipe(
        Effect.map(Option.getOrUndefined),
        Effect.orElseSucceed(() => undefined),
      )
      const [base, global, sources] = yield* Effect.all(
        [
          config.get(),
          config.getGlobal(),
          Effect.promise(() =>
            CssltdcodeConfigSources.list({
              directory: instance.directory,
              worktree: instance.worktree,
              auth: all,
              account: active,
            }),
          ),
        ],
        { concurrency: 3 },
      )
      return yield* Effect.promise(() =>
        CssltdcodeConfigOverlay.resolve({
          directory: instance.directory,
          worktree: instance.worktree,
          scope: ctx.query.scope ?? "project",
          effective: base,
          global,
          sources: sources.sources,
        }),
      )
    })

    const overlayUpdate = Effect.fn("ConfigConsoleHttpApi.overlayUpdate")(function* (ctx: {
      payload: typeof ConfigOverlayPatch.Type
    }) {
      const body = {
        ...ctx.payload,
        scope: ctx.payload.scope ?? "project",
        set: ctx.payload.set ? { ...ctx.payload.set } : undefined,
        unset: ctx.payload.unset?.map((item) => [...item]),
      }
      const patch = CssltdcodeConfigOverlay.patch(body)
      if (Object.keys(patch).length === 0) {
        if (body.scope === "global") return yield* config.getGlobal()
        return yield* config.get()
      }
      if (body.scope === "global") {
        const hot = Object.keys(patch).every((key) => key === "console")
        const result = yield* config.updateGlobal(patch, hot ? { dispose: false } : undefined)
        if (result.changed && !hot) {
          yield* disposeAllInstancesAndEmitGlobalDisposed({ swallowErrors: true }).pipe(
            Effect.catchCause(() => Effect.void),
          )
        }
        return result.info
      }
      yield* config.update(patch)
      yield* markInstanceForDisposal(yield* InstanceState.context)
      return yield* config.get()
    })

    const sources = Effect.fn("ConfigConsoleHttpApi.sources")(function* () {
      const instance = yield* InstanceState.context
      const all = yield* auth.all().pipe(Effect.orElseSucceed(() => ({})))
      const active = yield* account.active().pipe(
        Effect.map(Option.getOrUndefined),
        Effect.orElseSucceed(() => undefined),
      )
      return yield* Effect.promise(() =>
        CssltdcodeConfigSources.list({
          directory: instance.directory,
          worktree: instance.worktree,
          auth: all,
          account: active,
        }),
      )
    })

    const effective = Effect.fn("ConfigConsoleHttpApi.effective")(function* () {
      return yield* config.get()
    })

    const rules = Effect.fn("ConfigConsoleHttpApi.rules")(function* () {
      const instance = yield* InstanceState.context
      return yield* Effect.promise(() =>
        ConfigRules.read({ directory: instance.directory, worktree: instance.worktree }),
      )
    })

    const rulesUpdate = Effect.fn("ConfigConsoleHttpApi.rulesUpdate")(function* (ctx: {
      payload: typeof ConfigRulesPatch.Type
    }) {
      const instance = yield* InstanceState.context
      return yield* Effect.promise(() =>
        ConfigRules.update({
          directory: instance.directory,
          worktree: instance.worktree,
          content: ctx.payload.content,
        }),
      )
    })

    const modelState = Effect.fn("ConfigConsoleHttpApi.modelState")(function* () {
      return yield* Effect.promise(() => CssltdcodeModelState.get())
    })

    const modelStateUpdate = Effect.fn("ConfigConsoleHttpApi.modelStateUpdate")(function* (ctx: {
      payload: typeof ConfigModelStatePatch.Type
    }) {
      return yield* Effect.promise(() =>
        CssltdcodeModelState.update({ favorite: ctx.payload.favorite?.map((item) => ({ ...item })) }),
      )
    })

    const tuiConfigGet = Effect.fn("ConfigConsoleHttpApi.tuiConfigGet")(function* () {
      const instance = yield* InstanceState.context
      return yield* Effect.promise(() => CssltdcodeTuiConfig.get({ directory: instance.directory }))
    })

    const tuiKeybindList = Effect.fn("ConfigConsoleHttpApi.tuiKeybindList")(function* () {
      return { keybinds: CssltdcodeKeybinds.list() }
    })

    const tuiConfigUpdate = Effect.fn("ConfigConsoleHttpApi.tuiConfigUpdate")(function* (ctx: {
      query: typeof TuiConfigQuery.Type
      payload: typeof TuiConfigPatch.Type
    }) {
      const instance = yield* InstanceState.context
      const patch = {
        ...ctx.payload,
        keybinds: ctx.payload.keybinds ? { ...ctx.payload.keybinds } : undefined,
        plugin: ctx.payload.plugin?.map((item) => {
          if (!Array.isArray(item)) return item
          return [item[0], { ...item[1] }] as [string, { readonly [x: string]: unknown }]
        }),
        plugin_enabled: ctx.payload.plugin_enabled ? { ...ctx.payload.plugin_enabled } : undefined,
      }
      return yield* Effect.promise(() =>
        CssltdcodeTuiConfig.update({
          directory: instance.directory,
          worktree: instance.worktree,
          scope: ctx.query.scope ?? "project",
          patch,
        }),
      )
    })

    return handlers
      .handle("overlay", overlay)
      .handle("overlayUpdate", overlayUpdate)
      .handle("sources", sources)
      .handle("effective", effective)
      .handle("rules", rules)
      .handle("rulesUpdate", rulesUpdate)
      .handle("modelState", modelState)
      .handle("modelStateUpdate", modelStateUpdate)
      .handle("tuiConfigGet", tuiConfigGet)
      .handle("tuiKeybindList", tuiKeybindList)
      .handle("tuiConfigUpdate", tuiConfigUpdate)
  }),
)
