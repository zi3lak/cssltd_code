declare global {
  const CSSLTD_VERSION: string
  const CSSLTD_CHANNEL: string
  const CSSLTD_BUILD_KIND: string // cssltdcode_change
}

export const InstallationVersion = typeof CSSLTD_VERSION === "string" ? CSSLTD_VERSION : "local"
export const InstallationChannel = typeof CSSLTD_CHANNEL === "string" ? CSSLTD_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
// cssltdcode_change start - distinguish release builds from source / local builds
export const InstallationBuildKind: "source" | "release" =
  typeof CSSLTD_BUILD_KIND === "string" && CSSLTD_BUILD_KIND === "release" ? "release" : "source"
// cssltdcode_change end
