import { MessageV2 } from "@/session/message-v2"

export namespace CssltdPartLifecycle {
  export const key = "cssltdcode.lifecycle"

  export function transient(part: MessageV2.Part) {
    return part.type === "text" && part.metadata?.[key] === "transient"
  }
}
