// cssltdcode_change - new file
// Cssltd-specific overrides for the server control plane.
// Imported by ../../server/server.ts with minimal cssltdcode_change markers.

/** Additional CORS origin check for *.cssltd.ai */
export function corsOrigin(input: string): string | undefined {
  if (/^https:\/\/([a-z0-9-]+\.)*cssltd\.ai$/.test(input)) {
    return input
  }
  return undefined
}

export const DOC_TITLE = "cssltd"
export const DOC_DESCRIPTION = "cssltd api"
