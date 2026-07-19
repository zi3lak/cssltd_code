export const Npm = {
  name: "@cssltdcode/cli",
  path: "@cssltdcode%2fcli",
}

export const Brew = {
  name: "cssltd",
  tap: "Cssltd-Org/tap",
  formula: "Cssltd-Org/tap/cssltd",
  api: "https://formulae.brew.sh/api/formula/cssltd.json",
}

export const Choco = {
  name: "cssltd",
  api: "https://community.chocolatey.org/api/v2/Packages?$filter=Id%20eq%20%27cssltd%27%20and%20IsLatestVersion&$select=Version",
}

export const Scoop = {
  name: "cssltd",
  manifest: "https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/cssltd.json",
}

export const Release = {
  install: "https://cssltd.ai/cli/install",
}
