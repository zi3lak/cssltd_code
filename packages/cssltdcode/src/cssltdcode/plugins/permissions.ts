import type { TuiPlugin } from "@cssltdcode/plugin/tui"
import type { InternalTuiPlugin } from "@/plugin/tui/internal"
import { MemoryPermission } from "@/cssltdcode/cli/cmd/tui/permissions"

const id = "internal:cssltd-permissions"

const tui: TuiPlugin = async () => {
  MemoryPermission.register()
}

const plugin: InternalTuiPlugin = {
  id,
  tui,
}

export default plugin
