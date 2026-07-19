import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider" // cssltdcode_change

export const NvidiaPlugin = PluginV2.define({
  id: PluginV2.ID.make("nvidia"),
  effect: Effect.gen(function* () {
    return {
      "catalog.transform": Effect.fn(function* (evt) {
        for (const item of evt.provider.list()) {
          if (item.provider.api.type !== "aisdk") continue
          if (item.provider.api.package !== "@ai-sdk/openai-compatible") continue
          if (item.provider.api.url !== "https://integrate.api.nvidia.com/v1") continue
          if (item.provider.id !== ProviderV2.ID.make("nvidia")) continue // cssltdcode_change
          evt.provider.update(item.provider.id, (provider) => {
            provider.request.headers["HTTP-Referer"] = "https://cssltd.ai/" // cssltdcode_change
            // cssltdcode_change start
            provider.request.headers["X-Title"] = "CSSLTD Code"
            provider.request.headers["X-BILLING-INVOKE-ORIGIN"] ??= "CssltdCode"
            // cssltdcode_change end
          })
        }
      }),
    }
  }),
})
