#!/usr/bin/env bun
// cssltdcode_change - new file

/**
 * Guards generated Cssltd config dependency artifacts.
 *
 * Cssltd loads project config from .cssltd/ and .cssltdcode/ and installs
 * @cssltdcode/plugin there at runtime. npm writes package.json, lockfiles,
 * .gitignore, and node_modules as generated local state. These paths must stay
 * untracked so background installs do not create recurring branch diffs.
 */

import { spawnSync } from "node:child_process"

const paths = [
  ".cssltd/.gitignore",
  ".cssltd/package.json",
  ".cssltd/package-lock.json",
  ".cssltd/pnpm-lock.yaml",
  ".cssltd/bun.lock",
  ".cssltd/yarn.lock",
  ".cssltd/node_modules",
  ".cssltdcode/.gitignore",
  ".cssltdcode/package.json",
  ".cssltdcode/package-lock.json",
  ".cssltdcode/pnpm-lock.yaml",
  ".cssltdcode/bun.lock",
  ".cssltdcode/yarn.lock",
  ".cssltdcode/node_modules",
]

const git = spawnSync("git", ["ls-files", "-z", "--", ...paths], { encoding: "utf8" })

if (git.status !== 0) {
  console.error(git.stderr.trim() || "git ls-files failed")
  process.exit(1)
}

const bad = git.stdout.split("\0").filter(Boolean).sort()

if (bad.length === 0) {
  console.log("check-cssltd-generated-artifacts: ok")
  process.exit(0)
}

console.error("Generated Cssltd config dependency artifacts are tracked:")
for (const file of bad) console.error(`  ${file}`)
console.error("")
console.error("These files are created by runtime dependency installs in .cssltd/ and .cssltdcode/.")
console.error("Remove them from git and keep them ignored.")
process.exit(1)
