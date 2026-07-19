import { InstanceStore } from "@/project/instance-store"
import { ModelCache } from "@/provider/model-cache"
import { CssltdViewers } from "@/cssltdcode/presence/service" // cssltdcode_change
import { Effect } from "effect"

export const disposeAllInstancesAfterProviderAuthCallback = Effect.fn(
  "CssltdServer.disposeAllInstancesAfterProviderAuthCallback",
)(function* () {
  const store = yield* InstanceStore.Service
  yield* store.disposeAll()
})

// cssltdcode_change start - drop the old presence socket; callers invoke this for the "cssltd" provider only
export const invalidatePresence = Effect.fn("CssltdServer.invalidatePresence")(function* () {
  const viewers = yield* CssltdViewers.Service
  yield* viewers.invalidateAuth()
})
// cssltdcode_change end

export const invalidateAfterProviderAuthChange = Effect.fn("CssltdServer.invalidateAfterProviderAuthChange")(function* (
  providerID: string,
) {
  const cache = yield* ModelCache.Service
  yield* cache.clear(providerID)
  yield* disposeAllInstancesAfterProviderAuthCallback()
})
