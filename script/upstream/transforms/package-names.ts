#!/usr/bin/env bun
/**
 * Transform package names and branding from cssltdcode to cssltd
 *
 * This script transforms:
 * - cssltdcode-ai -> @cssltdcode/cli
 * - @cssltdcode/cli -> @cssltdcode/cli
 * - @opencode-ai/sdk -> @cssltdcode/sdk
 * - @opencode-ai/plugin -> @cssltdcode/plugin
 * - CSSLTDCODE_* -> CSSLTD_* (env variables, excluding CSSLTDCODE_API_KEY)
 * - x-cssltdcode-* -> x-cssltd-* (HTTP headers)
 * - cssltdcode.db -> cssltd.db (database filename)
 * - window.__CSSLTDCODE__ -> window.__CSSLTD__ (window global)
 */

import { Glob } from "bun"
import { info, success } from "../utils/logger"
import { defaultConfig } from "../utils/config"

export interface TransformResult {
  file: string
  changes: number
  dryRun: boolean
}

export interface TransformOptions {
  dryRun?: boolean
  verbose?: boolean
}

const PACKAGE_PATTERNS = [
  // In package.json name field
  { pattern: /"name":\s*"cssltdcode-ai"/, replacement: '"name": "@cssltdcode/cli"' },
  { pattern: /"name":\s*"@cssltdcode-ai\/cli"/, replacement: '"name": "@cssltdcode/cli"' },

  // In dependencies/devDependencies
  { pattern: /"cssltdcode-ai":\s*"/g, replacement: '"@cssltdcode/cli": "' },
  { pattern: /"@cssltdcode-ai\/cli":\s*"/g, replacement: '"@cssltdcode/cli": "' },
  { pattern: /"@cssltdcode-ai\/sdk":\s*"/g, replacement: '"@cssltdcode/sdk": "' },
  { pattern: /"@cssltdcode-ai\/plugin":\s*"/g, replacement: '"@cssltdcode/plugin": "' },

  // In any string context (mock.module, dynamic references, etc.)
  // Only cli, sdk, and plugin are renamed — other @cssltdcode/* packages
  // (e.g. @cssltdcode/ui, @cssltdcode/util) keep their upstream names.
  { pattern: /@cssltdcode-ai\/cli(?=\/|"|'|`|$)/g, replacement: "@cssltdcode/cli" },
  { pattern: /@cssltdcode-ai\/sdk(?=\/|"|'|`|$)/g, replacement: "@cssltdcode/sdk" },
  { pattern: /@cssltdcode-ai\/plugin(?=\/|"|'|`|$)/g, replacement: "@cssltdcode/plugin" },

  // In import statements (supports subpaths like @opencode-ai/sdk/v2)
  { pattern: /from\s+["']cssltdcode-ai["']/g, replacement: 'from "@cssltdcode/cli"' },
  { pattern: /from\s+["']@cssltdcode-ai\/cli(\/[^"']*)?["']/g, replacement: 'from "@cssltdcode/cli$1"' },
  { pattern: /from\s+["']@cssltdcode-ai\/sdk(\/[^"']*)?["']/g, replacement: 'from "@cssltdcode/sdk$1"' },
  { pattern: /from\s+["']@cssltdcode-ai\/plugin(\/[^"']*)?["']/g, replacement: 'from "@cssltdcode/plugin$1"' },

  // In require statements (supports subpaths like @opencode-ai/sdk/v2)
  { pattern: /require\(["']cssltdcode-ai["']\)/g, replacement: 'require("@cssltdcode/cli")' },
  { pattern: /require\(["']@cssltdcode-ai\/cli(\/[^"']*)?["']\)/g, replacement: 'require("@cssltdcode/cli$1")' },
  { pattern: /require\(["']@cssltdcode-ai\/sdk(\/[^"']*)?["']\)/g, replacement: 'require("@cssltdcode/sdk$1")' },
  { pattern: /require\(["']@cssltdcode-ai\/plugin(\/[^"']*)?["']\)/g, replacement: 'require("@cssltdcode/plugin$1")' },

  // Internal placeholder hostname used for in-process RPC (never resolved by DNS)
  { pattern: /cssltdcode\.internal/g, replacement: "cssltd.internal" },

  // In npx/npm commands
  { pattern: /npx cssltdcode-ai/g, replacement: "npx @cssltdcode/cli" },
  { pattern: /npm install cssltdcode-ai/g, replacement: "npm install @cssltdcode/cli" },
  { pattern: /bun add cssltdcode-ai/g, replacement: "bun add @cssltdcode/cli" },

  // SDK public API renames (Cssltdcode → Cssltd)
  // Order matters: longer names first to avoid partial matches
  { pattern: /CssltdcodeClientConfig/g, replacement: "CssltdClientConfig" },
  { pattern: /createCssltdcodeClient/g, replacement: "createCssltdClient" },
  { pattern: /createCssltdcodeServer/g, replacement: "createCssltdServer" },
  { pattern: /createCssltdcodeTui/g, replacement: "createCssltdTui" },
  { pattern: /CssltdcodeClient/g, replacement: "CssltdClient" },
  // createCssltdcode (without suffix) needs negative lookahead to avoid matching createCssltdcodeClient
  { pattern: /\bcreateCssltdcode\b(?!Client|Server|Tui)/g, replacement: "createCssltd" },

  // Branding: environment variables (exclude CSSLTDCODE_API_KEY — upstream Zen SaaS key)
  { pattern: /\bCSSLTDCODE_(?!API_KEY\b)([A-Z_]+)\b/g, replacement: "CSSLTD_$1" },
  { pattern: /VITE_CSSLTDCODE_/g, replacement: "VITE_CSSLTD_" },
  { pattern: /_EXTENSION_CSSLTDCODE_/g, replacement: "_EXTENSION_CSSLTD_" },

  // Branding: HTTP header prefix
  { pattern: /x-cssltdcode-/g, replacement: "x-cssltd-" },

  // Branding: window global
  { pattern: /window\.__CSSLTDCODE__/g, replacement: "window.__CSSLTD__" },

  // Branding: database filename
  { pattern: /cssltdcode\.db/g, replacement: "cssltd.db" },
]

/**
 * Apply package name and branding transforms to content.
 */
export function applyPackageNameTransforms(input: string): { result: string; changes: number } {
  return PACKAGE_PATTERNS.reduce(
    (state, { pattern, replacement }) => {
      const regex = typeof pattern === "string" ? new RegExp(pattern, "g") : pattern
      regex.lastIndex = 0
      const count = (state.result.match(regex) || []).length
      regex.lastIndex = 0
      const result = state.result.replace(regex, replacement)
      if (result === state.result) return state
      return { result, changes: state.changes + count }
    },
    { result: input, changes: 0 },
  )
}

/**
 * Transform package names in a single file
 */
export async function transformFile(filePath: string, options: TransformOptions = {}): Promise<TransformResult> {
  const file = Bun.file(filePath)
  const input = await file.text()
  const { result, changes } = applyPackageNameTransforms(input)

  if (changes > 0 && !options.dryRun) {
    await Bun.write(filePath, result)
  }

  return {
    file: filePath,
    changes,
    dryRun: options.dryRun ?? false,
  }
}

/**
 * Transform package names in all relevant files
 */
export async function transformAll(options: TransformOptions = {}): Promise<TransformResult[]> {
  const results: TransformResult[] = []

  // Find all relevant files
  const patterns = ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json", "**/*.md"]

  const excludes = defaultConfig.excludePatterns

  for (const pattern of patterns) {
    const glob = new Glob(pattern)

    for await (const path of glob.scan({ absolute: true })) {
      // Skip excluded paths
      if (excludes.some((ex) => path.includes(ex.replace(/\*\*/g, "")))) {
        continue
      }

      const result = await transformFile(path, options)

      if (result.changes > 0) {
        results.push(result)

        if (options.dryRun) {
          info(`[DRY-RUN] Would transform ${result.file}: ${result.changes} changes`)
        } else {
          success(`Transformed ${result.file}: ${result.changes} changes`)
        }
      }
    }
  }

  return results
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const verbose = args.includes("--verbose")

  if (dryRun) {
    info("Running in dry-run mode (no files will be modified)")
  }

  const results = await transformAll({ dryRun, verbose })

  console.log()
  success(`Transformed ${results.length} files`)

  if (dryRun) {
    info("Run without --dry-run to apply changes")
  }
}
