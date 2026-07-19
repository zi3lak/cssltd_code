import path from "path"
import * as Process from "./process"

export async function extractZip(zipPath: string, destDir: string) {
  if (process.platform === "win32") {
    const winZipPath = path.resolve(zipPath)
    const winDestDir = path.resolve(destDir)
    // $global:ProgressPreference suppresses PowerShell's blue progress bar popup
    // cssltdcode_change start - keep paths out of the PowerShell program
    const cmd =
      "$global:ProgressPreference = 'SilentlyContinue'; Expand-Archive -LiteralPath $env:CSSLTDCODE_ARCHIVE_PATH -DestinationPath $env:CSSLTDCODE_ARCHIVE_DESTINATION -Force"
    await Process.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd], {
      env: {
        CSSLTDCODE_ARCHIVE_PATH: winZipPath,
        CSSLTDCODE_ARCHIVE_DESTINATION: winDestDir,
      },
    })
    // cssltdcode_change end
    return
  }

  await Process.run(["unzip", "-o", "-q", zipPath, "-d", destDir])
}

export * as Archive from "./archive"
