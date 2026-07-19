import { fetchBalance, fetchProfile } from "../api/profile.js"
import { fetchCssltdPassState } from "../api/cssltd-pass.js"
import { fetchCssltdcodeNotifications } from "../api/notifications.js"
import { clearModesCache } from "../api/modes.js"
import { HEADER_ORGANIZATIONID, CSSLTD_API_BASE, CSSLTD_CHAT_URL, CSSLTD_EVENT_SERVICE_URL } from "../api/constants.js"
import type { CssltdcodeBalance, CssltdcodeProfile, CssltdPassState } from "../types.js"
import { buildCssltdHeaders } from "../headers.js"

export type CssltdAuth =
  | { type: "api"; key: string }
  | { type: "oauth"; access: string; refresh: string; expires: number; accountId?: string }
  | { type: "wellknown"; key: string; token: string }

export interface CssltdProfileResult {
  profile: CssltdcodeProfile
  balance: CssltdcodeBalance | null
  cssltdPass: CssltdPassState | null
  currentOrgId: string | null
}

export interface ClawChatCredentials {
  token: string
  expiresAt: string
  cssltdChatUrl: string
  eventServiceUrl: string
}

export interface AuthStore {
  get(provider: string): Promise<CssltdAuth | undefined>
  set(provider: string, auth: Extract<CssltdAuth, { type: "oauth" }>): Promise<void>
}

export interface OrganizationDeps {
  auth: AuthStore
  clear(): void | Promise<void>
  dispose(): Promise<void>
}

export interface CloudSessionsInput {
  cursor?: string
  limit?: number
  gitUrl?: string
}

export class UnauthorizedError extends Error {}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export function getToken(auth: CssltdAuth | undefined) {
  if (auth?.type === "api") return auth.key
  if (auth?.type === "oauth") return auth.access
  return undefined
}

export function getOrganizationId(auth: CssltdAuth | undefined) {
  if (auth?.type === "oauth") return auth.accountId
  return undefined
}

export async function getProfile(auth: AuthStore): Promise<CssltdProfileResult> {
  const info = await auth.get("cssltd")
  if (!info || info.type !== "oauth") throw new UnauthorizedError("Not authenticated with Cssltd Gateway")

  const currentOrgId = info.accountId ?? null
  const [profile, balance, cssltdPass] = await Promise.all([
    fetchProfile(info.access),
    fetchBalance(info.access, currentOrgId ?? undefined),
    fetchCssltdPassState(info.access),
  ])
  return { profile, balance, cssltdPass, currentOrgId }
}

export async function getNotifications(auth: AuthStore) {
  const info = await auth.get("cssltd")
  const token = getToken(info)
  if (!token) return []

  return fetchCssltdcodeNotifications({
    cssltdcodeToken: token,
    cssltdcodeOrganizationId: getOrganizationId(info),
  })
}

export async function setOrganization(deps: OrganizationDeps, organizationId: string | null) {
  const info = await deps.auth.get("cssltd")
  if (!info || info.type !== "oauth") throw new UnauthorizedError("Not authenticated with Cssltd Gateway")

  await deps.auth.set("cssltd", {
    type: "oauth",
    refresh: info.refresh,
    access: info.access,
    expires: info.expires,
    ...(organizationId && { accountId: organizationId }),
  })

  await deps.clear()
  clearModesCache()
  await deps.dispose()
  return true
}

export async function getClawStatus(auth: AuthStore) {
  const info = await auth.get("cssltd")
  const token = getToken(info)
  if (!token) throw new UnauthorizedError("No valid token found")

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }
  const org = getOrganizationId(info)
  if (org) headers[HEADER_ORGANIZATIONID] = org

  const response = await fetch(`${CSSLTD_API_BASE}/api/cssltdclaw/status`, { headers })
  if (!response.ok) throw new GatewayError(await response.text(), response.status)
  return normalizeClawStatus(await response.json())
}

function normalizeTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString()
  return value
}

export function normalizeClawStatus(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input

  const data = input as Record<string, unknown>
  return {
    ...data,
    ...("lastStartedAt" in data ? { lastStartedAt: normalizeTime(data.lastStartedAt) } : {}),
    ...("lastStoppedAt" in data ? { lastStoppedAt: normalizeTime(data.lastStoppedAt) } : {}),
  }
}

export async function getClawChatCredentials(auth: AuthStore): Promise<ClawChatCredentials> {
  const info = await auth.get("cssltd")
  const token = getToken(info)
  if (!token) throw new UnauthorizedError("No valid token found")

  const expires = info?.type === "oauth" ? info.expires : Date.now() + 365 * 24 * 60 * 60 * 1000
  return {
    token,
    expiresAt: new Date(expires).toISOString(),
    cssltdChatUrl: CSSLTD_CHAT_URL,
    eventServiceUrl: CSSLTD_EVENT_SERVICE_URL,
  }
}

export async function getCloudSessions(token: string, input: CloudSessionsInput) {
  const query: Record<string, unknown> = {}
  if (input.cursor) query.cursor = input.cursor
  if (input.limit) query.limit = input.limit
  if (input.gitUrl) query.gitUrl = input.gitUrl

  const params = new URLSearchParams({
    batch: "1",
    input: JSON.stringify({ "0": query }),
  })

  const response = await fetch(`${CSSLTD_API_BASE}/api/trpc/cliSessionsV2.list?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...buildCssltdHeaders(),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    console.error("[Cssltd Gateway] cloud-sessions: tRPC request failed", {
      status: response.status,
      body: text.slice(0, 500),
    })
    throw new GatewayError(`Cloud sessions fetch failed: ${response.status}`, response.status)
  }

  const raw = await response.text()
  const json = JSON.parse(raw)
  const data = Array.isArray(json) ? json[0]?.result?.data : null
  const result = data?.json ?? data
  if (!result) return { cliSessions: [], nextCursor: null }

  const cliSessions = (result.cliSessions ?? []).map((item: any) => ({
    session_id: item.session_id,
    title: item.title ?? null,
    created_at:
      typeof item.created_at === "string"
        ? item.created_at
        : item.created_at
          ? new Date(item.created_at).toISOString()
          : new Date().toISOString(),
    updated_at:
      typeof item.updated_at === "string"
        ? item.updated_at
        : item.updated_at
          ? new Date(item.updated_at).toISOString()
          : new Date().toISOString(),
    version: item.version ?? 0,
  }))

  return { cliSessions, nextCursor: result.nextCursor ?? null }
}
