#!/usr/bin/env bun
/**
 * Transform i18n translation files with Cssltd branding
 *
 * This script handles i18n files by:
 * 1. Taking upstream's version as the base (to get new translation keys)
 * 2. Applying intelligent string replacements for Cssltd branding
 * 3. Preserving lines marked with `// cssltdcode_change`
 *
 * String replacement rules:
 * - cssltdcode.ai -> cssltd.ai (domain)
 * - app.cssltdcode.ai -> app.cssltd.ai (app domain)
 * - CssltdCode -> Cssltd (product name in user-visible text)
 * - cssltdcode upgrade -> cssltd upgrade (CLI commands)
 * - npx cssltdcode -> npx cssltd (CLI invocation)
 * - anomalyco/cssltdcode -> Cssltd-Org/cssltdcode (GitHub repo)
 *
 * Preserved (not replaced):
 * - cssltdcode.json (actual config filename)
 * - .cssltdcode/ (actual directory name)
 * - Lines with `// cssltdcode_change`
 */

import { $ } from "bun"
import { Glob } from "bun"
import { info, success, warn, debug } from "../utils/logger"
import { defaultConfig } from "../utils/config"
import { oursHasCssltdcodeChanges } from "../utils/git"

export interface I18nTransformResult {
  file: string
  replacements: number
  preserved: number
  dryRun: boolean
  flagged?: boolean
}

export interface I18nTransformOptions {
  dryRun?: boolean
  verbose?: boolean
  patterns?: string[]
}

interface StringReplacement {
  pattern: RegExp
  replacement: string
  description: string
}

// Order matters! More specific patterns should come first
const I18N_REPLACEMENTS: StringReplacement[] = [
  // GitHub repo references
  {
    pattern: /github\.com\/anomalyco\/cssltdcode/g,
    replacement: "github.com/Cssltd-Org/cssltdcode",
    description: "GitHub URL",
  },
  {
    pattern: /anomalyco\/cssltdcode/g,
    replacement: "Cssltd-Org/cssltdcode",
    description: "GitHub repo reference",
  },

  // Domain replacements (specific first)
  {
    pattern: /app\.cssltdcode\.ai/g,
    replacement: "app.cssltd.ai",
    description: "App domain",
  },
  {
    pattern: /cssltdcode\.ai(?!\/zen)/g,
    replacement: "cssltd.ai",
    description: "Main domain (excluding zen)",
  },

  // CLI commands (be careful with order)
  {
    pattern: /npx cssltdcode(?!\w)/g,
    replacement: "npx cssltd",
    description: "npx command",
  },
  {
    pattern: /bun add cssltdcode(?!\w)/g,
    replacement: "bun add cssltd",
    description: "bun add command",
  },
  {
    pattern: /npm install cssltdcode(?!\w)/g,
    replacement: "npm install cssltd",
    description: "npm install command",
  },
  {
    pattern: /cssltdcode upgrade(?!\w)/g,
    replacement: "cssltd upgrade",
    description: "upgrade command",
  },
  {
    pattern: /cssltdcode dev(?!\w)/g,
    replacement: "cssltd dev",
    description: "dev command",
  },
  {
    pattern: /cssltdcode serve(?!\w)/g,
    replacement: "cssltd serve",
    description: "serve command",
  },
  {
    pattern: /cssltdcode auth(?!\w)/g,
    replacement: "cssltd auth",
    description: "auth command",
  },

  // Generic product name replacement (must come after specific patterns)
  // Only replace "CssltdCode" when it's a standalone word (not part of cssltdcode.json, etc.)
  {
    pattern: /\bCssltdCode\b(?!\.json|\/| Zen)/g,
    replacement: "Cssltd",
    description: "Product name",
  },

  // Environment variables (exclude CSSLTDCODE_API_KEY)
  {
    pattern: /\bCSSLTDCODE_(?!API_KEY\b)([A-Z_]+)\b/g,
    replacement: "CSSLTD_$1",
    description: "Environment variable",
  },
]

// Patterns that should NOT be replaced (preserved as-is)
const PRESERVE_PATTERNS = [
  /cssltdcode\.json/g, // Config filename
  /\.cssltdcode\//g, // Directory name
  /\.cssltdcode`/g, // Directory name in template strings
  /"\.cssltdcode"/g, // Directory name in quotes
  /'\.cssltdcode'/g, // Directory name in single quotes
]

/**
 * Check if a line should be preserved (has cssltdcode_change marker)
 */
function shouldPreserveLine(line: string): boolean {
  return line.includes("// cssltdcode_change")
}

/**
 * Apply string replacements to content, preserving cssltdcode_change lines
 */
export function transformI18nContent(
  content: string,
  verbose = false,
): { result: string; replacements: number; preserved: number } {
  const lines = content.split("\n")
  const transformedLines: string[] = []
  let totalReplacements = 0
  let preservedCount = 0

  for (const line of lines) {
    // Skip lines marked with cssltdcode_change
    if (shouldPreserveLine(line)) {
      transformedLines.push(line)
      preservedCount++
      if (verbose) debug(`Preserved line: ${line.trim().substring(0, 50)}...`)
      continue
    }

    let transformedLine = line
    let lineReplacements = 0

    // Check if line contains patterns that should be preserved entirely
    let hasPreservePattern = false
    for (const pattern of PRESERVE_PATTERNS) {
      if (pattern.test(line)) {
        hasPreservePattern = true
        // Reset the regex lastIndex
        pattern.lastIndex = 0
      }
    }

    // Apply replacements
    for (const { pattern, replacement, description } of I18N_REPLACEMENTS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0

      if (pattern.test(transformedLine)) {
        pattern.lastIndex = 0

        // Special handling: if line has preserve patterns, be more careful
        if (hasPreservePattern) {
          // Only replace if the match is not part of a preserve pattern
          // This is a simplified check - we replace and let preserve patterns win
        }

        const before = transformedLine
        transformedLine = transformedLine.replace(pattern, replacement)

        if (before !== transformedLine) {
          lineReplacements++
          if (verbose) debug(`  ${description}: "${before.trim()}" -> "${transformedLine.trim()}"`)
        }
      }
    }

    transformedLines.push(transformedLine)
    totalReplacements += lineReplacements
  }

  return {
    result: transformedLines.join("\n"),
    replacements: totalReplacements,
    preserved: preservedCount,
  }
}

/**
 * Transform a single i18n file
 */
export async function transformI18nFile(
  filePath: string,
  options: I18nTransformOptions = {},
): Promise<I18nTransformResult> {
  const file = Bun.file(filePath)
  const content = await file.text()

  const { result, replacements, preserved } = transformI18nContent(content, options.verbose)

  if (replacements > 0 && !options.dryRun) {
    await Bun.write(filePath, result)
  }

  return {
    file: filePath,
    replacements,
    preserved,
    dryRun: options.dryRun ?? false,
  }
}

/**
 * Check if a file is an i18n translation file
 */
export function isI18nFile(filePath: string, patterns?: string[]): boolean {
  const i18nPatterns = patterns || defaultConfig.i18nPatterns

  return i18nPatterns.some((pattern) => {
    // Convert glob pattern to regex
    const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*") + "$")
    return regex.test(filePath)
  })
}

/**
 * Transform all i18n files
 */
export async function transformAllI18n(options: I18nTransformOptions = {}): Promise<I18nTransformResult[]> {
  const results: I18nTransformResult[] = []
  const patterns = options.patterns || defaultConfig.i18nPatterns

  for (const pattern of patterns) {
    const glob = new Glob(pattern)

    for await (const path of glob.scan({ absolute: true })) {
      // Skip index.ts files (they're usually just exports)
      if (path.endsWith("/index.ts")) continue

      const result = await transformI18nFile(path, options)

      if (result.replacements > 0 || result.preserved > 0) {
        results.push(result)

        if (options.dryRun) {
          info(
            `[DRY-RUN] Would transform ${result.file}: ${result.replacements} replacements, ${result.preserved} preserved`,
          )
        } else if (result.replacements > 0) {
          success(`Transformed ${result.file}: ${result.replacements} replacements, ${result.preserved} preserved`)
        }
      }
    }
  }

  return results
}

/**
 * Transform i18n files that are in conflict during merge
 * Takes upstream version (theirs) and applies Cssltd branding
 */
export async function transformConflictedI18n(
  files: string[],
  options: I18nTransformOptions = {},
): Promise<I18nTransformResult[]> {
  const results: I18nTransformResult[] = []

  for (const file of files) {
    if (!isI18nFile(file)) {
      debug(`Skipping non-i18n file: ${file}`)
      continue
    }

    // If our version has cssltdcode_change markers, flag for manual resolution
    if (!options.dryRun && (await oursHasCssltdcodeChanges(file))) {
      warn(`${file} has cssltdcode_change markers — skipping auto-transform, needs manual resolution`)
      results.push({ file, replacements: 0, preserved: 0, dryRun: false, flagged: true })
      continue
    }

    // First, take upstream's version (theirs)
    if (!options.dryRun) {
      await $`git checkout --theirs ${file}`.quiet().nothrow()
      await $`git add ${file}`.quiet().nothrow()
    }

    // Then apply Cssltd branding transformations
    const result = await transformI18nFile(file, options)
    results.push(result)

    if (options.dryRun) {
      info(`[DRY-RUN] Would take upstream and transform ${file}: ${result.replacements} replacements`)
    } else if (result.replacements > 0) {
      success(`Transformed ${file}: took upstream + ${result.replacements} Cssltd branding replacements`)
    }
  }

  return results
}

// CLI entry point
if (import.meta.main) {
  const args = process.argv.slice(2)
  const dryRun = args.includes("--dry-run")
  const verbose = args.includes("--verbose")
  const conflicted = args.includes("--conflicted")

  // Get specific files if provided
  const files = args.filter((a) => !a.startsWith("--"))

  if (dryRun) {
    info("Running in dry-run mode (no files will be modified)")
  }

  let results: I18nTransformResult[]

  if (conflicted && files.length > 0) {
    results = await transformConflictedI18n(files, { dryRun, verbose })
  } else if (files.length > 0) {
    results = []
    for (const file of files) {
      const result = await transformI18nFile(file, { dryRun, verbose })
      results.push(result)
    }
  } else {
    results = await transformAllI18n({ dryRun, verbose })
  }

  const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0)
  const totalPreserved = results.reduce((sum, r) => sum + r.preserved, 0)

  console.log()
  success(`Processed ${results.length} files`)
  info(`Total replacements: ${totalReplacements}`)
  info(`Total preserved lines: ${totalPreserved}`)

  if (dryRun) {
    info("Run without --dry-run to apply changes")
  }
}
