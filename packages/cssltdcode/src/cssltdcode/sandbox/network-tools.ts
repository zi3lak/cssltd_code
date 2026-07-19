export const opaque = [
  {
    id: "codebase_search",
    file: "tool/warpgrep.ts",
    client: {
      name: "ad hoc network client",
      count: 1,
      reason: "opaque SDK traffic is denied by the common executeTool network boundary",
    },
  },
  { id: "semantic_search", file: "cssltdcode/tool/semantic-search.ts" },
  { id: "lsp", file: "tool/lsp.ts" },
] as const

export const host = [
  { id: "interactive_terminal", file: "cssltdcode/tool/interactive-terminal.ts" },
  { id: "notebook_execute", file: "cssltdcode/tool/notebook-host.ts" },
  { id: "background_process", file: "cssltdcode/tool/background-process.ts" },
] as const
