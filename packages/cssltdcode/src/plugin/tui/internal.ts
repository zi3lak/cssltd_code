import { createBuiltinPlugins, type BuiltinTuiPlugin } from "@cssltdcode/tui/builtins"
import type { RuntimeFlags } from "@/effect/runtime-flags"
import { withCssltdTuiPlugins } from "@/cssltdcode/plugins/internal" // cssltdcode_change

export type InternalTuiPlugin = BuiltinTuiPlugin

// cssltdcode_change start
export function internalTuiPlugins(
  flags: Pick<RuntimeFlags.Info, "experimentalEventSystem" | "experimentalSessionSwitcher">,
): InternalTuiPlugin[] {
  return withCssltdTuiPlugins(
    createBuiltinPlugins({
      experimentalEventSystem: flags.experimentalEventSystem,
    }),
    flags,
  )
  // cssltdcode_change end
}
