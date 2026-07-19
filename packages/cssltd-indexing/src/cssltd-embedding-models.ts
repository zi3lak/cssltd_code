export type CssltdEmbeddingModel = {
  id: string
  name: string
  dimension: number
  scoreThreshold: number
  note?: string
}

export type CssltdEmbeddingModelCatalog = {
  defaultModel: string
  models: CssltdEmbeddingModel[]
  aliases: Record<string, string>
}

export const EMPTY_CSSLTD_EMBEDDING_MODEL_CATALOG: CssltdEmbeddingModelCatalog = {
  defaultModel: "",
  models: [],
  aliases: {},
}

export function normalizeCssltdEmbeddingModelId(model: string | undefined, catalog = EMPTY_CSSLTD_EMBEDDING_MODEL_CATALOG) {
  if (!model) return undefined
  return catalog.aliases[model] ?? model
}

export function getCssltdEmbeddingModel(model: string | undefined, catalog = EMPTY_CSSLTD_EMBEDDING_MODEL_CATALOG) {
  const id = normalizeCssltdEmbeddingModelId(model, catalog)
  return catalog.models.find((item) => item.id === id)
}

export function formatCssltdEmbeddingModelLabel(model: CssltdEmbeddingModel): string {
  const note = model.note ? `${model.note}, ` : ""
  return `${model.name} (${note}${model.dimension}d)`
}
