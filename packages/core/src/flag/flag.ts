import { Config } from "effect"
import { InstallationChannel } from "../installation/version" // cssltdcode_change

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

// cssltdcode_change start
function falsy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "false" || value === "0"
}

const UNSTABLE_CHANNELS = new Set(["dev", "beta", "local"])
function unstableDefault(key: string) {
  return truthy(key) || (!falsy(key) && UNSTABLE_CHANNELS.has(InstallationChannel))
}

function number(key: string) {
  const value = process.env[key]
  if (!value) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

const CSSLTD_EXPERIMENTAL = truthy("CSSLTD_EXPERIMENTAL")
const CSSLTD_DISABLE_CLAUDE_CODE = truthy("CSSLTD_DISABLE_CLAUDE_CODE")
const CSSLTD_DISABLE_CLAUDE_CODE_SKILLS = CSSLTD_DISABLE_CLAUDE_CODE || truthy("CSSLTD_DISABLE_CLAUDE_CODE_SKILLS")
// cssltdcode_change end
const copy = process.env["CSSLTD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["CSSLTD_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("CSSLTD_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  CSSLTD_AUTO_SHARE: truthy("CSSLTD_AUTO_SHARE"), // cssltdcode_change
  CSSLTD_AUTO_HEAP_SNAPSHOT: truthy("CSSLTD_AUTO_HEAP_SNAPSHOT"),
  CSSLTD_GIT_BASH_PATH: process.env["CSSLTD_GIT_BASH_PATH"],
  CSSLTD_CONFIG: process.env["CSSLTD_CONFIG"],
  CSSLTD_CONFIG_CONTENT: process.env["CSSLTD_CONFIG_CONTENT"],
  CSSLTD_DISABLE_AUTOUPDATE: truthy("CSSLTD_DISABLE_AUTOUPDATE"),
  CSSLTD_ALWAYS_NOTIFY_UPDATE: truthy("CSSLTD_ALWAYS_NOTIFY_UPDATE"),
  CSSLTD_DISABLE_PRUNE: truthy("CSSLTD_DISABLE_PRUNE"),
  CSSLTD_DISABLE_TERMINAL_TITLE: truthy("CSSLTD_DISABLE_TERMINAL_TITLE"),
  CSSLTD_SHOW_TTFD: truthy("CSSLTD_SHOW_TTFD"),
  // cssltdcode_change start
  CSSLTD_DISABLE_DEFAULT_PLUGINS: truthy("CSSLTD_DISABLE_DEFAULT_PLUGINS"),
  CSSLTD_DISABLE_LSP_DOWNLOAD: truthy("CSSLTD_DISABLE_LSP_DOWNLOAD"),
  CSSLTD_ENABLE_EXPERIMENTAL_MODELS: truthy("CSSLTD_ENABLE_EXPERIMENTAL_MODELS"),
  // cssltdcode_change end
  CSSLTD_DISABLE_AUTOCOMPACT: truthy("CSSLTD_DISABLE_AUTOCOMPACT"),
  CSSLTD_DISABLE_MODELS_FETCH: truthy("CSSLTD_DISABLE_MODELS_FETCH"),
  CSSLTD_DISABLE_MOUSE: truthy("CSSLTD_DISABLE_MOUSE"),
  // cssltdcode_change start
  CSSLTD_DISABLE_CLAUDE_CODE,
  CSSLTD_DISABLE_CLAUDE_CODE_PROMPT: CSSLTD_DISABLE_CLAUDE_CODE || truthy("CSSLTD_DISABLE_CLAUDE_CODE_PROMPT"),
  CSSLTD_DISABLE_CLAUDE_CODE_SKILLS,
  CSSLTD_DISABLE_EXTERNAL_SKILLS: truthy("CSSLTD_DISABLE_EXTERNAL_SKILLS"),
  CSSLTD_EXPERIMENTAL_CUSTOMIZE_SKILL: unstableDefault("CSSLTD_EXPERIMENTAL_CUSTOMIZE_SKILL"),
  // cssltdcode_change end
  CSSLTD_FAKE_VCS: process.env["CSSLTD_FAKE_VCS"],
  CSSLTD_SERVER_PASSWORD: process.env["CSSLTD_SERVER_PASSWORD"],
  CSSLTD_SERVER_USERNAME: process.env["CSSLTD_SERVER_USERNAME"],
  CSSLTD_ENABLE_QUESTION_TOOL: truthy("CSSLTD_ENABLE_QUESTION_TOOL"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL, // cssltdcode_change

  CSSLTD_EXPERIMENTAL_FILEWATCHER: Config.boolean("CSSLTD_EXPERIMENTAL_FILEWATCHER").pipe(Config.withDefault(false)), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("CSSLTD_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),

  CSSLTD_EXPERIMENTAL_ICON_DISCOVERY: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_ICON_DISCOVERY"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("CSSLTD_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),

  CSSLTD_ENABLE_EXA: truthy("CSSLTD_ENABLE_EXA") || CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_EXA"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: number("CSSLTD_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_OUTPUT_TOKEN_MAX: number("CSSLTD_EXPERIMENTAL_OUTPUT_TOKEN_MAX"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_OXFMT: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_OXFMT"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_LSP_TY: truthy("CSSLTD_EXPERIMENTAL_LSP_TY"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_LSP_TOOL: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_LSP_TOOL"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_PLAN_MODE: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_PLAN_MODE"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_SCOUT: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_SCOUT"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_MARKDOWN: !falsy("CSSLTD_EXPERIMENTAL_MARKDOWN"), // cssltdcode_change

  CSSLTD_ENABLE_PARALLEL: truthy("CSSLTD_ENABLE_PARALLEL") || truthy("CSSLTD_EXPERIMENTAL_PARALLEL"), // cssltdcode_change

  CSSLTD_MODELS_URL: process.env["CSSLTD_MODELS_URL"],

  CSSLTD_MODELS_PATH: process.env["CSSLTD_MODELS_PATH"],

  CSSLTD_DISABLE_EMBEDDED_WEB_UI: truthy("CSSLTD_DISABLE_EMBEDDED_WEB_UI"), // cssltdcode_change

  CSSLTD_DB: process.env["CSSLTD_DB"],

  CSSLTD_DISABLE_CHANNEL_DB: truthy("CSSLTD_DISABLE_CHANNEL_DB"), // cssltdcode_change

  CSSLTD_SKIP_MIGRATIONS: truthy("CSSLTD_SKIP_MIGRATIONS"), // cssltdcode_change

  CSSLTD_STRICT_CONFIG_DEPS: truthy("CSSLTD_STRICT_CONFIG_DEPS"), // cssltdcode_change

  CSSLTD_WORKSPACE_ID: process.env["CSSLTD_WORKSPACE_ID"],

  CSSLTD_EXPERIMENTAL_WORKSPACES: enabledByExperimental("CSSLTD_EXPERIMENTAL_WORKSPACES"),

  CSSLTD_EXPERIMENTAL_EVENT_SYSTEM: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_EVENT_SYSTEM"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_SESSION_SWITCHING: CSSLTD_EXPERIMENTAL || truthy("CSSLTD_EXPERIMENTAL_SESSION_SWITCHING"), // cssltdcode_change

  CSSLTD_EXPERIMENTAL_SESSION_SWITCHER: enabledByExperimental("CSSLTD_EXPERIMENTAL_SESSION_SWITCHER"), // cssltdcode_change

  CSSLTD_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("CSSLTD_DISABLE_FFF"), // cssltdcode_change

  get CSSLTD_DISABLE_PROJECT_CONFIG() {
    return truthy("CSSLTD_DISABLE_PROJECT_CONFIG")
  },
  get CSSLTD_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("CSSLTD_EXPERIMENTAL_REFERENCES")
  },
  get CSSLTD_TUI_CONFIG() {
    return process.env["CSSLTD_TUI_CONFIG"]
  },
  get CSSLTD_CONFIG_DIR() {
    return process.env["CSSLTD_CONFIG_DIR"]
  },
  get CSSLTD_PURE() {
    return truthy("CSSLTD_PURE")
  },
  get CSSLTD_PERMISSION() {
    return process.env["CSSLTD_PERMISSION"]
  },
  get CSSLTD_PLUGIN_META_FILE() {
    return process.env["CSSLTD_PLUGIN_META_FILE"]
  },
  get CSSLTD_CLIENT() {
    return process.env["CSSLTD_CLIENT"] ?? "cli"
  },
  // cssltdcode_change start
  get CSSLTD_SESSION_RETRY_LIMIT() {
    return number("CSSLTD_SESSION_RETRY_LIMIT")
  },
  // cssltdcode_change end
}
