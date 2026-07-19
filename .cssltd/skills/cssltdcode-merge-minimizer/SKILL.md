---
name: cssltdcode-merge-minimizer
description: Use when changing shared upstream-owned files to add Cssltd-specific behavior, editing `cssltdcode_change` markers in shared code, or moving additive behavior out of shared code to reduce upstream merge conflicts. Do not use for changes confined to Cssltd-owned paths such as `packages/cssltd-vscode/` or `packages/cssltd-ui/`.
---

# Cssltd Merge Minimizer

Use this skill whenever a normal development task touches shared upstream-owned code and includes Cssltd-specific behavior, especially for marker cleanup, extraction work, or `cssltdcode_change` annotations.

Do not use this skill when all changes are confined to Cssltd-owned paths, including `packages/cssltd-vscode/`, `packages/cssltd-ui/`, and paths with `cssltdcode` in their name. Those files are not merged from upstream and do not need merge-minimization guidance. If a task also touches shared upstream-owned code, use this skill for the shared portion only.

Do not use this as the primary guide for upstream merge resolution. Upstream merges have their own instructions and should not duplicate that workflow here.

## Goal

Minimize Cssltd's long-term diff against upstream CssltdCode while preserving behavior.

Prefer this shape for Cssltd-specific additions:

1. Shared upstream file contains only a minimal hook, import, call, registration, or config entry.
2. Cssltd-specific behavior lives in Cssltd-owned code.
3. Unavoidable shared-file changes have narrow `cssltdcode_change` markers.
4. The annotation checker passes.

For changes to existing upstream behavior, prefer the smallest in-place shared-file diff with narrow markers. Do not move changed upstream logic into Cssltd-owned code just to avoid textual conflicts, because that can create harder semantic merge conflicts.

## Core Rules

- Use `script/check-cssltdcode-annotations.ts` as the source of truth for current shared scopes and exempt paths.
- Use `script/upstream/fix-cssltdcode-markers.ts` for stale or broad markers, inspecting `--dry-run` output before applying changes.
- Treat upstream-owned files as shared unless the checker or repo ownership rules exempt them.
- Put Cssltd-owned UI, CLI, runtime logic, and tests in Cssltd-owned paths where practical.
- Avoid adding Cssltd business logic directly to shared files.
- Keep shared-file edits as close as possible to upstream shape.
- Do not change shared files unless the change is required for Cssltd functionality, fixes a Cssltd bug, or is a minimal targeted upstream-quality fix.
- Do not create a large Cssltd-only fork for a general upstream-quality improvement. Prefer a minimal targeted fix, or leave the broader change for upstream.
- Do not duplicate upstream logic unless there is a concrete reason. If duplication is unavoidable, isolate the Cssltd delta and keep the upstream dependency obvious.

## Shared File Structure

- Do not refactor, rename, split files, or extract helpers in shared files just to improve readability or make Cssltd extraction cleaner.
- Avoid structural changes that make upstream behavior harder to compare or hide semantic dependency on upstream code.

## Shared File Style

- Preserve upstream formatting and import style in shared files, even when it differs from Cssltd style.
- Put Cssltd-only imports on separate marked lines instead of reorganizing upstream imports.

## Decision Rules

Extract Cssltd logic when:

- The change is an additive Cssltd feature or integration, not a modification of existing upstream behavior.
- The shared-file change has meaningful Cssltd-owned behavior, not just a tiny condition, import, registration, or field.
- The code has loops, branching, error handling, async workflows, storage access, network calls, UI rendering, or telemetry.
- The shared file can become a small orchestrator that calls Cssltd helpers.
- The Cssltd code is independent enough that extraction will not hide future upstream fixes or behavior changes.

Keep the change inline when:

- The Cssltd delta is a single field, import, call, simple condition, or small registry entry.
- Extraction would reshape upstream code more than the Cssltd change itself.
- The change modifies an upstream algorithm, ordering, heuristic, control flow, or bug fix.
- Extraction would duplicate upstream logic or hide semantic dependency on upstream behavior.
- The Cssltd helper closes over upstream-local state. Keep closure-scoped helpers inline and contiguous in one narrow marker block.
- The shared file owns the only route table, enum, schema, switch, or registry where the hook must exist.
- The change restores upstream shape or removes a stale Cssltd divergence.

Always preserve upstream behavior order unless the Cssltd behavior change is intentional and tested.

## Marker Rules

- Mark only Cssltd-specific diff lines in shared upstream files.
- Prefer inline markers for single-line changes: `const value = 42 // cssltdcode_change`.
- Use block markers only for adjacent Cssltd-specific lines:

```ts
// cssltdcode_change start
registerCssltdFeature(app)
// cssltdcode_change end
```

- Use the file's native comment style, including JSX block comments inside JSX and `#` comments for YAML, TOML, and shell.
- Do not add markers in checker-exempt Cssltd-owned paths.
- Remove stale markers when upstream already contains the behavior or when touching Cssltd-owned files that still have old markers.
- Use `// cssltdcode_change - new file` only for unavoidable new Cssltd-specific files inside shared upstream paths.

## Tests

- Put Cssltd-specific CLI/runtime tests in Cssltd-owned test paths.
- Move tests out of shared upstream test paths when the behavior under test is Cssltd-specific.
- Tests should cover the real failing path, not private or unstable APIs chosen only for convenience.
- Do not add skip gates for required regression coverage.

## Verification

After editing shared files or marker comments, run:

```bash
bun run script/check-cssltdcode-annotations.ts
```

If the PR uses a non-default comparison base, pass the correct base ref:

```bash
bun run script/check-cssltdcode-annotations.ts --base <base-ref>
```

For stale or broad markers in one shared file, inspect the dry run before applying:

```bash
bun run script/upstream/fix-cssltdcode-markers.ts <repo-relative-file> --dry-run
```

Before finishing, confirm:

- Shared files contain minimal integration points only.
- Cssltd logic and tests live in Cssltd-owned paths where practical.
- Markers are narrow.
- Stale markers are removed.
- The annotation checker passed, or the reason it could not run is reported.
