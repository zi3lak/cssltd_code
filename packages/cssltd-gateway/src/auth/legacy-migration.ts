/**
 * Legacy Cssltd CLI migration module
 *
 * Migrates authentication from the legacy CSSLTD Code VS Code extension CLI
 * config path (~/.cssltdcode/cli/config.json) to the new auth.json format.
 */
import fs from "fs/promises"
import os from "os"
import path from "path"

export const LEGACY_CONFIG_PATH = path.join(os.homedir(), ".cssltdcode", "cli", "config.json")

interface LegacyProvider {
  id: string
  provider: string
  cssltdcodeToken?: string
  cssltdcodeModel?: string
  cssltdcodeOrganizationId?: string
}

interface LegacyConfig {
  providers?: LegacyProvider[]
}

interface LegacyCssltdAuth {
  token: string
  organizationId?: string
}

// Auth info types matching cssltdcode's Auth module
type ApiAuth = { type: "api"; key: string }
type OAuthAuth = { type: "oauth"; access: string; refresh: string; expires: number; accountId?: string }
type AuthInfo = ApiAuth | OAuthAuth

/**
 * Extract cssltd auth from legacy config
 */
function extractCssltdAuth(config: LegacyConfig): LegacyCssltdAuth | undefined {
  if (!config.providers) return undefined

  const provider = config.providers.find((p) => p.provider === "cssltdcode")
  if (!provider?.cssltdcodeToken) return undefined

  return {
    token: provider.cssltdcodeToken,
    organizationId: provider.cssltdcodeOrganizationId,
  }
}

/**
 * Migrate Cssltd authentication from legacy CLI config path.
 *
 * Checks ~/.cssltdcode/cli/config.json for existing cssltd credentials
 * and migrates them to the new auth.json format.
 *
 * @param hasCssltdAuth - Callback to check if cssltd auth already exists
 * @param saveCssltdAuth - Callback to save the migrated auth
 * @returns true if migration was performed, false otherwise
 */
export async function migrateLegacyCssltdAuth(
  hasCssltdAuth: () => Promise<boolean>,
  saveCssltdAuth: (auth: AuthInfo) => Promise<void>,
): Promise<boolean> {
  // Skip if cssltd auth already configured
  if (await hasCssltdAuth()) return false

  // Check if legacy config exists and parse it
  const content = await fs.readFile(LEGACY_CONFIG_PATH, "utf-8").catch(() => null)
  if (!content) return false

  let config: LegacyConfig | null = null
  try {
    config = JSON.parse(content) as LegacyConfig
  } catch {
    return false
  }

  // Extract cssltd auth from legacy config
  const legacy = extractCssltdAuth(config)
  if (!legacy) return false

  // Migrate to new format
  // Use OAuth format if organization ID present, otherwise API format
  if (legacy.organizationId) {
    await saveCssltdAuth({
      type: "oauth",
      access: legacy.token,
      refresh: "",
      expires: 0,
      accountId: legacy.organizationId,
    })
  } else {
    await saveCssltdAuth({
      type: "api",
      key: legacy.token,
    })
  }

  return true
}
