import {
  GatewayError,
  fetchCloudSession,
  fetchCloudSessionForImport,
  fetchCssltdImageModels,
  getCloudSessions,
  getOrganizationId,
  getToken,
  importSessionToDb,
  normalizeClawStatus,
} from "@cssltdcode/cssltd-gateway"
import {
  HEADER_FEATURE,
  HEADER_ORGANIZATIONID,
  CSSLTD_API_BASE,
  CSSLTD_CHAT_URL,
  CSSLTD_EVENT_SERVICE_URL,
  clearModesCache,
  fetchBalance,
  fetchCssltdcodeNotifications,
  fetchCssltdPassState,
  fetchOrganizationModes,
  fetchProfile,
} from "@cssltdcode/cssltd-gateway"
import { DIRECT_FIM_ENV, requestMistralFim, resolveFimTarget } from "@cssltdcode/cssltd-gateway/fim"
import { DIRECT_EDIT_ENV, extractFencedBody, resolveEditTarget } from "@cssltdcode/cssltd-gateway/edit"
import { buildMercuryEditPrompt } from "@cssltdcode/cssltd-gateway/edit-prompt"
import { buildCssltdHeaders } from "@cssltdcode/cssltd-gateway"
import { Effect, Schema } from "effect"
import * as Stream from "effect/Stream"
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi"
import * as Log from "@cssltdcode/core/util/log"
import { Flag } from "@cssltdcode/core/flag/flag"
import { CssltdcodeConfig } from "@/cssltdcode/config/config"
import { Auth } from "@/auth"
import { EffectBridge } from "@/effect/bridge"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Identifier } from "@/id/id"
import { Instance } from "@/cssltdcode/instance"
import { InstanceStore } from "@/project/instance-store"
import { ModelCache } from "@/provider/model-cache"
import { InstanceHttpApi } from "@/server/routes/instance/httpapi/api"
import { MessageTable, PartTable, SessionTable } from "@cssltdcode/core/session/sql"
import { Session } from "@/session/session"
import { Database } from "@/storage/db"
import { Storage } from "@/storage/storage"
import { AudioTranscriptionsBody, ClawStatus, EditBody, FimBody } from "../groups/cssltd-gateway"
import { baseKey } from "../../../session-portability/cumulative-diff"
import { extractSessionDiffs, restoreSessionDiffs } from "../../../session-portability/session-diff-restore"

const FIM_TIMEOUT_MS = 30_000
const log = Log.create({ service: "cssltd-gateway" })

function jsonError(error: string, status: number) {
  return HttpServerResponse.jsonUnsafe({ error }, { status })
}

function logError(route: string, err: unknown) {
  log.error("unhandled error", { route, err })
}

export const cssltdGatewayHandlers = HttpApiBuilder.group(InstanceHttpApi, "cssltd", (handlers) =>
  Effect.gen(function* () {
    const auth = yield* Auth.Service
    const store = yield* InstanceStore.Service
    const cache = yield* ModelCache.Service
    const events = yield* EventV2Bridge.Service

    const profile = Effect.fn("CssltdGatewayHttpApi.profile")(function* () {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      if (!info || info.type !== "oauth") return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const currentOrgId = info.accountId ?? null
      const [profile, balance, cssltdPass] = yield* Effect.tryPromise({
        try: () =>
          Promise.all([
            fetchProfile(info.access),
            fetchBalance(info.access, currentOrgId ?? undefined),
            fetchCssltdPassState(info.access),
          ]),
        catch: () => new HttpApiError.BadRequest({}),
      })
      return { profile, balance, cssltdPass, currentOrgId }
    })

    const authStatus = Effect.fn("CssltdGatewayHttpApi.authStatus")(function* () {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      const type = getToken(info) && (info?.type === "api" || info?.type === "oauth") ? info.type : undefined
      if (!type) return { authenticated: false }
      return { authenticated: true, type }
    })

    const proxyAuth = Effect.fn("CssltdGatewayHttpApi.proxyAuth")(function* () {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      return {
        auth: info,
        token: getToken(info),
        organizationId: getOrganizationId(info),
      }
    })

    const modes = Effect.fn("CssltdGatewayHttpApi.modes")(function* () {
      const info = yield* auth.get("cssltd").pipe(Effect.catch(() => Effect.succeed(undefined)))
      if (!info || info.type !== "oauth" || !info.access || !info.accountId) return { modes: [] }

      const org = info.accountId
      return yield* Effect.promise(() => fetchOrganizationModes(info.access, org)).pipe(
        Effect.map((modes) => ({ modes })),
        Effect.catch(() => Effect.succeed({ modes: [] })),
      )
    })

    const fim = Effect.fn("CssltdGatewayHttpApi.fim")(function* (ctx: { payload: typeof FimBody.Type }) {
      const target = resolveFimTarget(ctx.payload.provider, ctx.payload.model)
      const info = target.provider === "cssltd" ? yield* proxyAuth() : undefined
      const token = yield* Effect.gen(function* () {
        if (target.provider === "cssltd") return info?.token
        const item = yield* auth.get(target.provider).pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
        if (item?.type === "api") return item.key
        return DIRECT_FIM_ENV[target.provider].map((key) => process.env[key]).find(Boolean)
      })

      if (target.provider === "cssltd" && !info?.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const request = yield* HttpServerRequest.HttpServerRequest
      const signal =
        request.source instanceof Request
          ? AbortSignal.any([request.source.signal, AbortSignal.timeout(FIM_TIMEOUT_MS)])
          : AbortSignal.timeout(FIM_TIMEOUT_MS)
      const response = yield* Effect.promise(async () => {
        try {
          const run = async (url: string): Promise<Response> => {
            console.info(`[FIM] request provider=${target.provider} model=${target.model} url=${url}`)
            return fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(target.provider === "cssltd"
                  ? buildCssltdHeaders(undefined, { cssltdcodeOrganizationId: info?.organizationId })
                  : {}),
                ...(target.provider === "cssltd" ? { [HEADER_FEATURE]: "autocomplete" } : {}),
              },
              signal,
              body: JSON.stringify({
                model: target.model,
                prompt: ctx.payload.prefix,
                suffix: ctx.payload.suffix,
                max_tokens: ctx.payload.maxTokens ?? 256,
                temperature: ctx.payload.temperature ?? 0.2,
                stream: true,
              }),
            })
          }
          if (target.provider === "mistral") return requestMistralFim(run)
          return run(target.url)
        } catch (err) {
          if (err instanceof DOMException && err.name === "TimeoutError")
            return Response.json({ error: "FIM request timed out" }, { status: 504 })
          if (signal.aborted) return Response.json({ error: "FIM request canceled" }, { status: 499 })
          throw err
        }
      })
      if (!response.ok) {
        const text = yield* Effect.promise(() => response.text())
        return HttpServerResponse.jsonUnsafe(
          { error: `FIM request failed: ${response.status} ${text}` },
          { status: response.status },
        )
      }
      if (!response.body) return HttpServerResponse.raw(null, { status: response.status })

      return HttpServerResponse.stream(
        Stream.fromReadableStream({
          evaluate: () => response.body!,
          onError: (err) => err,
        }),
        {
          contentType: "text/event-stream",
          headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        },
      )
    })

    const edit = Effect.fn("CssltdGatewayHttpApi.edit")(function* (ctx: { payload: typeof EditBody.Type }) {
      const target = resolveEditTarget(ctx.payload.provider, ctx.payload.model)
      if (target.provider === "cssltd" && !target.url) {
        return yield* Effect.fail(new HttpApiError.BadRequest({}))
      }
      const proxy = target.provider === "cssltd" ? yield* proxyAuth() : undefined
      const token = yield* Effect.gen(function* () {
        if (target.provider === "cssltd") return proxy?.token
        const item = yield* auth.get(target.provider).pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
        if (item?.type === "api") return item.key
        return DIRECT_EDIT_ENV[target.provider].map((key) => process.env[key]).find(Boolean)
      })
      if (target.provider === "cssltd" && !proxy?.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const request = yield* HttpServerRequest.HttpServerRequest
      const signal =
        request.source instanceof Request
          ? AbortSignal.any([request.source.signal, AbortSignal.timeout(FIM_TIMEOUT_MS)])
          : AbortSignal.timeout(FIM_TIMEOUT_MS)

      // Assemble the Mercury sentinel prompt from the structured context the
      // client sent — same builder every editor frontend shares.
      const content = buildMercuryEditPrompt({
        currentFilePath: ctx.payload.currentFilePath,
        currentFileContent: ctx.payload.currentFileContent,
        cursorLine: ctx.payload.cursorLine,
        cursorCharacter: ctx.payload.cursorCharacter,
        editableRegionStartLine: ctx.payload.editableRegionStartLine,
        editableRegionEndLine: ctx.payload.editableRegionEndLine,
        recentlyViewedSnippets: [...ctx.payload.recentlyViewedSnippets],
        editDiffHistory: [...ctx.payload.editDiffHistory],
      })

      const response = yield* Effect.promise(async () => {
        try {
          return await fetch(target.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
              ...(target.provider === "cssltd"
                ? buildCssltdHeaders(undefined, { cssltdcodeOrganizationId: proxy?.organizationId })
                : {}),
              ...(target.provider === "cssltd" ? { [HEADER_FEATURE]: "autocomplete" } : {}),
            },
            signal,
            body: JSON.stringify({
              model: target.model,
              max_tokens: ctx.payload.maxTokens ?? 512,
              // Mercury rejects role:"system" on this endpoint — must be a single user message.
              messages: [{ role: "user", content }],
            }),
          })
        } catch (err) {
          if (err instanceof DOMException && err.name === "TimeoutError")
            return Response.json({ error: "Edit request timed out" }, { status: 504 })
          if (signal.aborted) return Response.json({ error: "Edit request canceled" }, { status: 499 })
          throw err
        }
      })

      if (!response.ok) {
        // Pass the upstream status through (mirrors the FIM handler) so the
        // client can distinguish auth/credit/rate-limit/server failures
        // instead of collapsing everything to 400.
        const text = yield* Effect.promise(async () => {
          try {
            return await response.text()
          } catch {
            return "<unreadable>"
          }
        })
        return HttpServerResponse.jsonUnsafe(
          { error: `Edit request failed: ${response.status} ${text}` },
          { status: response.status },
        )
      }

      const json = yield* Effect.promise(
        () =>
          response.json() as Promise<{
            choices?: Array<{ message?: { content?: string } }>
            usage?: { prompt_tokens?: number; completion_tokens?: number }
          }>,
      )
      const raw = json.choices?.[0]?.message?.content ?? ""
      const body = extractFencedBody(raw)
      return {
        content: body,
        usage: json.usage
          ? {
              prompt_tokens: json.usage.prompt_tokens,
              completion_tokens: json.usage.completion_tokens,
            }
          : undefined,
      }
    })

    const audioTranscriptions = Effect.fn("CssltdGatewayHttpApi.audioTranscriptions")(function* (ctx: {
      payload: typeof AudioTranscriptionsBody.Type
    }) {
      const info = yield* proxyAuth()
      if (!info.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!info.token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const request = yield* HttpServerRequest.HttpServerRequest
      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(`${CSSLTD_API_BASE}/api/gateway/v1/audio/transcriptions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${info.token}`,
              ...buildCssltdHeaders(undefined, { cssltdcodeOrganizationId: info.organizationId }),
              [HEADER_FEATURE]: "vscode-extension",
            },
            signal: request.source instanceof Request ? request.source.signal : undefined,
            body: JSON.stringify(ctx.payload),
          }),
        catch: () => new HttpApiError.BadRequest({}),
      })
      const text = yield* Effect.promise(() => response.text())
      return HttpServerResponse.raw(text, {
        status: response.status,
        contentType: response.headers.get("Content-Type") ?? "application/json",
      })
    })

    const notifications = Effect.fn("CssltdGatewayHttpApi.notifications")(function* () {
      // Locally-detected notice about leftover cssltdcode config; appended so it reuses each client's dismissal path.
      const notice = CssltdcodeConfig.cssltdcodeConfigNotification({
        directory: Instance.directory,
        worktree: Instance.worktree,
        scanProject: !Flag.CSSLTD_DISABLE_PROJECT_CONFIG,
      })
      const append = <T>(list: T[]) => (notice ? [...list, notice] : list)

      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      const token = getToken(info)
      if (!token) return append([])

      const cloud = yield* Effect.promise(() =>
        fetchCssltdcodeNotifications({
          cssltdcodeToken: token,
          cssltdcodeOrganizationId: getOrganizationId(info),
        }),
      )
      return append(cloud)
    })

    const organization = Effect.fn("CssltdGatewayHttpApi.organization")(function* (ctx) {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      if (!info || info.type !== "oauth") return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      yield* auth
        .set("cssltd", {
          type: "oauth",
          refresh: info.refresh,
          access: info.access,
          expires: info.expires,
          ...(ctx.payload.organizationId && { accountId: ctx.payload.organizationId }),
        })
        .pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))

      yield* cache.clear("cssltd")
      clearModesCache()
      yield* store.disposeAll().pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      return true
    })

    const clawStatus = Effect.fn("CssltdGatewayHttpApi.clawStatus")(function* () {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.ServiceUnavailable({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      }
      const org = getOrganizationId(info)
      if (org) headers[HEADER_ORGANIZATIONID] = org

      return yield* Effect.tryPromise({
        try: async () => {
          const response = await fetch(`${CSSLTD_API_BASE}/api/cssltdclaw/status`, { headers })
          if (!response.ok) throw new GatewayError(await response.text(), response.status)
          return Schema.decodeUnknownPromise(ClawStatus)(normalizeClawStatus(await response.json()))
        },
        catch: (err) => err,
      }).pipe(
        Effect.match({
          onFailure: (err) => {
            if (err instanceof GatewayError)
              return jsonError(`CssltdClaw request failed: ${err.status} ${err.message}`, err.status)
            logError("claw/status", err)
            return jsonError("Failed to reach CssltdClaw", 502)
          },
          onSuccess: (result) => result,
        }),
      )
    })

    const clawChatCredentials = Effect.fn("CssltdGatewayHttpApi.clawChatCredentials")(function* () {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const expires = info?.type === "oauth" ? info.expires : Date.now() + 365 * 24 * 60 * 60 * 1000
      return {
        token,
        expiresAt: new Date(expires).toISOString(),
        cssltdChatUrl: CSSLTD_CHAT_URL,
        eventServiceUrl: CSSLTD_EVENT_SERVICE_URL,
      }
    })

    const cloudSessions = Effect.fn("CssltdGatewayHttpApi.cloudSessions")(function* (ctx) {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.BadRequest({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const query = {
        ...ctx.query,
        limit: ctx.query.limit === undefined ? undefined : Number(ctx.query.limit),
      }

      return yield* Effect.tryPromise({
        try: () => getCloudSessions(token, query),
        catch: (err) => err,
      }).pipe(
        Effect.match({
          onFailure: (err) => {
            if (err instanceof GatewayError) return jsonError(err.message, err.status)
            logError("cloud-sessions", err)
            return jsonError("Internal error", 500)
          },
          onSuccess: (result) => result,
        }),
      )
    })

    const cloudSession = Effect.fn("CssltdGatewayHttpApi.cloudSession")(function* (ctx) {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const result = yield* Effect.tryPromise({
        try: () => fetchCloudSession(token, ctx.params.id),
        catch: (err) => err,
      }).pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError("cloud/session/get", err)
            return undefined
          }),
        ),
      )
      if (!result) return jsonError("Internal error", 500)
      if (!result.ok) return jsonError(result.error, result.status)
      return result.data
    })

    const cloudSessionImport = Effect.fn("CssltdGatewayHttpApi.cloudSessionImport")(function* (ctx) {
      const info = yield* auth.get("cssltd").pipe(Effect.mapError(() => new HttpApiError.Unauthorized({})))
      const token = getToken(info)
      if (!token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const fetched = yield* Effect.tryPromise({
        try: () => fetchCloudSessionForImport(token, ctx.payload.sessionId),
        catch: (err) => err,
      }).pipe(
        Effect.catch((err) =>
          Effect.sync(() => {
            logError("cloud/session/import", err)
            return undefined
          }),
        ),
      )
      if (!fetched) return jsonError("Internal error", 500)
      if (!fetched.ok) return jsonError(fetched.error, fetched.status)
      if (!fetched.data?.info?.id) return yield* Effect.fail(new HttpApiError.BadRequest({}))

      const diffs = extractSessionDiffs(fetched.data)
      const bridge = yield* EffectBridge.make()
      return yield* Effect.tryPromise({
        try: () =>
          bridge.promise(
            Effect.gen(function* () {
              if (diffs.length > 0) {
                yield* Effect.try({
                  try: () => restoreSessionDiffs({ directory: Instance.directory, diffs }),
                  catch: (err) => err,
                }).pipe(
                  Effect.catch((err) =>
                    Effect.sync(() => {
                      logError("cloud/session/import/restore", err)
                      return undefined
                    }),
                  ),
                )
              }

              const imported = yield* Effect.sync(() =>
                importSessionToDb(fetched.data, {
                  Database,
                  Instance,
                  SessionTable,
                  MessageTable,
                  PartTable,
                  SessionToRow: Session.toRow,
                  Bus: {
                    publish: (_event, payload) => {
                      const info = (payload as { info: Session.Info }).info
                      return bridge.promise(events.publish(Session.Event.Created, { sessionID: info.id, info }))
                    },
                  },
                  SessionCreatedEvent: { type: Session.Event.Created.type, properties: Session.Event.Created.data },
                  Identifier,
                }),
              )

              if (diffs.length > 0) {
                yield* Storage.Service.use((storage) =>
                  Effect.all([
                    storage.write(baseKey(imported.id), diffs),
                    storage.write(["session_diff", imported.id], diffs),
                  ]),
                ).pipe(
                  Effect.catch((err) =>
                    Effect.sync(() => {
                      logError("cloud/session/import/diff", err)
                    }),
                  ),
                )
              }

              return imported
            }),
          ),
        catch: () => new HttpApiError.BadRequest({}),
      })
    })

    const imageModels = Effect.fn("CssltdGatewayHttpApi.imageModels")(function* () {
      const info = yield* proxyAuth()
      if (!info.auth) return yield* Effect.fail(new HttpApiError.Unauthorized({}))
      if (!info.token) return yield* Effect.fail(new HttpApiError.Unauthorized({}))

      const result = yield* Effect.tryPromise({
        try: () =>
          fetchCssltdImageModels({
            cssltdcodeToken: info.token,
            cssltdcodeOrganizationId: info.organizationId,
          }),
        catch: () => new HttpApiError.BadRequest({}),
      })

      if (result.error) {
        const err =
          result.error.kind === "unauthorized" ? new HttpApiError.Unauthorized({}) : new HttpApiError.BadRequest({})
        return yield* Effect.fail(err)
      }

      return result.models
    })

    return handlers
      .handle("profile", profile)
      .handle("authStatus", authStatus)
      .handle("modes", modes)
      .handle("fim", fim)
      .handle("edit", edit)
      .handle("audioTranscriptions", audioTranscriptions)
      .handle("imageModels", imageModels)
      .handle("notifications", notifications)
      .handle("organization", organization)
      .handle("clawStatus", clawStatus)
      .handle("clawChatCredentials", clawChatCredentials)
      .handle("cloudSessions", cloudSessions)
      .handle("cloudSession", cloudSession)
      .handle("cloudSessionImport", cloudSessionImport)
  }),
)
