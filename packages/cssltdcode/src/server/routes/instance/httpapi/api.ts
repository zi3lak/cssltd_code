import { Schema } from "effect"
import { HttpApi } from "effect/unstable/httpapi"
import { InstanceDisposed } from "@/server/event"
import { Question } from "@/question"
import { BusEvent } from "@/bus/bus-event" // cssltdcode_change - include legacy Cssltd events until they migrate to EventV2
import { ConfigApi } from "./groups/config"
import { ControlApi } from "./groups/control"
import { ControlPlaneApi } from "./groups/control-plane"
import { EventApi } from "./groups/event"
import { ExperimentalApi } from "./groups/experimental"
import { FileApi } from "./groups/file"
import { InstanceApi } from "./groups/instance"
import { McpApi } from "./groups/mcp"
import { PermissionApi } from "./groups/permission"
import { ProjectApi } from "./groups/project"
import { ProjectCopyApi } from "./groups/project-copy"
import { ProviderApi } from "./groups/provider"
import { PtyApi, PtyConnectApi } from "./groups/pty"
import { QuestionApi } from "./groups/question"
import { SessionApi } from "./groups/session"
import { SyncApi } from "./groups/sync"
import { TuiApi } from "./groups/tui"
import { WorkspaceApi } from "./groups/workspace"
import { Api } from "@cssltdcode/server/api"
// cssltdcode_change start - Cssltd HttpApi groups
import { AgentBuilderApi } from "@/cssltdcode/server/httpapi/groups/agent-builder"
import { BranchNameApi } from "@/cssltdcode/server/httpapi/groups/branch-name"
import { CommitMessageApi } from "@/cssltdcode/server/httpapi/groups/commit-message"
import { BackgroundProcessApi } from "@/cssltdcode/server/httpapi/groups/background-process"
import { ConfigConsoleApi } from "@/cssltdcode/server/httpapi/groups/config-console"
import { EnhancePromptApi } from "@/cssltdcode/server/httpapi/groups/enhance-prompt"
import { IndexingApi } from "@/cssltdcode/server/httpapi/groups/indexing"
import { InstanceReloadApi } from "@/cssltdcode/server/httpapi/groups/instance-reload"
import { InteractiveTerminalApi } from "@/cssltdcode/server/httpapi/groups/interactive-terminal"
import { CssltdGatewayApi } from "@/cssltdcode/server/httpapi/groups/cssltd-gateway"
import { CssltdcodeApi } from "@/cssltdcode/server/httpapi/groups/cssltdcode"
import { NetworkApi } from "@/cssltdcode/server/httpapi/groups/network"
import { RemoteApi } from "@/cssltdcode/server/httpapi/groups/remote"
import { SandboxApi } from "@/cssltdcode/server/httpapi/groups/sandbox"
import { SessionImportApi } from "@/cssltdcode/server/httpapi/groups/session-import"
import { SuggestionApi } from "@/cssltdcode/server/httpapi/groups/suggestion"
import { TelemetryApi } from "@/cssltdcode/server/httpapi/groups/telemetry"
import { MemoryApi } from "@/cssltdcode/server/httpapi/groups/memory" // cssltdcode_change
// cssltdcode_change end
// GlobalEventSchema snapshots the registry after event-producing groups register their variants.
import { GlobalApi } from "./groups/global"
import { Authorization } from "./middleware/authorization"
import { SchemaErrorMiddleware } from "./middleware/schema-error"

const EventSchema = Schema.Union([...BusEvent.effectPayloads(), InstanceDisposed]).annotate({ identifier: "Event" }) // cssltdcode_change

export const RootHttpApi = HttpApi.make("cssltdcode-root")
  .addHttpApi(ControlApi)
  .addHttpApi(ControlPlaneApi)
  .addHttpApi(GlobalApi)
  .middleware(SchemaErrorMiddleware)
  .middleware(Authorization)

export const InstanceHttpApi = HttpApi.make("cssltdcode-instance")
  .addHttpApi(ConfigApi)
  .addHttpApi(ExperimentalApi)
  .addHttpApi(FileApi)
  .addHttpApi(InstanceApi)
  .addHttpApi(McpApi)
  .addHttpApi(ProjectApi)
  .addHttpApi(ProjectCopyApi)
  .addHttpApi(PtyApi)
  .addHttpApi(QuestionApi)
  .addHttpApi(PermissionApi)
  .addHttpApi(ProviderApi)
  .addHttpApi(SessionApi)
  .addHttpApi(SyncApi)
  .addHttpApi(TuiApi)
  .addHttpApi(WorkspaceApi)
  // cssltdcode_change start - Cssltd HttpApi groups
  .addHttpApi(AgentBuilderApi)
  .addHttpApi(BackgroundProcessApi)
  .addHttpApi(BranchNameApi)
  .addHttpApi(CommitMessageApi)
  .addHttpApi(ConfigConsoleApi)
  .addHttpApi(EnhancePromptApi)
  .addHttpApi(IndexingApi)
  .addHttpApi(InstanceReloadApi)
  .addHttpApi(InteractiveTerminalApi)
  .addHttpApi(CssltdGatewayApi)
  .addHttpApi(CssltdcodeApi)
  .addHttpApi(NetworkApi)
  .addHttpApi(RemoteApi)
  .addHttpApi(SandboxApi)
  .addHttpApi(SessionImportApi)
  .addHttpApi(SuggestionApi)
  .addHttpApi(TelemetryApi)
  .addHttpApi(MemoryApi)
  // cssltdcode_change end
  .middleware(SchemaErrorMiddleware)

export const CssltdCodeHttpApi = HttpApi.make("cssltdcode")
  .addHttpApi(RootHttpApi)
  .addHttpApi(EventApi)
  .addHttpApi(InstanceHttpApi)
  .addHttpApi(Api)
  .addHttpApi(PtyConnectApi)
  .annotate(HttpApi.AdditionalSchemas, [EventSchema, Question.Replied, Question.Rejected])

export type RootHttpApiType = typeof RootHttpApi
export type InstanceHttpApiType = typeof InstanceHttpApi
