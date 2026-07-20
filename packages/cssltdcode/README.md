# CSSLTD Code CLI

The AI coding agent built for the terminal, for CSSLTD engineers. Generate code from natural
language, automate tasks, and run terminal commands with paid provider APIs or local Ollama models.

## Install

There is no published release channel yet (no npm package, Homebrew tap, or GitHub Releases).
Build from source and install the resulting binary:

```bash
bun install
cd packages/cssltdcode
bun run build          # binary lands in dist/<platform>/bin/cssltd
../../install --binary dist/<platform>/bin/cssltd
```

Or run straight from source without installing anything:

```bash
bun install
bun dev
```

## Getting Started

Run `cssltd` in any project directory to launch the interactive TUI:

```bash
cssltd
```

Run a one-off task:

```bash
cssltd run "add input validation to the signup form"
```

## Features

- **Code generation** -- describe what you want in natural language
- **Terminal commands** -- the agent can run shell commands on your behalf
- **Paid provider APIs + local Ollama** -- Anthropic, OpenAI, OpenRouter, Google, Mistral, and
  ~30 other providers, plus any model already running locally via Ollama
- **MCP servers** -- extend agent capabilities with the Model Context Protocol
- **Multiple modes** -- Plan with Architect, code with Coder, debug with Debugger, or create your own
- **Sessions** -- resume previous conversations and export transcripts

## Commands

| Command               | Description                |
| --------------------- | -------------------------- |
| `cssltd`                | Launch interactive TUI     |
| `cssltd run "<task>"`   | Run a one-off task         |
| `cssltd auth`           | Manage authentication      |
| `cssltd models`         | List available models      |
| `cssltd mcp`            | Manage MCP servers         |
| `cssltd session list`   | List sessions              |
| `cssltd session delete` | Delete a session           |
| `cssltd export`         | Export session transcripts |

Run `cssltd --help` for the full list.

## License

MIT -- see [LICENSE](../../LICENSE) and [NOTICE.md](../../NOTICE.md).
