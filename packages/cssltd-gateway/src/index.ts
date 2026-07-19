// ============================================================================
// Plugin
// ============================================================================
export { CssltdAuthPlugin, default } from "./plugin.js"

// ============================================================================
// Provider
// ============================================================================
export { createCssltd } from "./provider.js"
export { createCssltdDebug } from "./provider-debug.js"
export { cssltdCustomLoader } from "./loader.js"
export { buildCssltdHeaders, getEditorNameHeader, getFeatureHeader, getDefaultHeaders, getUserAgent } from "./headers.js"

// ============================================================================
// Auth
// ============================================================================
export { authenticateWithDeviceAuth } from "./auth/device-auth.js"
export { authenticateWithDeviceAuthTUI } from "./auth/device-auth-tui.js"
export { getCssltdUrlFromToken, isValidCssltdcodeToken, getApiKey } from "./auth/token.js"
export { poll, formatTimeRemaining } from "./auth/polling.js"
export { migrateLegacyCssltdAuth, LEGACY_CONFIG_PATH } from "./auth/legacy-migration.js"

// ============================================================================
// API
// ============================================================================
export {
  fetchProfile,
  fetchBalance,
  fetchProfileWithBalance,
  fetchDefaultModel,
  getCssltdProfile,
  defaultOrganizationId,
  getCssltdBalance,
  getCssltdDefaultModel,
  promptOrganizationSelection,
} from "./api/profile.js"
export { fetchCssltdPassState } from "./api/cssltd-pass.js"
export {
  fetchCssltdModels,
  type CssltdModelsResult,
  fetchCssltdImageModels,
  type CssltdImageModel,
  type CssltdImageModelsResult,
} from "./api/models.js"
export {
  EMPTY_CSSLTD_EMBEDDING_MODEL_CATALOG,
  fetchCssltdEmbeddingModelCatalog,
  type CssltdEmbeddingModel,
  type CssltdEmbeddingModelCatalog,
  type CssltdEmbeddingModelCatalogIssue,
} from "./api/embedding-models.js"
export { resolveCssltdGatewayBaseUrl, resolveCssltdOpenRouterBaseUrl } from "./api/url.js"
export {
  AUTOCOMPLETE_MODELS,
  DEFAULT_AUTOCOMPLETE_MODEL,
  getAutocompleteModel,
  getAutocompleteModelById,
  validAutocompleteModel,
  validAutocompleteProvider,
  type AutocompleteModelDef,
  type AutocompleteProviderID,
} from "./autocomplete.js"
export {
  fetchOrganizationModes,
  clearModesCache,
  type OrganizationMode,
  type OrganizationModeConfig,
} from "./api/modes.js"
export { fetchCssltdcodeNotifications, type CssltdcodeNotification } from "./api/notifications.js"
export { fetchCloudSession, fetchCloudSessionForImport, importSessionToDb } from "./cloud-sessions.js"

// ============================================================================
// Server Routes (optional - requires hono and CssltdCode dependencies)
// ============================================================================
export { createCssltdRoutes } from "./server/routes.js"
export {
  GatewayError,
  UnauthorizedError,
  getOrganizationId,
  getClawChatCredentials,
  getClawStatus,
  getCloudSessions,
  getNotifications,
  getProfile,
  getToken,
  normalizeClawStatus,
  setOrganization,
} from "./server/handlers.js"

// ============================================================================
// Note: TUI exports moved to separate entry point
// ============================================================================
// For TUI components and commands, import from "@cssltdcode/cssltd-gateway/tui"
// This avoids circular dependencies with cssltdcode TUI infrastructure

// ============================================================================
// Types
// ============================================================================
export type {
  // Auth types
  DeviceAuthInitiateResponse,
  DeviceAuthPollResponse,
  Organization,
  CssltdcodeProfile,
  CssltdcodeBalance,
  CssltdPassState,
  PollOptions,
  PollResult,
  // Provider types
  CssltdProvider,
  CssltdProviderOptions,
  CssltdMetadata,
  CustomLoaderResult,
  ProviderInfo,
  LanguageModelV3,
} from "./types.js"

// ============================================================================
// Constants
// ============================================================================
export {
  ENV_CSSLTD_API_URL,
  DEFAULT_CSSLTD_API_URL,
  CSSLTD_API_BASE,
  CSSLTD_CHAT_URL,
  CSSLTD_EVENT_SERVICE_URL,
  CSSLTD_OPENROUTER_BASE,
  POLL_INTERVAL_MS,
  DEFAULT_MODEL,
  DEFAULT_FREE_MODEL,
  TOKEN_EXPIRATION_MS,
  USER_AGENT_BASE,
  CONTENT_TYPE,
  DEFAULT_PROVIDER_NAME,
  ANONYMOUS_API_KEY,
  MODELS_FETCH_TIMEOUT_MS,
  HEADER_ORGANIZATIONID,
  HEADER_TASKID,
  HEADER_PARENT_TASKID,
  HEADER_PROJECTID,
  HEADER_TESTER,
  HEADER_EDITORNAME,
  HEADER_MACHINEID,
  HEADER_FEATURE,
  DEFAULT_EDITOR_NAME,
  ENV_EDITOR_NAME,
  ENV_VERSION,
  TESTER_SUPPRESS_VALUE,
  ENV_FEATURE,
  PROMPTS,
  AI_SDK_PROVIDERS,
} from "./api/constants.js"
