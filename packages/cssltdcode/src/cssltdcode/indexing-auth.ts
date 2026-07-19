import type { IndexingConfig } from "@cssltdcode/cssltd-indexing/config"

type Auth = unknown

type Env = {
  CSSLTD_API_KEY?: string
  CSSLTD_ORG_ID?: string
}

type Provider = {
  key?: unknown
  options?: Record<string, unknown>
}

export type CssltdIndexingAuth = {
  apiKey?: string
  baseUrl?: string
  organizationId?: string
}

const providers = [
  "openai",
  "ollama",
  "openai-compatible",
  "gemini",
  "mistral",
  "vercel-ai-gateway",
  "bedrock",
  "openrouter",
  "voyage",
]

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return
  const trimmed = value.trim()
  return trimmed || undefined
}

function token(auth: Auth): string | undefined {
  const data = record(auth)
  if (data.type === "api") return text(data.key)
  if (data.type === "oauth") return text(data.access)
  return
}

function org(auth: Auth): string | undefined {
  const data = record(auth)
  if (data.type === "oauth") return text(data.accountId)
  return
}

function value(input: unknown): boolean {
  if (input === undefined || input === null) return false
  if (typeof input === "string") return input.trim().length > 0
  if (typeof input === "object") return Object.values(input).some(value)
  return true
}

function hasOtherProvider(indexing: unknown): boolean {
  const cfg = record(indexing)
  return providers.some((provider) => value(cfg[provider]))
}

export function resolveCssltdIndexingAuth(input: {
  config?: unknown
  provider?: Provider
  auth?: Auth
  env?: Env
}): CssltdIndexingAuth {
  const config = record(input.config)
  const options = record(record(config.provider).cssltd)
  const provider = input.provider ?? record(input.provider)
  const providerOptions = record(provider.options)
  const providerConfig = record(options.options)
  const cssltd = record(record(config.indexing).cssltd)
  const env = input.env ?? process.env

  return {
    apiKey:
      text(cssltd.apiKey) ??
      text(providerConfig.apiKey) ??
      token(input.auth) ??
      text(provider.key) ??
      text(providerOptions.cssltdcodeToken) ??
      text(env.CSSLTD_API_KEY),
    baseUrl: text(cssltd.baseUrl) ?? text(providerConfig.baseURL) ?? text(providerConfig.baseUrl),
    organizationId:
      text(cssltd.organizationId) ??
      text(providerConfig.cssltdcodeOrganizationId) ??
      org(input.auth) ??
      text(providerOptions.cssltdcodeOrganizationId) ??
      text(env.CSSLTD_ORG_ID),
  }
}

export function hasCssltdIndexingAuth(input: Parameters<typeof resolveCssltdIndexingAuth>[0]): boolean {
  return !!resolveCssltdIndexingAuth(input).apiKey
}

export function shouldDefaultIndexingToCssltd(indexing: unknown, auth: CssltdIndexingAuth): boolean {
  const cfg = record(indexing)
  if (cfg.provider !== undefined || !auth.apiKey) return false
  return !hasOtherProvider(cfg)
}

export function indexingWithCssltdDefault(
  indexing: IndexingConfig | undefined,
  auth: CssltdIndexingAuth,
): IndexingConfig | undefined {
  if (!shouldDefaultIndexingToCssltd(indexing, auth)) return indexing
  return { ...indexing, provider: "cssltd" }
}
