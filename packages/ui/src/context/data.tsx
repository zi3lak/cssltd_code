import type { Message, Session, Part, SnapshotFileDiff, SessionStatus, Provider } from "@cssltdcode/sdk/v2"
import { createSimpleContext } from "./helper"
import { PreloadMultiFileDiffResult } from "@pierre/diffs/ssr"

export type NormalizedProviderListResponse = {
  all: Map<string, Provider>
  default: {
    [key: string]: string
  }
  connected: Array<string>
}

type Data = {
  agent?: {
    name: string
    color?: string
  }[]
  provider?: NormalizedProviderListResponse
  session: Session[]
  session_status: {
    [sessionID: string]: SessionStatus
  }
  session_diff: {
    [sessionID: string]: SnapshotFileDiff[]
  }
  session_diff_preload?: {
    [sessionID: string]: PreloadMultiFileDiffResult<any>[]
  }
  message: {
    [sessionID: string]: Message[]
  }
  part: {
    [messageID: string]: Part[]
  }
  part_text_accum_delta?: {
    [partID: string]: string
  }
}

export type NavigateToSessionFn = (sessionID: string) => void

export type SessionHrefFn = (sessionID: string) => string

// cssltdcode_change start
export type OpenFileFn = (filePath: string, line?: number, column?: number) => void

export type OpenDiffFn = (diff: {
  file: string
  before?: string // cssltdcode_change - optional, cssltd uses `patch`
  after?: string // cssltdcode_change - optional, cssltd uses `patch`
  patch?: string // cssltdcode_change
  additions: number
  deletions: number
}) => void

export type OpenUrlFn = (url: string) => void

export type OpenContentFn = (content: string, language?: string) => void // cssltdcode_change

export type ValidateFilesFn = (paths: string[]) => Promise<string[]> // cssltdcode_change
// cssltdcode_change end

export const { use: useData, provider: DataProvider } = createSimpleContext({
  name: "Data",
  init: (props: {
    data: Data
    directory: string
    onNavigateToSession?: NavigateToSessionFn
    onSessionHref?: SessionHrefFn
    onOpenFile?: OpenFileFn // cssltdcode_change
    onOpenDiff?: OpenDiffFn // cssltdcode_change
    onOpenUrl?: OpenUrlFn // cssltdcode_change
    onOpenContent?: OpenContentFn // cssltdcode_change
    onValidateFiles?: ValidateFilesFn // cssltdcode_change
  }) => {
    return {
      get store() {
        return props.data
      },
      get directory() {
        return props.directory
      },
      navigateToSession: props.onNavigateToSession,
      sessionHref: props.onSessionHref,
      openFile: props.onOpenFile, // cssltdcode_change
      openDiff: props.onOpenDiff, // cssltdcode_change
      openUrl: props.onOpenUrl, // cssltdcode_change
      openContent: props.onOpenContent, // cssltdcode_change
      validateFiles: props.onValidateFiles, // cssltdcode_change
    }
  },
})
