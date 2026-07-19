import { z } from "zod"
import { CSSLTD_API_BASE } from "./constants.js"
import { getDefaultHeaders, buildCssltdHeaders } from "../headers.js"

/**
 * Cssltd notification schema
 */
export const CssltdcodeNotificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  action: z
    .object({
      actionText: z.string(),
      actionURL: z.string(),
    })
    .optional(),
  showIn: z.array(z.string()).optional(),
  suggestModelId: z.string().optional(),
})

export type CssltdcodeNotification = z.infer<typeof CssltdcodeNotificationSchema>

const NotificationsResponseSchema = z.object({
  notifications: z.array(CssltdcodeNotificationSchema),
})

const NOTIFICATIONS_TIMEOUT_MS = 5000

/**
 * Fetch notifications from Cssltd API
 *
 * @param options - Configuration with token and optional organization ID
 * @returns Array of notifications from the Cssltd API (clients filter by showIn)
 */
export async function fetchCssltdcodeNotifications(options: {
  cssltdcodeToken?: string
  cssltdcodeOrganizationId?: string
}): Promise<CssltdcodeNotification[]> {
  const token = options.cssltdcodeToken
  if (!token) return []

  const url = `${CSSLTD_API_BASE}/api/users/notifications`

  try {
    const response = await fetch(url, {
      headers: {
        ...getDefaultHeaders(),
        ...buildCssltdHeaders(undefined, { cssltdcodeOrganizationId: options.cssltdcodeOrganizationId }),
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(NOTIFICATIONS_TIMEOUT_MS),
    })

    if (!response.ok) return []

    const json = await response.json()
    const result = NotificationsResponseSchema.safeParse(json)

    if (!result.success) return []

    return result.data.notifications
  } catch {
    return []
  }
}
