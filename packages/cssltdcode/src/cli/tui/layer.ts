import { run as runTui, type TuiInput } from "@cssltdcode/tui"
import { Global } from "@cssltdcode/core/global"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(Global.defaultLayer))
}
