import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@cssltdcode/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~cssltdcode/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~cssltdcode/WorkspaceRef", {
  defaultValue: () => undefined,
})
