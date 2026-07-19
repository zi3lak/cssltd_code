import { LayerNode } from "@cssltdcode/core/effect/layer-node"
import { Cause, Duration, Effect, Layer, Schedule, Schema, Semaphore, Context } from "effect"
import { Struct } from "effect" // cssltdcode_change
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import { formatPatch, structuredPatch } from "diff"
import path from "path"
import { AppProcess } from "@cssltdcode/core/process"
import { InstanceState } from "@/effect/instance-state"
import { FSUtil } from "@cssltdcode/core/fs-util"
import { Hash } from "@cssltdcode/core/util/hash"
import { EffectFlock } from "@cssltdcode/core/util/effect-flock" // cssltdcode_change
import { Config } from "@/config/config"
import { Global } from "@cssltdcode/core/global"
// cssltdcode_change start
import { Flag } from "@cssltdcode/core/flag/flag"
import { DiffFull } from "../cssltdcode/snapshot/diff-full"
import { CssltdSnapshotTrack } from "../cssltdcode/snapshot/track"
import { CssltdSnapshotSeed } from "../cssltdcode/snapshot/seed"
import { CssltdSnapshotMaterialize } from "../cssltdcode/snapshot/materialize"
import type { MessageID, SessionID } from "../session/schema"
import { withStatics } from "@cssltdcode/core/schema"
import { zod } from "@cssltdcode/core/effect-zod"
// cssltdcode_change end

export const Patch = Schema.Struct({
  hash: Schema.String,
  files: Schema.mutable(Schema.Array(Schema.String)),
}).pipe(withStatics((s) => ({ zod: zod(s) }))) // cssltdcode_change
export type Patch = typeof Patch.Type

export const FileDiff = Schema.Struct({
  // Optional because legacy/imported `summary_diffs` on disk may omit
  // file details and patch text. Required Schema rejected the whole
  // session response and broke session loading on Desktop.
  file: Schema.optional(Schema.String),
  patch: Schema.optional(Schema.String),
  additions: Schema.Finite,
  deletions: Schema.Finite,
  status: Schema.optional(Schema.Literals(["added", "deleted", "modified"])),
  // cssltdcode_change start
})
  .annotate({ identifier: "SnapshotFileDiff" })
  .pipe(withStatics((s) => ({ zod: zod(s) })))
// cssltdcode_change end
export type FileDiff = typeof FileDiff.Type

// cssltdcode_change start - lightweight FileDiff without patch for session summaries
export const SummaryFileDiff = FileDiff.mapFields(Struct.omit(["patch"]))
  .annotate({ identifier: "SnapshotSummaryFileDiff" })
  .pipe(withStatics((s) => ({ zod: zod(s) })))
export type SummaryFileDiff = typeof SummaryFileDiff.Type
// cssltdcode_change end

const prune = "7.days"
const retention = 7 * 24 * 60 * 60 * 1000 // cssltdcode_change
const limit = 2 * 1024 * 1024
const core = ["-c", "core.longpaths=true", "-c", "core.symlinks=true"]
const cfg = ["-c", "core.autocrlf=false", ...core]
const quote = [...cfg, "-c", "core.quotepath=false"]
interface GitResult {
  readonly code: ChildProcessSpawner.ExitCode
  readonly text: string
  readonly stderr: string
}

export const MAX_DIFF_SIZE = 256 * 1024 // cssltdcode_change

type State = Omit<Interface, "init">

export interface Interface {
  readonly init: () => Effect.Effect<void>
  readonly cleanup: () => Effect.Effect<void>
  // cssltdcode_change start - pass prompt context and managed initialization policy
  readonly track: (opts?: {
    sessionID?: SessionID
    messageID?: MessageID
    snapshotInitialization?: CssltdSnapshotTrack.SnapshotInitialization
  }) => Effect.Effect<string | undefined>
  // cssltdcode_change end
  readonly patch: (hash: string) => Effect.Effect<Patch>
  readonly restore: (snapshot: string) => Effect.Effect<void>
  readonly revert: (patches: Patch[]) => Effect.Effect<void>
  readonly diff: (hash: string) => Effect.Effect<string>
  readonly diffFull: (from: string, to: string) => Effect.Effect<FileDiff[]>
}

export class Service extends Context.Service<Service, Interface>()("@cssltdcode/Snapshot") {}

// cssltdcode_change start
type Requirements = FSUtil.Service | AppProcess.Service | Config.Service | EffectFlock.Service
export const layer: Layer.Layer<Service, never, Requirements> =
  // cssltdcode_change end
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const fs = yield* FSUtil.Service
      const appProcess = yield* AppProcess.Service
      const config = yield* Config.Service
      const flock = yield* EffectFlock.Service // cssltdcode_change
      const locks = new Map<string, Semaphore.Semaphore>()

      const lock = (key: string) => {
        const hit = locks.get(key)
        if (hit) return hit

        const next = Semaphore.makeUnsafe(1)
        locks.set(key, next)
        return next
      }

      const state = yield* InstanceState.make<State>(
        Effect.fn("Snapshot.state")(function* (ctx) {
          const state = {
            directory: ctx.directory,
            worktree: ctx.worktree,
            gitdir: path.join(Global.Path.data, "snapshot", ctx.project.id, Hash.fast(ctx.worktree)),
            vcs: ctx.project.vcs,
          }

          const args = (cmd: string[]) => ["--git-dir", state.gitdir, "--work-tree", state.worktree, ...cmd]

          const feed = (list: string[]) => list.join("\0") + "\0"

          const git = Effect.fnUntraced(
            function* (cmd: string[], opts?: { cwd?: string; env?: Record<string, string>; stdin?: string }) {
              const result = yield* appProcess.run(
                ChildProcess.make("git", cmd, { cwd: opts?.cwd, env: opts?.env, extendEnv: true }),
                { stdin: opts?.stdin },
              )
              return {
                code: ChildProcessSpawner.ExitCode(result.exitCode),
                text: result.stdout.toString("utf8"),
                stderr: result.stderr.toString("utf8"),
              } satisfies GitResult
            },
            Effect.catch((err) =>
              Effect.succeed({
                code: ChildProcessSpawner.ExitCode(1),
                text: "",
                stderr: err instanceof Error ? err.message : String(err),
              }),
            ),
          )

          const ignore = Effect.fnUntraced(function* (files: string[]) {
            if (!files.length) return new Set<string>()
            const check = yield* git(
              [
                ...quote,
                "--git-dir",
                path.join(state.worktree, ".git"),
                "--work-tree",
                state.worktree,
                "check-ignore",
                "--no-index",
                "--stdin",
                "-z",
              ],
              {
                cwd: state.directory,
                stdin: feed(files),
              },
            )
            if (check.code !== 0 && check.code !== 1) return new Set<string>()
            return new Set(check.text.split("\0").filter(Boolean))
          })

          const drop = Effect.fnUntraced(function* (files: string[]) {
            if (!files.length) return
            yield* git(
              [
                ...cfg,
                ...args(["rm", "--cached", "-f", "--ignore-unmatch", "--pathspec-from-file=-", "--pathspec-file-nul"]),
              ],
              {
                cwd: state.directory,
                stdin: feed(files),
              },
            )
          })

          // cssltdcode_change start
          const stage = Effect.fnUntraced(function* (
            files: string[],
            opts?: { env?: Record<string, string>; root?: boolean },
          ) {
            // cssltdcode_change end
            if (!files.length) return
            // cssltdcode_change start
            // A new root snapshot covers the full worktree, so a single pathspec avoids
            // quadratic matching against every tracked path in very large repositories.
            const cmd = opts?.root
              ? ["add", "--all", "--sparse", "--", "."]
              : ["add", "--all", "--sparse", "--pathspec-from-file=-", "--pathspec-file-nul"]

            const result = yield* git([...cfg, ...args(cmd)], {
              cwd: state.directory,
              env: opts?.env,
              stdin: opts?.root ? undefined : feed(files),
            })
            // cssltdcode_change end
            if (result.code === 0) return
            yield* Effect.logWarning("failed to add snapshot files", {
              exitCode: result.code,
              stderr: result.stderr,
            })
          })

          const exists = (file: string) => fs.exists(file).pipe(Effect.orDie)
          const read = (file: string) => fs.readFileString(file).pipe(Effect.catch(() => Effect.succeed("")))
          const remove = (file: string) => fs.remove(file).pipe(Effect.catch(() => Effect.void))
          // cssltdcode_change start - serialize snapshot repositories across CLI and extension processes
          const locked = <A, R>(fx: Effect.Effect<A, never, R>) =>
            lock(state.gitdir).withPermits(1)(flock.withLock(fx, `snapshot:${state.gitdir}`).pipe(Effect.orDie))

          // cssltdcode_change end

          const enabled = Effect.fnUntraced(function* () {
            if (state.vcs !== "git") return false
            if (Flag.CSSLTD_CLIENT === "acp") return false // cssltdcode_change - ACP clients do not support snapshots
            return (yield* config.get()).snapshot !== false
          })

          const excludes = Effect.fnUntraced(function* () {
            const result = yield* git(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], {
              cwd: state.worktree,
            })
            const file = result.text.trim()
            if (!file) return
            if (!(yield* exists(file))) return
            return file
          })

          const sync = Effect.fnUntraced(function* (list: string[] = []) {
            const file = yield* excludes()
            const target = path.join(state.gitdir, "info", "exclude")
            const text = [
              file ? (yield* read(file)).trimEnd() : "",
              ...list.map((item) => `/${item.replaceAll("\\", "/")}`),
            ]
              .filter(Boolean)
              .join("\n")
            yield* fs.ensureDir(path.join(state.gitdir, "info")).pipe(Effect.orDie)
            yield* fs.writeFileString(target, text ? `${text}\n` : "").pipe(Effect.orDie)
          })

          // cssltdcode_change start
          const add = Effect.fnUntraced(function* (opts?: { env?: Record<string, string>; root?: boolean }) {
            // cssltdcode_change end
            yield* sync()
            const [diff, other] = yield* Effect.all(
              [
                git([...quote, ...args(["diff-files", "--name-only", "-z", "--", "."])], {
                  cwd: state.directory,
                }),
                git([...quote, ...args(["ls-files", "--others", "--exclude-standard", "-z", "--", "."])], {
                  cwd: state.directory,
                }),
              ],
              { concurrency: 2 },
            )
            if (diff.code !== 0 || other.code !== 0) {
              yield* Effect.logWarning("failed to list snapshot files", {
                diffCode: diff.code,
                diffStderr: diff.stderr,
                otherCode: other.code,
                otherStderr: other.stderr,
              })
              return
            }

            const tracked = diff.text.split("\0").filter(Boolean)
            const untracked = other.text.split("\0").filter(Boolean)
            const all = Array.from(new Set([...tracked, ...untracked]))
            if (!all.length) return

            // Resolve source-repo ignore rules against the exact candidate set.
            // --no-index keeps this pattern-based even when a path is already tracked.
            const ignored = yield* ignore(all)

            // Remove newly-ignored files from snapshot index to prevent re-adding
            if (ignored.size > 0) {
              const ignoredFiles = Array.from(ignored)
              yield* Effect.logInfo("removing gitignored files from snapshot", { count: ignoredFiles.length })
              yield* drop(ignoredFiles)
            }

            const allow = all.filter((item) => !ignored.has(item))
            if (!allow.length) return

            const large = new Set(
              (yield* Effect.all(
                allow.map((item) =>
                  fs
                    .stat(path.join(state.directory, item))
                    .pipe(Effect.catch(() => Effect.void))
                    .pipe(
                      Effect.map((stat) => {
                        if (!stat || stat.type !== "File") return
                        const size = typeof stat.size === "bigint" ? Number(stat.size) : stat.size
                        return size > limit ? item : undefined
                      }),
                    ),
                ),
                { concurrency: 8 },
              )).filter((item): item is string => Boolean(item)),
            )
            const block = new Set(untracked.filter((item) => large.has(item)))
            yield* sync(Array.from(block))
            // Stage only the allowed candidate paths so snapshot updates stay scoped.
            // cssltdcode_change start - initial seeded writes stay protected by the source pin
            yield* stage(
              allow.filter((item) => !block.has(item)),
              opts,
            )
          })

          const materialize = Effect.fnUntraced(function* () {
            yield* locked(CssltdSnapshotMaterialize.run({ gitdir: state.gitdir, git, fs }).pipe(Effect.orDie)).pipe(
              Effect.timeout("5 minutes"),
              Effect.catchCause((cause) =>
                Effect.logError("snapshot materialization failed", { cause: Cause.pretty(cause) }),
              ),
              Effect.forkDetach,
              Effect.asVoid,
            )
          })
          // cssltdcode_change end

          const cleanup = Effect.fnUntraced(function* () {
            return yield* locked(
              Effect.gen(function* () {
                if (!(yield* enabled())) return
                if (!(yield* exists(state.gitdir))) return
                // cssltdcode_change start - retain snapshots for the same seven-day window as object pruning
                yield* CssltdSnapshotMaterialize.prune({ gitdir: state.gitdir, git, fs }, Date.now() - retention)
                // cssltdcode_change end
                const result = yield* git(args(["gc", `--prune=${prune}`]), { cwd: state.directory })
                if (result.code !== 0) {
                  yield* Effect.logWarning("cleanup failed", {
                    exitCode: result.code,
                    stderr: result.stderr,
                  })
                  return
                }
                yield* Effect.logInfo("cleanup", { prune })
              }),
            )
          })

          // cssltdcode_change start
          const track = Effect.fnUntraced(function* (opts?: Parameters<Interface["track"]>[0]) {
            // cssltdcode_change end
            return yield* locked(
              Effect.gen(function* () {
                if (!(yield* enabled())) return
                const existed = yield* exists(state.gitdir)
                const seeded: { value?: CssltdSnapshotSeed.Output } = {} // cssltdcode_change
                yield* fs.ensureDir(state.gitdir).pipe(Effect.orDie)
                if (!existed) {
                  yield* git(["init"], {
                    env: { GIT_DIR: state.gitdir, GIT_WORK_TREE: state.worktree },
                  })
                  yield* git(["--git-dir", state.gitdir, "config", "core.autocrlf", "false"])
                  yield* git(["--git-dir", state.gitdir, "config", "core.longpaths", "true"])
                  yield* git(["--git-dir", state.gitdir, "config", "core.symlinks", "true"])
                  yield* git(["--git-dir", state.gitdir, "config", "core.fsmonitor", "false"])
                  // cssltdcode_change start - seed all eligible new snapshots from the worktree index
                  seeded.value = yield* CssltdSnapshotSeed.seed({
                    dir: state.directory,
                    worktree: state.worktree,
                    gitdir: state.gitdir,
                    limit,
                    git,
                    fs,
                  })
                  // cssltdcode_change end
                  yield* Effect.logInfo("initialized")
                }
                // cssltdcode_change start - pin every snapshot before background materialization
                const seed = seeded.value?.source
                const env = seed
                  ? {
                      GIT_OBJECT_DIRECTORY: seed.staging,
                      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(seed.gitdir, "objects"),
                    }
                  : undefined
                yield* add({ env, root: !existed && state.directory === state.worktree })
                if (
                  seed &&
                  !(yield* CssltdSnapshotMaterialize.localize({
                    gitdir: state.gitdir,
                    git,
                    fs,
                    staging: seed.staging,
                    seed: seed.hash,
                  }))
                )
                  return
                const result = yield* git(args(["write-tree"]), { cwd: state.directory })
                const hash = result.text.trim()
                if (result.code !== 0 || !hash) return
                if (
                  seed &&
                  !(yield* CssltdSnapshotMaterialize.localizeTrees(
                    { gitdir: state.gitdir, git, fs, staging: seed.staging },
                    hash,
                  ))
                )
                  return
                if (!(yield* CssltdSnapshotMaterialize.pin({ gitdir: state.gitdir, git, fs }, hash))) return
                const alt = path.join(state.gitdir, "objects", "info", "alternates")
                if (yield* exists(alt)) yield* materialize()
                // cssltdcode_change end
                yield* Effect.logInfo("tracking", { hash, cwd: state.directory, git: state.gitdir })
                return hash
              }),
            )
          })

          const patch = Effect.fnUntraced(function* (hash: string) {
            return yield* locked(
              Effect.gen(function* () {
                yield* add()
                const result = yield* git(
                  // cssltdcode_change start
                  [
                    ...quote,
                    ...args(["diff", "--cached", "--no-ext-diff", "--no-renames", "--name-only", hash, "--", "."]),
                  ],
                  // cssltdcode_change end
                  {
                    cwd: state.directory,
                  },
                )
                if (result.code !== 0) {
                  yield* Effect.logWarning("failed to get diff", { hash, exitCode: result.code })
                  return { hash, files: [] }
                }
                const files = result.text
                  .trim()
                  .split("\n")
                  .map((x) => x.trim())
                  .filter(Boolean)

                // Hide ignored-file removals from the user-facing patch output.
                const ignored = yield* ignore(files)

                return {
                  hash,
                  files: files
                    .filter((item) => !ignored.has(item))
                    .map((x) => path.join(state.worktree, x).replaceAll("\\", "/")),
                }
              }),
            )
          })

          const restore = Effect.fnUntraced(function* (snapshot: string) {
            return yield* locked(
              Effect.gen(function* () {
                yield* Effect.logInfo("restore", { commit: snapshot })
                const result = yield* git([...core, ...args(["read-tree", snapshot])], { cwd: state.worktree })
                if (result.code === 0) {
                  const checkout = yield* git([...core, ...args(["checkout-index", "-a", "-f"])], {
                    cwd: state.worktree,
                  })
                  if (checkout.code === 0) return
                  yield* Effect.logError("failed to restore snapshot", {
                    snapshot,
                    exitCode: checkout.code,
                    stderr: checkout.stderr,
                  })
                  return
                }
                yield* Effect.logError("failed to restore snapshot", {
                  snapshot,
                  exitCode: result.code,
                  stderr: result.stderr,
                })
              }),
            )
          })

          const revert = Effect.fnUntraced(function* (patches: Patch[]) {
            return yield* locked(
              Effect.gen(function* () {
                const ops: { hash: string; file: string; rel: string }[] = []
                const seen = new Set<string>()
                for (const item of patches) {
                  for (const file of item.files) {
                    if (seen.has(file)) continue
                    seen.add(file)
                    ops.push({
                      hash: item.hash,
                      file,
                      rel: path.relative(state.worktree, file).replaceAll("\\", "/"),
                    })
                  }
                }

                const single = Effect.fnUntraced(function* (op: (typeof ops)[number]) {
                  yield* Effect.logInfo("reverting", { file: op.file, hash: op.hash })
                  const result = yield* git([...core, ...args(["checkout", op.hash, "--", op.file])], {
                    cwd: state.worktree,
                  })
                  if (result.code === 0) return
                  const tree = yield* git([...core, ...args(["ls-tree", op.hash, "--", op.rel])], {
                    cwd: state.worktree,
                  })
                  if (tree.code === 0 && tree.text.trim()) {
                    yield* Effect.logInfo("file existed in snapshot but checkout failed, keeping", {
                      file: op.file,
                      hash: op.hash,
                    })
                    return
                  }
                  yield* Effect.logInfo("file did not exist in snapshot, deleting", {
                    file: op.file,
                    hash: op.hash,
                  })
                  yield* remove(op.file)
                })

                const clash = (a: string, b: string) => a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`)

                for (let i = 0; i < ops.length; ) {
                  const first = ops[i]!
                  const run = [first]
                  let j = i + 1
                  // Only batch adjacent files when their paths cannot affect each other.
                  while (j < ops.length && run.length < 100) {
                    const next = ops[j]!
                    if (next.hash !== first.hash) break
                    if (run.some((item) => clash(item.rel, next.rel))) break
                    run.push(next)
                    j += 1
                  }

                  if (run.length === 1) {
                    yield* single(first)
                    i = j
                    continue
                  }

                  const tree = yield* git(
                    [...core, ...args(["ls-tree", "--name-only", first.hash, "--", ...run.map((item) => item.rel)])],
                    {
                      cwd: state.worktree,
                    },
                  )

                  if (tree.code !== 0) {
                    yield* Effect.logInfo("batched ls-tree failed, falling back to single-file revert", {
                      hash: first.hash,
                      files: run.length,
                    })
                    for (const op of run) {
                      yield* single(op)
                    }
                    i = j
                    continue
                  }

                  const have = new Set(
                    tree.text
                      .trim()
                      .split("\n")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  )
                  const list = run.filter((item) => have.has(item.rel))
                  if (list.length) {
                    yield* Effect.logInfo("reverting", { hash: first.hash, files: list.length })
                    const result = yield* git(
                      [...core, ...args(["checkout", first.hash, "--", ...list.map((item) => item.file)])],
                      {
                        cwd: state.worktree,
                      },
                    )
                    if (result.code !== 0) {
                      yield* Effect.logInfo("batched checkout failed, falling back to single-file revert", {
                        hash: first.hash,
                        files: list.length,
                      })
                      for (const op of run) {
                        yield* single(op)
                      }
                      i = j
                      continue
                    }
                  }

                  for (const op of run) {
                    if (have.has(op.rel)) continue
                    yield* Effect.logInfo("file did not exist in snapshot, deleting", {
                      file: op.file,
                      hash: op.hash,
                    })
                    yield* remove(op.file)
                  }

                  i = j
                }
              }),
            )
          })

          const diff = Effect.fnUntraced(function* (hash: string) {
            return yield* locked(
              Effect.gen(function* () {
                yield* add()
                const result = yield* git([...quote, ...args(["diff", "--cached", "--no-ext-diff", hash, "--", "."])], {
                  cwd: state.worktree,
                })
                if (result.code !== 0) {
                  yield* Effect.logWarning("failed to get diff", {
                    hash,
                    exitCode: result.code,
                    stderr: result.stderr,
                  })
                  return ""
                }
                return result.text.trim()
              }),
            )
          })

          const diffFull = Effect.fnUntraced(function* (from: string, to: string) {
            return yield* locked(
              Effect.gen(function* () {
                type Row = {
                  file: string
                  status: "added" | "deleted" | "modified"
                  binary: boolean
                  additions: number
                  deletions: number
                }

                type Ref = {
                  file: string
                  side: "before" | "after"
                  ref: string
                }

                const show = Effect.fnUntraced(function* (row: Row) {
                  if (row.binary) return ["", ""]
                  if (row.status === "added") {
                    return [
                      "",
                      yield* git([...cfg, ...args(["show", `${to}:${row.file}`])]).pipe(
                        Effect.map((item) => item.text),
                      ),
                    ]
                  }
                  if (row.status === "deleted") {
                    return [
                      yield* git([...cfg, ...args(["show", `${from}:${row.file}`])]).pipe(
                        Effect.map((item) => item.text),
                      ),
                      "",
                    ]
                  }
                  return yield* Effect.all(
                    [
                      git([...cfg, ...args(["show", `${from}:${row.file}`])]).pipe(Effect.map((item) => item.text)),
                      git([...cfg, ...args(["show", `${to}:${row.file}`])]).pipe(Effect.map((item) => item.text)),
                    ],
                    { concurrency: 2 },
                  )
                })

                const load = Effect.fnUntraced(
                  function* (rows: Row[]) {
                    const refs = rows.flatMap((row) => {
                      if (row.binary) return []
                      if (row.status === "added")
                        return [{ file: row.file, side: "after", ref: `${to}:${row.file}` } satisfies Ref]
                      if (row.status === "deleted") {
                        return [{ file: row.file, side: "before", ref: `${from}:${row.file}` } satisfies Ref]
                      }
                      return [
                        { file: row.file, side: "before", ref: `${from}:${row.file}` } satisfies Ref,
                        { file: row.file, side: "after", ref: `${to}:${row.file}` } satisfies Ref,
                      ]
                    })
                    if (!refs.length) return new Map<string, { before: string; after: string }>()

                    const batch = yield* appProcess.run(
                      ChildProcess.make("git", [...cfg, ...args(["cat-file", "--batch"])], {
                        cwd: state.directory,
                        extendEnv: true,
                      }),
                      { stdin: refs.map((item) => item.ref).join("\n") + "\n" },
                    )
                    if (batch.exitCode !== 0) {
                      yield* Effect.logInfo(
                        "git cat-file --batch failed during snapshot diff, falling back to per-file git show",
                        {
                          stderr: batch.stderr.toString("utf8"),
                          refs: refs.length,
                        },
                      )
                      return
                    }
                    const out = batch.stdout

                    const fail = (msg: string, extra?: Record<string, string>) =>
                      Effect.logInfo(msg, { ...extra, refs: refs.length }).pipe(Effect.as(undefined))

                    const map = new Map<string, { before: string; after: string }>()
                    const dec = new TextDecoder()
                    let i = 0
                    for (const ref of refs) {
                      let end = i
                      while (end < out.length && out[end] !== 10) end += 1
                      if (end >= out.length) {
                        return yield* fail(
                          "git cat-file --batch returned a truncated header during snapshot diff, falling back to per-file git show",
                        )
                      }

                      const head = dec.decode(out.slice(i, end))
                      i = end + 1
                      const hit = map.get(ref.file) ?? { before: "", after: "" }
                      if (head.endsWith(" missing")) {
                        map.set(ref.file, hit)
                        continue
                      }

                      const match = head.match(/^[0-9a-f]+ blob (\d+)$/)
                      if (!match) {
                        return yield* fail(
                          "git cat-file --batch returned an unexpected header during snapshot diff, falling back to per-file git show",
                          { head },
                        )
                      }

                      const size = Number(match[1])
                      if (!Number.isInteger(size) || size < 0 || i + size >= out.length || out[i + size] !== 10) {
                        return yield* fail(
                          "git cat-file --batch returned truncated content during snapshot diff, falling back to per-file git show",
                          { head },
                        )
                      }

                      const text = dec.decode(out.slice(i, i + size))
                      if (ref.side === "before") hit.before = text
                      if (ref.side === "after") hit.after = text
                      map.set(ref.file, hit)
                      i += size + 1
                    }

                    if (i !== out.length) {
                      return yield* fail(
                        "git cat-file --batch returned trailing data during snapshot diff, falling back to per-file git show",
                      )
                    }

                    return map
                  },
                  Effect.scoped,
                  Effect.catch(() =>
                    Effect.succeed<Map<string, { before: string; after: string }> | undefined>(undefined),
                  ),
                )

                const result: FileDiff[] = []
                const status = new Map<string, "added" | "deleted" | "modified">()

                const statuses = yield* git(
                  [...quote, ...args(["diff", "--no-ext-diff", "--name-status", "--no-renames", from, to, "--", "."])],
                  { cwd: state.directory },
                )

                for (const line of statuses.text.trim().split("\n")) {
                  if (!line) continue
                  const [code, file] = line.split("\t")
                  if (!code || !file) continue
                  status.set(file, code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified")
                }

                const numstat = yield* git(
                  [...quote, ...args(["diff", "--no-ext-diff", "--no-renames", "--numstat", from, to, "--", "."])],
                  {
                    cwd: state.directory,
                  },
                )

                const rows = numstat.text
                  .trim()
                  .split("\n")
                  .filter(Boolean)
                  .flatMap((line) => {
                    const [adds, dels, file] = line.split("\t")
                    if (!file) return []
                    const binary = adds === "-" && dels === "-"
                    const additions = binary ? 0 : parseInt(adds)
                    const deletions = binary ? 0 : parseInt(dels)
                    return [
                      {
                        file,
                        status: status.get(file) ?? "modified",
                        binary,
                        additions: Number.isFinite(additions) ? additions : 0,
                        deletions: Number.isFinite(deletions) ? deletions : 0,
                      } satisfies Row,
                    ]
                  })

                // Hide ignored-file removals from the user-facing diff output.
                const ignored = yield* ignore(rows.map((r) => r.file))
                if (ignored.size > 0) {
                  const filtered = rows.filter((r) => !ignored.has(r.file))
                  rows.length = 0
                  rows.push(...filtered)
                }

                const step = 100
                const patch = (file: string, before: string, after: string) =>
                  formatPatch(structuredPatch(file, file, before, after, "", "", { context: Number.MAX_SAFE_INTEGER }))

                // cssltdcode_change start - use git patches to avoid blocking the event loop on large diffs
                for (let i = 0; i < rows.length; i += step) {
                  const run = rows.slice(i, i + step)
                  const patches = yield* DiffFull.batch(
                    (cmd) => git([...quote, ...args(cmd)], { cwd: state.directory }),
                    from,
                    to,
                    run.filter((row) => !row.binary).map((row) => row.file),
                  )
                  for (const row of run) {
                    result.push({
                      file: row.file,
                      patch: row.binary ? "" : (patches.get(row.file) ?? ""),
                      additions: row.additions,
                      deletions: row.deletions,
                      status: row.status,
                    })
                  }
                }
                return result
                // cssltdcode_change end

                for (let i = 0; i < rows.length; i += step) {
                  const run = rows.slice(i, i + step)
                  const text = yield* load(run)

                  for (const row of run) {
                    const hit = text?.get(row.file) ?? { before: "", after: "" }
                    const [before, after] = row.binary ? ["", ""] : text ? [hit.before, hit.after] : yield* show(row)
                    result.push({
                      file: row.file,
                      patch: row.binary ? "" : patch(row.file, before, after),
                      additions: row.additions,
                      deletions: row.deletions,
                      status: row.status,
                    })
                  }
                }

                return result
              }),
            )
          })

          yield* materialize() // cssltdcode_change - resume interrupted snapshot object materialization

          yield* cleanup().pipe(
            Effect.catchCause((cause) => Effect.logError("cleanup loop failed", { cause: Cause.pretty(cause) })),
            Effect.repeat(Schedule.spaced(Duration.hours(1))),
            Effect.delay(Duration.minutes(1)),
            Effect.forkScoped,
          )

          return { cleanup, track, patch, restore, revert, diff, diffFull }
        }),
      )

      // cssltdcode_change start - service-local state and cache avoid leaking across Snapshot layer instances
      const trackState = CssltdSnapshotTrack.makeStates()
      const cache = new Map<string, Promise<FileDiff[]>>()
      const max = 100
      // cssltdcode_change end

      return Service.of({
        init: Effect.fn("Snapshot.init")(function* () {
          yield* InstanceState.get(state)
        }),
        cleanup: Effect.fn("Snapshot.cleanup")(function* () {
          return yield* InstanceState.useEffect(state, (s) => s.cleanup())
        }),
        // cssltdcode_change start - isolate turn-facing snapshot work from poisoned locks
        track: Effect.fn("Snapshot.track")(function* (opts) {
          const ctx = yield* InstanceState.context
          const guard = trackState(ctx.worktree)
          return yield* CssltdSnapshotTrack.protect({
            inner: CssltdSnapshotTrack.wrap({
              inner: InstanceState.useEffect(state, (s) => s.track(opts)),
              state: guard,
              snapshotInitialization: opts?.snapshotInitialization,
              sessionID: opts?.sessionID,
              messageID: opts?.messageID,
            }),
            state: guard,
            fallback: undefined,
            operation: "track",
          })
        }),
        patch: Effect.fn("Snapshot.patch")(function* (hash: string) {
          const ctx = yield* InstanceState.context
          const guard = trackState(ctx.worktree)
          return yield* CssltdSnapshotTrack.protect({
            inner: InstanceState.useEffect(state, (s) => s.patch(hash)),
            state: guard,
            fallback: { hash, files: [] },
            operation: "patch",
          })
        }),
        // cssltdcode_change end
        restore: Effect.fn("Snapshot.restore")(function* (snapshot: string) {
          return yield* InstanceState.useEffect(state, (s) => s.restore(snapshot))
        }),
        revert: Effect.fn("Snapshot.revert")(function* (patches: Patch[]) {
          return yield* InstanceState.useEffect(state, (s) => s.revert(patches))
        }),
        diff: Effect.fn("Snapshot.diff")(function* (hash: string) {
          return yield* InstanceState.useEffect(state, (s) => s.diff(hash))
        }),
        diffFull: Effect.fn("Snapshot.diffFull")(function* (from: string, to: string) {
          // cssltdcode_change start - cache full diffs at the service boundary
          if (from === to) return []
          const directory = yield* InstanceState.directory
          const key = `${directory}\0${from}:${to}`
          const hit = cache.get(key)
          if (hit) return yield* Effect.promise(() => hit)
          if (cache.size >= max) {
            const first = cache.keys().next().value
            if (first) cache.delete(first)
          }
          const ctx = yield* Effect.context()
          const pending = Effect.runPromiseWith(ctx)(InstanceState.useEffect(state, (s) => s.diffFull(from, to))).catch(
            (err) => {
              cache.delete(key)
              throw err
            },
          )
          cache.set(key, pending)
          return yield* Effect.promise(() => pending)
          // cssltdcode_change end
        }),
      })
    }),
  )

export const defaultLayer = layer.pipe(
  Layer.provide(AppProcess.defaultLayer),
  Layer.provide(FSUtil.defaultLayer),
  Layer.provide(Config.defaultLayer),
  Layer.provide(EffectFlock.defaultLayer), // cssltdcode_change
)

export const node = LayerNode.make(layer, [FSUtil.node, AppProcess.node, Config.node, EffectFlock.node]) // cssltdcode_change

export * as Snapshot from "."
