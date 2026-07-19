// Subprocess integration tests for `cssltdcode run` (non-interactive mode).
// These exercise the real CLI binary against a TestLLMServer running in the
// same process. See `test/lib/cli-process.ts` for the harness — each test uses
// `cssltdcode.run(message, opts?)` to spawn `bun src/index.ts run ...` with
// `CSSLTD_CONFIG_CONTENT` providing the test provider config inline.
import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { cliIt } from "../../lib/cli-process"

describe("cssltdcode run (non-interactive subprocess)", () => {
  // cssltdcode_change start
  // Keep full CLI subprocesses serial within this file; the test runner already
  // executes files in parallel, and nested concurrency exhausts Windows CI.
  // Happy path: prompt completes, output reaches stdout, process exits 0.
  // If this fails, all the others likely will too — debug here first.
  cliIt.live(
    "exits 0 and writes the response to stdout on a successful prompt",
    ({ llm, cssltdcode }) =>
      Effect.gen(function* () {
        yield* llm.text("hello from the test llm")
        const result = yield* cssltdcode.run("say hi")
        cssltdcode.expectExit(result, 0)
        expect(result.stdout).toContain("hello from the test llm")
      }),
    60_000,
  )
  // cssltdcode_change end

  // cssltdcode_change start
  // Regression for #27371: an unknown model used to hang the process forever
  // waiting on a session.status === idle event that never arrived. The fix
  // makes the SDK call surface an error promptly so the process exits 1.
  // A harness timeout produces synthetic exit code -1, so the exact assertion
  // distinguishes the intended failure from a signal-killed process.
  cliIt.live(
    "exits nonzero promptly when the model is unknown (regression for #27371)",
    ({ cssltdcode }) =>
      Effect.gen(function* () {
        const result = yield* cssltdcode.run("say hi", {
          model: "test/nonexistent-model",
          timeoutMs: 30_000,
        })
        cssltdcode.expectExit(result, 1)
      }),
    60_000,
  )
  // cssltdcode_change end

  // cssltdcode_change start
  // Locks in the current behavior: when the LLM stream errors mid-response
  // (the prompt was accepted, then the upstream provider failed), cssltdcode
  // emits a session.error event and the process exits 0 today.
  //
  // This is debatable — a future cleanup might flip it to exit 1. If you're
  // changing this expectation, do it deliberately and say so in the PR.
  cliIt.live(
    "mid-stream LLM error still exits 0 today (contract lock-in)",
    ({ llm, cssltdcode }) =>
      Effect.gen(function* () {
        yield* llm.fail("upstream provider exploded mid-stream")
        const result = yield* cssltdcode.run("trigger midstream error", { timeoutMs: 30_000 })
        expect(result.exitCode).toBe(0)
      }),
    60_000,
  )
  // cssltdcode_change end

  // cssltdcode_change start
  // --format json puts one JSON object per line on stdout for each emitted
  // event. Consumers (CI scripts, tooling) parse this stream. Asserts the
  // shape so a future event-emit change has to update this expectation.
  cliIt.live(
    "--format json emits parseable line-delimited JSON to stdout",
    ({ llm, cssltdcode }) =>
      Effect.gen(function* () {
        yield* llm.text("structured output")
        const result = yield* cssltdcode.run("say hi", { format: "json" })
        cssltdcode.expectExit(result, 0)

        const events = cssltdcode.parseJsonEvents(result.stdout)
        expect(events.length).toBeGreaterThan(0)
        for (const evt of events) {
          expect(typeof evt.type).toBe("string")
          expect(typeof evt.sessionID).toBe("string")
        }
        // At least one `text` event should appear with the LLM's response.
        const text = events.find((e) => e.type === "text")
        expect(text).toBeDefined()
      }),
    60_000,
  )
  // cssltdcode_change end
})
