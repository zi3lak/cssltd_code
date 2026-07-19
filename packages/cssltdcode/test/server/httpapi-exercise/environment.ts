import { Flag } from "@cssltdcode/core/flag/flag"
import { Effect } from "effect"
import path from "path"

const preserveExerciseGlobalRoot = !!process.env.CSSLTD_HTTPAPI_EXERCISE_GLOBAL
export const exerciseGlobalRoot =
  process.env.CSSLTD_HTTPAPI_EXERCISE_GLOBAL ??
  path.join(process.env.TMPDIR ?? "/tmp", `cssltdcode-httpapi-global-${process.pid}`)
process.env.XDG_DATA_HOME = path.join(exerciseGlobalRoot, "data")
process.env.XDG_CONFIG_HOME = path.join(exerciseGlobalRoot, "config")
process.env.XDG_STATE_HOME = path.join(exerciseGlobalRoot, "state")
process.env.XDG_CACHE_HOME = path.join(exerciseGlobalRoot, "cache")
process.env.CSSLTD_DISABLE_SHARE = "true"
process.env.CSSLTD_DISABLE_SESSION_INGEST = "true" // cssltdcode_change - isolate the exerciser from async Cssltd session sync
process.env.CSSLTD_DISABLE_PRESENCE = "1" // cssltdcode_change - presence now has a default Event Service URL; never open real sockets from the exerciser
export const exerciseConfigDirectory = path.join(exerciseGlobalRoot, "config", "cssltdcode")
export const exerciseDataDirectory = path.join(exerciseGlobalRoot, "data", "cssltd") // cssltdcode_change

const preserveExerciseDatabase = !!process.env.CSSLTD_HTTPAPI_EXERCISE_DB
export const exerciseDatabasePath =
  process.env.CSSLTD_HTTPAPI_EXERCISE_DB ??
  path.join(process.env.TMPDIR ?? "/tmp", `cssltdcode-httpapi-exercise-${process.pid}.db`)
process.env.CSSLTD_DB = exerciseDatabasePath
Flag.CSSLTD_DB = exerciseDatabasePath

export const original = {
  CSSLTD_SERVER_PASSWORD: Flag.CSSLTD_SERVER_PASSWORD,
  CSSLTD_SERVER_USERNAME: Flag.CSSLTD_SERVER_USERNAME,
}

export const cleanupExercisePaths = Effect.promise(async () => {
  const fs = await import("fs/promises")
  if (!preserveExerciseDatabase) {
    await Promise.all(
      [exerciseDatabasePath, `${exerciseDatabasePath}-wal`, `${exerciseDatabasePath}-shm`].map((file) =>
        fs.rm(file, { force: true }).catch(() => undefined),
      ),
    )
  }
  if (!preserveExerciseGlobalRoot)
    await fs.rm(exerciseGlobalRoot, { recursive: true, force: true }).catch(() => undefined)
})
