/// <reference path="../markdown.d.ts" />

export * as SkillPlugin from "./skill"

import { Effect } from "effect"
import { PluginV2 } from "../plugin"
import { AbsolutePath } from "../schema"
import { SkillV2 } from "../skill"
import customizeCssltdcodeContent from "./skill/customize-cssltdcode.md" with { type: "text" }

export const CustomizeCssltdcodeContent = customizeCssltdcodeContent

export const Plugin = PluginV2.define({
  id: PluginV2.ID.make("skill"),
  effect: Effect.gen(function* () {
    const skill = yield* SkillV2.Service
    const transform = yield* skill.transform()

    yield* transform((editor) => {
      editor.source(
        new SkillV2.EmbeddedSource({
          type: "embedded",
          skill: new SkillV2.Info({
            name: "customize-cssltdcode",
            description:
              "Use ONLY when the user is editing or creating cssltdcode's own configuration: cssltdcode.json, cssltdcode.jsonc, files under .cssltdcode/, or files under ~/.config/cssltdcode/. Also use when creating or fixing cssltdcode agents, subagents, skills, plugins, MCP servers, or permission rules. Do not use for the user's own application code, or for any project that is not configuring cssltdcode itself.",
            location: AbsolutePath.make("/builtin/customize-cssltdcode.md"),
            content: CustomizeCssltdcodeContent,
          }),
        }),
      )
    })
  }),
})
