import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { IndexingStatusInfo, IndexingWarningInfo } from "@/cssltdcode/indexing-event"
import { Authorization } from "@/server/routes/instance/httpapi/middleware/authorization"
import { InstanceContextMiddleware } from "@/server/routes/instance/httpapi/middleware/instance-context"
import {
  WorkspaceRoutingMiddleware,
  WorkspaceRoutingQuery,
} from "@/server/routes/instance/httpapi/middleware/workspace-routing"
import { described } from "@/server/routes/instance/httpapi/groups/metadata"

export { IndexingStatusInfo, IndexingStatusState, IndexingWarningInfo } from "@/cssltdcode/indexing-event"

export const CssltdEmbeddingModel = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  dimension: Schema.Int.check(Schema.isGreaterThan(0)),
  scoreThreshold: Schema.Finite.check(Schema.isBetween({ minimum: 0, maximum: 1 })),
  note: Schema.optional(Schema.String),
})

export const CssltdEmbeddingModelCatalog = Schema.Struct({
  defaultModel: Schema.String,
  models: Schema.Array(CssltdEmbeddingModel),
  aliases: Schema.Record(Schema.String, Schema.String),
}).annotate({ identifier: "CssltdEmbeddingModelCatalog" })

const root = "/indexing"

export const IndexingPaths = {
  status: `${root}/status`,
  models: `${root}/models`,
  warnings: `${root}/warnings`,
} as const

export const IndexingApi = HttpApi.make("indexing")
  .add(
    HttpApiGroup.make("indexing")
      .add(
        HttpApiEndpoint.get("status", IndexingPaths.status, {
          query: WorkspaceRoutingQuery,
          success: described(IndexingStatusInfo, "Indexing status"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "indexing.status",
            summary: "Get indexing status",
            description: "Retrieve the current code indexing status for the active project.",
          }),
        ),
        HttpApiEndpoint.get("warnings", IndexingPaths.warnings, {
          query: WorkspaceRoutingQuery,
          success: described(Schema.Array(IndexingWarningInfo), "Indexing warnings"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "indexing.warnings",
            summary: "Get indexing warnings",
            description: "Retrieve code indexing warnings for the active project.",
          }),
        ),
      )
      .add(
        HttpApiEndpoint.get("models", IndexingPaths.models, {
          query: WorkspaceRoutingQuery,
          success: described(CssltdEmbeddingModelCatalog, "Cssltd embedding model catalog"),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "indexing.models",
            summary: "List Cssltd embedding models",
            description: "Retrieve the embedding models available through the active Cssltd account.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "indexing",
          description: "Cssltd indexing routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "cssltd HttpApi",
      version: "0.0.1",
      description: "Cssltd HttpApi surface.",
    }),
  )
