import * as Log from "@cssltdcode/core/util/log"
import { InstallationBuildKind } from "@cssltdcode/core/installation/version"

export namespace CssltdLog {
  export function init() {
    const value = process.env.CSSLTD_LOG_LEVEL?.toUpperCase()
    const level: Log.Level =
      value === "DEBUG" || value === "INFO" || value === "WARN" || value === "ERROR"
        ? value
        : InstallationBuildKind === "release"
          ? "INFO"
          : "DEBUG"
    return Log.init({
      print: process.env.CSSLTD_PRINT_LOGS === "1",
      dev: InstallationBuildKind !== "release",
      level,
    })
  }
}
