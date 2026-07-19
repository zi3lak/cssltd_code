import { BackgroundProcess } from "@/cssltdcode/background-process"
import { SessionID } from "@/session/schema"
import { Effect } from "effect"

export namespace CssltdTaskBackgroundProcess {
  export function finish(sessionID: SessionID) {
    return Effect.promise(() => BackgroundProcess.stopSession(sessionID)).pipe(Effect.ignore)
  }
}
