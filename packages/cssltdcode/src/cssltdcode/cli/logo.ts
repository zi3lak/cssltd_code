// cssltdcode_change - new file
const yes = new Set(["1", "true", "yes", "on"])
const no = new Set(["0", "false", "no", "off"])

// Block-letter "CSSLTD" wordmark. The tui variant carries a soft shadow row
// (~ markers are styled by the logo renderer); plain/exit are raw-printable.
const modern = {
  tui: [
    `▄▀▀▀▄ ▄▀▀▀▀ ▄▀▀▀▀ █     ▀▀█▀▀ █▀▀▀▄ `,
    `█      ▀▀▀▄  ▀▀▀▄ █       █   █   █ `,
    `▀▄▄▄▀ ▀▄▄▄▀ ▀▄▄▄▀ █▄▄▄▄   █   █▄▄▄▀ `,
    ` ~~~   ~~~   ~~~  ~~~~~   ~   ~~~~  `,
  ],
  plain: [
    `▄▀▀▀▄ ▄▀▀▀▀ ▄▀▀▀▀ █     ▀▀█▀▀ █▀▀▀▄ `,
    `█      ▀▀▀▄  ▀▀▀▄ █       █   █   █ `,
    `▀▄▄▄▀ ▀▄▄▄▀ ▀▄▄▄▀ █▄▄▄▄   █   █▄▄▄▀ `,
  ],
  exit: [
    `  ▄▀▀▀▄ ▄▀▀▀▀ ▄▀▀▀▀ █     ▀▀█▀▀ █▀▀▀▄ `,
    `  █      ▀▀▀▄  ▀▀▀▄ █       █   █   █ `,
    `  ▀▄▄▄▀ ▀▄▄▄▀ ▀▄▄▄▀ █▄▄▄▄   █   █▄▄▄▀ `,
  ],
}

const fallback = {
  tui: [
    `█████ █████ █████ █     █████ ████  `,
    `█      ████  ████ █       █   █   █ `,
    `█████ █████ █████ █████   █   ████  `,
  ],
  plain: [
    `█████ █████ █████ █     █████ ████  `,
    `█      ████  ████ █       █   █   █ `,
    `█████ █████ █████ █████   █   ████  `,
  ],
  exit: [
    `  █████ █████ █████ █     █████ ████  `,
    `  █      ████  ████ █       █   █   █ `,
    `  █████ █████ █████ █████   █   ████  `,
  ],
}

function flag(value: string | undefined) {
  const key = value?.toLowerCase()
  if (!key) return
  if (yes.has(key)) return true
  if (no.has(key)) return false
}

function windows(env: NodeJS.ProcessEnv) {
  if (env.WT_SESSION) return true
  if (env.TERM_PROGRAM === "vscode") return true
  if (env.WEZTERM_PANE) return true
  if (env.TERM_PROGRAM === "WezTerm") return true
  return false
}

export function supports(env = process.env, platform = process.platform) {
  const override = flag(env.CSSLTD_UNICODE_LOGO)
  if (override !== undefined) return override
  if (env.TERM === "dumb") return false
  // Old Windows Console Host cannot render the half-block glyphs used by the modern logo.
  if (platform === "win32") return windows(env)
  if (env.ConEmuPID) return false
  if (env.ANSICON) return false
  return true
}

export function tui(env = process.env, platform = process.platform) {
  return supports(env, platform) ? modern.tui : fallback.tui
}

export function plain(env = process.env, platform = process.platform) {
  return supports(env, platform) ? modern.plain : fallback.plain
}

export function session(
  title: string,
  id: string | undefined,
  dim: string,
  normal: string,
  env = process.env,
  platform = process.platform,
) {
  const logo = supports(env, platform) ? modern.exit : fallback.exit
  return [``, `${logo[0]}${dim}${title}${normal}`, `${logo[1]}${dim}cssltd -s ${id}${normal}`, logo[2]].join("\n")
}
