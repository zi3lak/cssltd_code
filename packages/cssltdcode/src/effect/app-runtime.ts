import { Layer, ManagedRuntime } from "effect"
import { attach } from "./run-service"
import * as Observability from "@cssltdcode/core/observability"

import { FSUtil } from "@cssltdcode/core/fs-util"
import { Database } from "@cssltdcode/core/database/database"
import { Credential } from "@cssltdcode/core/credential" // cssltdcode_change
import { Auth } from "@/auth"
import { Account } from "@/account/account"
import { Config } from "@/config/config"
import { Git } from "@/git"
import { Ripgrep } from "@cssltdcode/core/ripgrep"
import { Storage } from "@/storage/storage"
import { Snapshot } from "@/snapshot"
import { Plugin } from "@/plugin"
import { ModelsDev } from "@cssltdcode/core/models-dev"
import { ModelCache } from "@/provider/model-cache" // cssltdcode_change
import { Provider } from "@/provider/provider"
import { ProviderAuth } from "@/provider/auth"
import { Agent } from "@/agent/agent"
import { Skill } from "@/skill"
import { Discovery } from "@/skill/discovery"
import { Question } from "@/question"
import { Permission } from "@/permission"
import { Todo } from "@/session/todo"
import { Session } from "@/session/session"
import { SessionStatus } from "@/session/status"
import { SessionRunState } from "@/session/run-state"
import { SessionProcessor } from "@/session/processor"
import { SessionCompaction } from "@/session/compaction"
import { SessionRevert } from "@/session/revert"
import { SessionSummary } from "@/session/summary"
import { SessionPrompt } from "@/session/prompt"
import { Instruction } from "@/session/instruction"
import { LLM } from "@/session/llm"
import { LSP } from "@/lsp/lsp"
import { MCP } from "@/mcp"
import { McpAuth } from "@/mcp/auth"
import { Command } from "@/command"
import { Truncate } from "@/tool/truncate"
import { ToolRegistry } from "@/tool/registry"
import { Format } from "@/format"
import { InstanceLayer } from "@/project/instance-layer"
import { Project } from "@/project/project"
import { Vcs } from "@/project/vcs"
import { Workspace } from "@/control-plane/workspace"
import { Worktree } from "@/worktree"
import { Installation } from "@/installation"
import { MemoryService } from "@cssltdcode/cssltd-memory/effect/service" // cssltdcode_change
import { ShareNext } from "@/share/share-next"
import { SessionShare } from "@/share/session"
import { Npm } from "@cssltdcode/core/npm"
import { memoMap } from "@cssltdcode/core/effect/memo-map"
import { BackgroundJob } from "@/background/job"
import { RuntimeFlags } from "@/effect/runtime-flags"
// cssltdcode_change start
import { Notebook } from "@/cssltdcode/notebook/service"
import { AgentManager } from "@/cssltdcode/agent-manager/service"
// cssltdcode_change end
import { EventV2Bridge } from "@/event-v2-bridge"
// cssltdcode_change start
import { ProjectV2 } from "@cssltdcode/core/project"
import { ProjectCopy } from "@cssltdcode/core/project/copy"
import { MoveSession } from "@cssltdcode/core/control-plane/move-session"
import { PtyTicket } from "@cssltdcode/core/pty/ticket"
// cssltdcode_change end

const CoreLayer = Layer.mergeAll( // cssltdcode_change
  Npm.defaultLayer,
  FSUtil.defaultLayer,
  Database.defaultLayer,
  Credential.defaultLayer, // cssltdcode_change
  Auth.defaultLayer,
  Account.defaultLayer,
  Config.defaultLayer,
  Git.defaultLayer,
  Storage.defaultLayer,
  Snapshot.defaultLayer,
  Plugin.defaultLayer,
  ModelCache.defaultLayer, // cssltdcode_change
  ModelsDev.defaultLayer,
  Provider.defaultLayer,
  ProviderAuth.defaultLayer,
  Agent.defaultLayer,
  Skill.defaultLayer,
  Discovery.defaultLayer,
) // cssltdcode_change

// cssltdcode_change start
const SessionLayer = Layer.mergeAll(
  AgentManager.defaultLayer,
// cssltdcode_change end
  Question.defaultLayer,
  Notebook.defaultLayer, // cssltdcode_change
  Permission.defaultLayer,
  Todo.defaultLayer,
  Session.defaultLayer,
  SessionStatus.defaultLayer,
  BackgroundJob.defaultLayer,
  RuntimeFlags.defaultLayer,
  EventV2Bridge.defaultLayer,
  SessionRunState.defaultLayer,
  SessionProcessor.defaultLayer,
  SessionCompaction.defaultLayer,
  SessionRevert.defaultLayer,
  SessionSummary.defaultLayer,
  SessionPrompt.defaultLayer,
  Instruction.defaultLayer,
  LLM.defaultLayer,
  LSP.defaultLayer,
  MCP.defaultLayer,
  McpAuth.defaultLayer,
  Command.defaultLayer,
  Truncate.defaultLayer,
) // cssltdcode_change

const FeatureLayer = Layer.mergeAll( // cssltdcode_change
  ToolRegistry.defaultLayer,
  Format.defaultLayer,
  Project.defaultLayer,
  // cssltdcode_change start
  ProjectV2.defaultLayer,
  ProjectCopy.defaultLayer,
  MoveSession.defaultLayer,
  PtyTicket.defaultLayer,
  // cssltdcode_change end
  Vcs.defaultLayer,
  Workspace.defaultLayer,
  Worktree.appLayer,
  Installation.defaultLayer,
  MemoryService.layer, // cssltdcode_change
  ShareNext.defaultLayer,
  SessionShare.defaultLayer,
) // cssltdcode_change

export const AppLayer = Layer.mergeAll(CoreLayer, SessionLayer, FeatureLayer).pipe( // cssltdcode_change
  Layer.provideMerge(Ripgrep.defaultLayer),
  Layer.provideMerge(InstanceLayer.layer),
  Layer.provideMerge(Observability.layer),
)

const rt = ManagedRuntime.make(AppLayer, { memoMap })
type Runtime = Pick<typeof rt, "runSync" | "runPromise" | "runPromiseExit" | "runFork" | "runCallback" | "dispose">

/** Services provided by AppRuntime — i.e. what an Effect run via AppRuntime.runPromise can yield. */
export type AppServices = ManagedRuntime.ManagedRuntime.Services<typeof rt>
const wrap = (effect: Parameters<typeof rt.runSync>[0]) => attach(effect as never) as never

export const AppRuntime: Runtime = {
  runSync(effect) {
    return rt.runSync(wrap(effect))
  },
  runPromise(effect, options) {
    return rt.runPromise(wrap(effect), options)
  },
  runPromiseExit(effect, options) {
    return rt.runPromiseExit(wrap(effect), options)
  },
  runFork(effect) {
    return rt.runFork(wrap(effect))
  },
  runCallback(effect) {
    return rt.runCallback(wrap(effect))
  },
  dispose: () => rt.dispose(),
}
