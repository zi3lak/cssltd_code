import type { BuiltinTuiPlugin } from "@cssltdcode/tui/builtins"
import HomeNews from "@/cssltdcode/plugins/home-news"
import HomeOnboarding from "@/cssltdcode/plugins/home-onboarding"
import Attention from "@/cssltdcode/plugins/attention"
import HomeFooter from "@/cssltdcode/plugins/home-footer"
import Permissions from "@/cssltdcode/plugins/permissions"
import SidebarFooter from "@/cssltdcode/plugins/sidebar-footer"
import MemoryStatus from "@/cssltdcode/plugins/memory-status"
import MemoryPalette from "@/cssltdcode/plugins/memory-palette"
import SidebarProcesses from "@/cssltdcode/plugins/sidebar-background-processes"
import SidebarIndexing from "@/cssltdcode/plugins/sidebar-indexing"
import SidebarPr from "@/cssltdcode/plugins/sidebar-pr"
import SidebarUsage from "@/cssltdcode/plugins/sidebar-usage"
import Sandbox from "@/cssltdcode/plugins/sandbox"
import Remote from "@/cssltdcode/plugins/remote"
import Reload from "@/cssltdcode/plugins/reload"
import SessionSwitcher from "@/cssltdcode/plugins/session-switcher"
import SessionV2Debug from "@/cssltdcode/plugins/session-v2-debug"
import type { RuntimeFlags } from "@/effect/runtime-flags"

const plugins = [
  HomeNews,
  HomeOnboarding,
  Attention,
  HomeFooter,
  Permissions,
  SidebarFooter,
  MemoryStatus,
  MemoryPalette,
  SidebarProcesses,
  SidebarIndexing,
  SidebarPr,
  SidebarUsage,
  Sandbox,
  Remote,
  Reload,
] satisfies BuiltinTuiPlugin[]

export function withCssltdTuiPlugins(
  builtins: BuiltinTuiPlugin[],
  flags: Pick<RuntimeFlags.Info, "experimentalEventSystem" | "experimentalSessionSwitcher">,
) {
  return [
    ...plugins,
    ...(flags.experimentalEventSystem ? [SessionV2Debug] : []),
    ...(flags.experimentalSessionSwitcher ? [SessionSwitcher] : []),
    ...builtins,
  ]
}
