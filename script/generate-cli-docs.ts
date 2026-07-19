#!/usr/bin/env bun

import { $ } from "bun"

await $`bun run --conditions=browser ./src/cssltdcode/generate-cli-docs.ts`.cwd("packages/cssltdcode")
