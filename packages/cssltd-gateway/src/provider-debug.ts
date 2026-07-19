import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import type { Provider as SDK } from "ai"
import type { CssltdProviderOptions } from "./types.js"
import { getApiKey } from "./auth/token.js"
import { buildCssltdHeaders, getDefaultHeaders } from "./headers.js"
import { ANONYMOUS_API_KEY } from "./api/constants.js"
import { resolveCssltdOpenRouterBaseUrl } from "./api/url.js"
import { buildRequestHeaders } from "./provider.js"

/**
 * Debug version of createCssltd with extensive logging
 */
export function createCssltdDebug(options: CssltdProviderOptions = {}): SDK {
  console.log("\n🔍 [CSSLTD DEBUG] Creating Cssltd Provider")
  console.log("📋 [CSSLTD DEBUG] Options received:", JSON.stringify(options, null, 2))

  // Get API key from options or environment
  const apiKey = getApiKey(options)
  console.log("🔑 [CSSLTD DEBUG] API Key extracted:")
  console.log("  - Source:", options.cssltdcodeToken ? "cssltdcodeToken" : options.apiKey ? "apiKey" : "none")
  console.log("  - Value:", apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}` : "MISSING!")

  const openRouterUrl = resolveCssltdOpenRouterBaseUrl({ baseURL: options.baseURL, token: apiKey })
  console.log("🔗 [CSSLTD DEBUG] OpenRouter URL:", openRouterUrl)

  // Merge custom headers with defaults
  const customHeaders = {
    ...getDefaultHeaders(),
    ...buildCssltdHeaders(undefined, {
      cssltdcodeOrganizationId: options.cssltdcodeOrganizationId,
      cssltdcodeTesterWarningsDisabledUntil: undefined,
    }),
    ...options.headers,
  }
  console.log("📝 [CSSLTD DEBUG] Custom headers:", JSON.stringify(customHeaders, null, 2))

  // Create custom fetch wrapper to add dynamic headers
  const originalFetch = options.fetch ?? fetch
  const wrappedFetch = async (input: string | URL | Request, init?: RequestInit) => {
    console.log("\n🚀 [CSSLTD DEBUG] Making request:")
    console.log("  - URL:", String(input))
    console.log("  - Method:", init?.method || "GET")

    const headers = buildRequestHeaders(customHeaders, init?.headers)

    // Add authorization if API key exists
    if (apiKey) {
      const authValue = `Bearer ${apiKey}`
      headers.set("Authorization", authValue)
      console.log(
        "  - Authorization header set:",
        `Bearer ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 8)}`,
      )
    } else {
      console.log("  ⚠️ - NO AUTHORIZATION HEADER! API key is missing")
    }

    console.log("  - Headers being sent:")
    headers.forEach((value, key) => {
      if (key.toLowerCase() === "authorization") {
        console.log(`    ${key}: ${value.substring(0, 20)}...`)
      } else {
        console.log(`    ${key}: ${value}`)
      }
    })

    const response = await originalFetch(input, {
      ...init,
      headers,
    })

    console.log("  - Response status:", response.status, response.statusText)

    if (!response.ok) {
      const responseText = await response.text()
      console.log("  ❌ - Error response:", responseText)
      // Re-create response since we consumed the body
      return new Response(responseText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      })
    }

    return response
  }

  console.log("✅ [CSSLTD DEBUG] Creating OpenRouter provider with configuration\n")

  // Create OpenRouter provider with CssltdCode configuration
  return createOpenRouter({
    baseURL: openRouterUrl,
    apiKey: apiKey ?? ANONYMOUS_API_KEY,
    headers: customHeaders,
    fetch: wrappedFetch as typeof fetch,
  }) as unknown as SDK
}
