import { createCssltd, CSSLTD_OPENROUTER_BASE } from "@cssltdcode/cssltd-gateway" // cssltdcode_change
import { Effect } from "effect"
import { PluginV2 } from "../../plugin"
import { ProviderV2 } from "../../provider" // cssltdcode_change

const id = ProviderV2.ID.make("cssltd") // cssltdcode_change

export const CssltdPlugin = PluginV2.define({
  id: PluginV2.ID.make("cssltd"),
  effect: Effect.gen(function* () {
    return {
      "catalog.transform": Effect.fn(function* (evt) {
        for (const item of evt.provider.list()) {
          if (item.provider.id !== id) continue // cssltdcode_change
          evt.provider.update(item.provider.id, (provider) => {
            // cssltdcode_change start
            const options = provider.request.body
            const token = options.cssltdcodeToken ?? options.apiKey ?? process.env.CSSLTD_API_KEY
            const org = process.env.CSSLTD_ORG_ID ?? options.cssltdcodeOrganizationId
            // CSSLTD: the company gateway is opt-in — without an explicit URL or
            // credentials the provider stays disabled and engineers use their own
            // API keys (Anthropic/OpenAI/OpenRouter) or local Ollama instead.
            const gatewayConfigured = Boolean(process.env.CSSLTD_API_URL || token || org)

            provider.api = {
              type: "aisdk",
              package: "@cssltdcode/cssltd-gateway",
              url: CSSLTD_OPENROUTER_BASE,
            }
            // cssltdcode_change end
            provider.request.headers["HTTP-Referer"] = "https://cssltd.ai/"
            // cssltdcode_change start
            provider.request.headers["X-Title"] = "CSSLTD Code"
            options.cssltdcodeToken = token ?? "anonymous"
            if (org) options.cssltdcodeOrganizationId = org
            if (!provider.enabled && gatewayConfigured) provider.enabled = { via: "custom", data: { anonymous: !token } }
            // cssltdcode_change end
          })
        }
      }),
      // cssltdcode_change start
      "aisdk.sdk": Effect.fn(function* (evt) {
        if (evt.model.providerID !== id) return
        evt.sdk = createCssltd(evt.options)
      }),
      // cssltdcode_change end
    }
  }),
})
