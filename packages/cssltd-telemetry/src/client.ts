import { PostHog } from "posthog-node"
import { Identity } from "./identity.js"
import { TelemetryEvent } from "./events.js"

// CSSLTD: analytics are opt-in via CSSLTD_TELEMETRY_HOST/KEY; without them no
// client is created and every capture is a no-op, so nothing leaves the machine.
const POSTHOG_API_KEY = process.env.CSSLTD_TELEMETRY_KEY ?? ""
const POSTHOG_HOST = process.env.CSSLTD_TELEMETRY_HOST ?? ""

export namespace Client {
  let client: PostHog | null = null
  let enabled = true

  export function init() {
    if (!POSTHOG_API_KEY || !POSTHOG_HOST) {
      client = null
      return
    }
    client = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      disableGeoip: true,
    })
  }

  export function getClient(): PostHog | null {
    return client
  }

  export function setEnabled(value: boolean) {
    enabled = value
    if (!client) return
    if (value) client.optIn()
    else client.optOut()
  }

  export function isEnabled(): boolean {
    return enabled && client !== null
  }

  export function capture(event: TelemetryEvent, properties?: Record<string, unknown>) {
    if (!enabled || !client) return

    const distinctId = Identity.getDistinctId()
    const orgId = Identity.getOrganizationId()

    client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        ...(orgId && { cssltdcodeOrganizationId: orgId }),
      },
    })
  }

  export function identify(distinctId: string, properties?: Record<string, unknown>) {
    if (!enabled || !client) return

    client.capture({
      distinctId,
      event: "$identify",
      properties: {
        $set: properties,
      },
    })
  }

  export function alias(distinctId: string, aliasId: string) {
    if (!enabled || !client) return

    client.alias({
      distinctId,
      alias: aliasId,
    })
  }

  export async function shutdown(timeoutMs?: number): Promise<void> {
    if (client) {
      try {
        // PostHog's shutdown drains the queue internally and is bounded by
        // shutdownTimeoutMs. Calling flush() first is redundant and unbounded:
        // when the endpoint is unreachable (offline, firewall, DNS adblock),
        // flush retries up to 3x with 3s delays plus 10s per attempt before
        // throwing, blocking process exit before shutdown's outer cap kicks in.
        await client.shutdown(timeoutMs)
      } finally {
        client = null
      }
    }
  }
}
