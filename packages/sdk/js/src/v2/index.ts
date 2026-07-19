export * from "./client.js"
export * from "./server.js"

import { createCssltdClient } from "./client.js"
import { createCssltdServer } from "./server.js"
import type { ServerOptions } from "./server.js"

export * as data from "./data.js"

export async function createCssltd(options?: ServerOptions) {
  const server = await createCssltdServer({
    ...options,
  })

  const client = createCssltdClient({
    baseUrl: server.url,
  })

  return {
    client,
    server,
  }
}
