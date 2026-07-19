import { $ } from "bun"
import semver from "semver"
import path from "path"

const rootPkgPath = path.resolve(import.meta.dir, "../../../package.json")
const rootPkg = await Bun.file(rootPkgPath).json()
const expectedBunVersion = rootPkg.packageManager?.split("@")[1]

if (!expectedBunVersion) {
  throw new Error("packageManager field not found in root package.json")
}

// relax version requirement
const expectedBunVersionRange = `^${expectedBunVersion}`

if (!semver.satisfies(process.versions.bun, expectedBunVersionRange)) {
  throw new Error(`This script requires bun@${expectedBunVersionRange}, but you are using bun@${process.versions.bun}`)
}
// cssltdcode_change start
const env = {
  CSSLTD_CHANNEL: process.env["CSSLTD_CHANNEL"],
  CSSLTD_BUMP: process.env["CSSLTD_BUMP"],
  CSSLTD_VERSION: process.env["CSSLTD_VERSION"],
  CSSLTD_RELEASE: process.env["CSSLTD_RELEASE"],
  CSSLTD_PRE_RELEASE: process.env["CSSLTD_PRE_RELEASE"],
}
// cssltdcode_change end
const CHANNEL = await (async () => {
  if (env.CSSLTD_CHANNEL) return env.CSSLTD_CHANNEL // cssltdcode_change
  // cssltdcode_change start - publish to "rc" channel for pre-releases
  if (env.CSSLTD_PRE_RELEASE === "true") return "rc"
  // cssltdcode_change end
  if (env.CSSLTD_BUMP) return "latest" // cssltdcode_change
  if (env.CSSLTD_VERSION && !env.CSSLTD_VERSION.startsWith("0.0.0-")) return "latest" // cssltdcode_change
  return await $`git branch --show-current`.text().then((x) => x.trim().replace(/[^0-9A-Za-z-]/g, "-")) // cssltdcode_change
})()
const IS_PREVIEW = CHANNEL !== "latest"

// cssltdcode_change start - shared helpers for version computation
function parseVersion(input: string) {
  const match = input.trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    value: `${match[1]}.${match[2]}.${match[3]}`,
  }
}

function compareVersion(
  a: NonNullable<ReturnType<typeof parseVersion>>,
  b: NonNullable<ReturnType<typeof parseVersion>>,
) {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}

async function fetchLatest() {
  const data: any = await fetch("https://registry.npmjs.org/@cssltdcode/cli/latest").then((res) => {
    if (!res.ok) throw new Error(res.statusText)
    return res.json()
  })
  return data.version as string
}

async function fetchHighest() {
  if (!process.env.GH_REPO) return fetchLatest()
  const data: { tagName: string }[] = await $`gh release list --json tagName --limit 100 --repo ${process.env.GH_REPO}`
    .json()
    .catch(() => [])
  const versions = data.flatMap((item) => {
    const version = parseVersion(item.tagName)
    if (!version) return []
    return [version]
  })
  const highest = versions.sort(compareVersion).at(-1)
  if (highest) return highest.value
  return fetchLatest()
}

function bumpVersion(current: string, type: string) {
  const version = parseVersion(current)
  if (!version) throw new Error(`Invalid version: ${current}`)
  if (type === "major") return `${version.major + 1}.0.0`
  if (type === "minor") return `${version.major}.${version.minor + 1}.0`
  return `${version.major}.${version.minor}.${version.patch + 1}`
}
// cssltdcode_change end

const VERSION = await (async () => {
  if (env.CSSLTD_VERSION) return env.CSSLTD_VERSION
  if (IS_PREVIEW) {
    // cssltdcode_change start - rc releases use plain semver required by VS Code Marketplace
    if (env.CSSLTD_BUMP && env.CSSLTD_PRE_RELEASE === "true") {
      const current = await fetchHighest()
      return bumpVersion(current, env.CSSLTD_BUMP.toLowerCase())
    }
    // cssltdcode_change end
    return `0.0.0-${CHANNEL}-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`
  }
  const version = await fetchHighest() // cssltdcode_change
  return bumpVersion(version, env.CSSLTD_BUMP?.toLowerCase() ?? "patch") // cssltdcode_change
})()

// cssltdcode_change start
const team = [
  "actions-user",
  "alexkgold",
  "arimesser",
  "arkadiykondrashov",
  "bturcotte520",
  "chrarnoldus",
  "codingelves",
  "dependabot[bot]",
  "dosire",
  "Drixled",
  "DScdng",
  "emilieschario",
  "eshurakov",
  "evanjacobson",
  "Helix-Cssltd",
  "iscekic",
  "jeanduplessis",
  "jobrietbergen",
  "johnnyeric",
  "jrf0110",
  "cssltd-code-bot",
  "cssltd-code-bot[bot]",
  "cssltd-maintainer[bot]",
  "cssltdcode-bot",
  "cssltdconnect-lite[bot]",
  "cssltdconnect[bot]",
  "kirillk",
  "lambertjosh",
  "marius-cssltdcode",
  "olearycrew",
  "pandemicsyn",
  "pedroheyerdahl",
  "RSO",
  "sbreitenother",
  "St0rmz1",
  "suhailkc2025",
]
// cssltdcode_change end

export const Script = {
  get channel() {
    return CHANNEL
  },
  get version() {
    return VERSION
  },
  get preview() {
    return IS_PREVIEW
  },
  get release(): boolean {
    return !!env.CSSLTD_RELEASE
  },
  get team() {
    return team
  },
}
console.log(`cssltd script`, JSON.stringify(Script, null, 2)) // cssltdcode_change
