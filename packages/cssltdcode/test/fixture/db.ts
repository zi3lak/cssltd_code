import { rm } from "fs/promises"
import { Database } from "@cssltdcode/core/database/database"
import { disposeAllInstances } from "./fixture"

export async function resetDatabase() {
  // cssltdcode_change start
  // Never reset a disk-backed database because this helper can run without the test preload.
  const dbPath = Database.path()
  if (dbPath !== ":memory:") throw new Error(`Refusing to reset non-test database: ${dbPath}`)
  // cssltdcode_change end
  await disposeAllInstances().catch(() => undefined)
  await rm(dbPath, { force: true }).catch(() => undefined)
  await rm(`${dbPath}-wal`, { force: true }).catch(() => undefined)
  await rm(`${dbPath}-shm`, { force: true }).catch(() => undefined)
}
