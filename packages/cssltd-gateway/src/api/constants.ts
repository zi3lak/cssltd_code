/**
 * Cssltd Gateway Configuration Constants
 * Centralized configuration for all API endpoints, headers, and settings
 */

/** Environment variable for custom Cssltd API URL */
export const ENV_CSSLTD_API_URL = "CSSLTD_API_URL"

/** Default Cssltd API URL */
export const DEFAULT_CSSLTD_API_URL = "https://gateway.cssltd.internal"

/** Base URL for Cssltd API - can be overridden by CSSLTD_API_URL env var */
export const CSSLTD_API_BASE = process.env[ENV_CSSLTD_API_URL] || DEFAULT_CSSLTD_API_URL

/** Environment variable for custom Cssltd Chat URL */
export const CSSLTD_CHAT_URL_ENV = "CSSLTD_CHAT_URL"

/** Default Cssltd Chat URL (REST endpoint for messages, conversations, etc.) */
export const CSSLTD_DEFAULT_CHAT_URL = "https://chat.cssltdapps.io"

/** Base URL for Cssltd Chat - can be overridden by CSSLTD_CHAT_URL env var */
export const CSSLTD_CHAT_URL = process.env[CSSLTD_CHAT_URL_ENV] || CSSLTD_DEFAULT_CHAT_URL

/** Environment variable for custom Event Service URL */
export const CSSLTD_EVENT_SERVICE_URL_ENV = "EVENT_SERVICE_URL"

/** Default Event Service URL (WebSocket endpoint for cssltd-chat events) */
export const CSSLTD_DEFAULT_EVENT_SERVICE_URL = "wss://events.cssltdapps.io"

/** Base URL for Event Service - can be overridden by EVENT_SERVICE_URL env var */
export const CSSLTD_EVENT_SERVICE_URL = process.env[CSSLTD_EVENT_SERVICE_URL_ENV] || CSSLTD_DEFAULT_EVENT_SERVICE_URL

/** Default base URL for OpenRouter-compatible endpoint */
export const CSSLTD_OPENROUTER_BASE = `${CSSLTD_API_BASE}/api/openrouter`

/** Device auth polling interval in milliseconds */
export const POLL_INTERVAL_MS = 3000

/** Default model for authenticated users */
export const DEFAULT_MODEL = "cssltd-auto/free"

/** Default model for anonymous/free usage */
export const DEFAULT_FREE_MODEL = "cssltd-auto/free"

/** Token expiration duration in milliseconds (1 year) */
export const TOKEN_EXPIRATION_MS = 365 * 24 * 60 * 60 * 1000

/** User-Agent header base value for requests */
export const USER_AGENT_BASE = "cssltdcode-cssltd-provider"

/** Content-Type header value for requests */
export const CONTENT_TYPE = "application/json"

/** Default provider name */
export const DEFAULT_PROVIDER_NAME = "cssltd"

/** Default API key for anonymous requests */
export const ANONYMOUS_API_KEY = "anonymous"

/** Fetch timeout for model requests in milliseconds (10 seconds) */
export const MODELS_FETCH_TIMEOUT_MS = 10 * 1000

/**
 * Header constants for CssltdCode API requests
 */
export const HEADER_ORGANIZATIONID = "X-CSSLTDCODE-ORGANIZATIONID"
export const HEADER_TASKID = "X-CSSLTDCODE-TASKID"
export const HEADER_PARENT_TASKID = "X-CSSLTDCODE-PARENT-TASKID"
export const HEADER_PROJECTID = "X-CSSLTDCODE-PROJECTID"
export const HEADER_TESTER = "X-CSSLTDCODE-TESTER"
export const HEADER_EDITORNAME = "X-CSSLTDCODE-EDITORNAME"
export const HEADER_MACHINEID = "X-CSSLTDCODE-MACHINEID"

/** Default editor name value */
export const DEFAULT_EDITOR_NAME = "Cssltd CLI"

/** Environment variable name for custom editor name */
export const ENV_EDITOR_NAME = "CSSLTDCODE_EDITOR_NAME"

/** Environment variable name for version (set by CLI at startup) */
export const ENV_VERSION = "CSSLTDCODE_VERSION"

/** Tester header value for suppressing warnings */
export const TESTER_SUPPRESS_VALUE = "SUPPRESS"

/** Header name for feature tracking */
export const HEADER_FEATURE = "X-CSSLTDCODE-FEATURE"

/** Environment variable name for feature override */
export const ENV_FEATURE = "CSSLTDCODE_FEATURE"

export const PROMPTS = [
  "codex",
  "gemini",
  "beast",
  "anthropic",
  "trinity",
  "anthropic_without_todo",
  "ling",
  "gpt55",
] as const

export const AI_SDK_PROVIDERS = [
  "alibaba",
  "anthropic",
  "mistral",
  "openai",
  "openai-compatible",
  "openrouter",
] as const
