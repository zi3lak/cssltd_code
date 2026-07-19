import { createMemo } from "solid-js"
import { useSync } from "../context/sync"

// cssltdcode_change start - anonymous Cssltd and CssltdCode providers do not prove authentication
type Provider = {
  id: string
  models: Record<string, { cost?: { input: number } }>
}

export function connected(providers: ReadonlyArray<Provider>) {
  return providers.some(
    (provider) =>
      (provider.id !== "cssltdcode" && provider.id !== "cssltd") ||
      Object.values(provider.models).some((model) => model.cost?.input !== 0),
  )
}

export function useConnected() {
  const sync = useSync()
  return createMemo(() => connected(sync.data.provider))
}
// cssltdcode_change end
