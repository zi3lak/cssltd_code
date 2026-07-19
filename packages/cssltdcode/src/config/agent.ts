export * as ConfigAgent from "./agent"

import path from "path"
import * as Log from "@cssltdcode/core/util/log"
import { Exit, Schema } from "effect"
import { Glob } from "@cssltdcode/core/util/glob"
import { ConfigAgentV1 } from "@cssltdcode/core/v1/config/agent"
import { configEntryNameFromPath } from "./entry-name"
import * as ConfigMarkdown from "./markdown"
import { ConfigParse } from "./parse"
import { ConfigVariable } from "./variable" // cssltdcode_change
// cssltdcode_change start
import { ConfigErrorV1 as ConfigError, FrontmatterError } from "@cssltdcode/core/v1/config/error"
import { CssltdcodeConfig } from "@/cssltdcode/config/config"
import { report } from "@/cssltdcode/config/report"
import type { Warning } from "./config"
// cssltdcode_change end

const log = Log.create({ service: "config" })

// cssltdcode_change start - trusted gates {env:}; fileScope confines untrusted agent prompt {file:} reads
export async function load(
  dir: string,
  warnings?: Warning[],
  trusted = false,
  fileScope?: ConfigVariable.FileScope,
  sourceScope?: ConfigVariable.FileScope,
) {
  // cssltdcode_change end
  const result: Record<string, ConfigAgentV1.Info> = {}
  for (const item of await Glob.scan("{agent,agents}/**/*.md", {
    cwd: dir,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    // cssltdcode_change start
    const md = await ConfigMarkdown.parse(item, { trusted, fileScope, sourceScope }).catch(async (err) => {
      // cssltdcode_change end
      const message = FrontmatterError.isInstance(err)
        ? err.data.message
        : `Failed to parse agent ${item}`
      // cssltdcode_change start
      if (warnings) warnings.push({ path: item, message })
      try {
        const { capture } = await import("@/cssltdcode/instance")
        const ctx = capture()
        if (ctx) await report(ctx, message)
      } catch (error) {
        log.warn("could not publish session error", { message, err: error })
      }
      // cssltdcode_change end
      log.error("failed to load agent", { agent: item, err })
      return undefined
    })
    if (!md) continue

    const name = configEntryNameFromPath(path.relative(dir, item), ["agent/", "agents/"])

    // cssltdcode_change start - substitute agent prompt variables relative to the agent file. Project agents are
    // untrusted (no {env:}, {file:} confined to fileScope.root); a rejected substitution must skip only this
    // agent with a warning, not fail the whole config load, mirroring the frontmatter-parse handling above.
    const prompt = await ConfigVariable.substitute({
      text: md.content.trim(),
      type: "virtual",
      dir: path.dirname(item),
      source: item,
      missing: "empty",
      escapeJson: false,
      trusted,
      fileScope,
    }).catch((err): string | undefined => {
      const message =
        (ConfigError.InvalidError.isInstance(err) ? err.data.message : undefined) ??
        `Failed to substitute variables in agent ${item}`
      if (warnings) warnings.push({ path: item, message })
      log.error("failed to substitute agent prompt", { agent: item, err })
      return undefined
    })
    if (prompt === undefined) continue
    const config = {
      name,
      ...md.data,
      prompt,
    }
    // cssltdcode_change end
    // cssltdcode_change start - use Effect schema (propertyOrder: original) + non-fatal handleInvalid
    try {
      result[config.name] = ConfigParse.schema(ConfigAgentV1.Info, config, item)
    } catch (err) {
      if (ConfigError.InvalidError.isInstance(err)) {
        await CssltdcodeConfig.handleInvalid("agent", item, err.data.issues ?? [], err, warnings)
        continue
      }
      throw err
    }
    // cssltdcode_change end
  }
  return result
}

// cssltdcode_change start
export async function loadMode(
  dir: string,
  warnings?: Warning[],
  trusted = false,
  fileScope?: ConfigVariable.FileScope,
  sourceScope?: ConfigVariable.FileScope,
) {
  // cssltdcode_change end
  const result: Record<string, ConfigAgentV1.Info> = {}
  for (const item of await Glob.scan("{mode,modes}/*.md", {
    cwd: dir,
    absolute: true,
    dot: true,
    symlink: true,
  })) {
    // cssltdcode_change start
    const md = await ConfigMarkdown.parse(item, { trusted, fileScope, sourceScope }).catch(async (err) => {
      // cssltdcode_change end
      const message = FrontmatterError.isInstance(err)
        ? err.data.message
        : `Failed to parse mode ${item}`
      // cssltdcode_change start
      if (warnings) warnings.push({ path: item, message })
      try {
        const { capture } = await import("@/cssltdcode/instance")
        const ctx = capture()
        if (ctx) await report(ctx, message)
      } catch (error) {
        log.warn("could not publish session error", { message, err: error })
      }
      // cssltdcode_change end
      log.error("failed to load mode", { mode: item, err })
      return undefined
    })
    if (!md) continue

    const config = {
      name: configEntryNameFromPath(path.relative(dir, item), ["mode/", "modes/"]),
      ...md.data,
      prompt: md.content.trim(),
    }
    // cssltdcode_change start - use Effect schema (propertyOrder: original) + non-fatal handleInvalid
    try {
      result[config.name] = {
        ...ConfigParse.schema(ConfigAgentV1.Info, config, item),
        mode: "primary" as const,
      }
    } catch (err) {
      if (ConfigError.InvalidError.isInstance(err)) {
        await CssltdcodeConfig.handleInvalid("agent", item, err.data.issues ?? [], err, warnings)
        continue
      }
      throw err
    }
    // cssltdcode_change end
  }
  return result
}
