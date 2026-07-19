# CSSLTD Code CLI

The AI coding agent built for the terminal. Generate code from natural language, automate tasks, and run terminal commands -- powered by 500+ AI models.

![Cssltd CLI showing code edits in a terminal](https://raw.githubusercontent.com/Cssltd-Org/cssltdcode/main/packages/cssltd-docs/public/img/npm-package-readme/cssltd-cli.png)

Cssltd is the all-in-one agentic engineering platform. Build, ship, and iterate faster with the most popular open source coding agent.

[Website](https://cssltd.ai) · [Install](https://cssltd.ai/install) · [IDE](https://cssltd.ai/landing/vs-code) · [CLI](https://cssltd.ai/cli) · [Docs](https://cssltd.ai/docs) · [Models](https://cssltd.ai/leaderboard) · [Gateway](https://cssltd.ai/gateway) · [Pricing](https://cssltd.ai/pricing) · [Cssltd Pass](https://cssltd.ai/pricing/cssltd-pass)

[500+ models](https://cssltd.ai/leaderboard). One open source agent in [VS Code](https://cssltd.ai/vscode-marketplace), [JetBrains](https://plugins.jetbrains.com/plugin/27133-cssltd-code), [CLI](https://www.npmjs.com/package/@cssltdcode/cli), [Slack](https://cssltd.ai/slack), and [Cloud](https://cssltd.ai/cloud).

## Install

```bash
npm install -g @cssltdcode/cli
```

Or run directly with npx:

```bash
npx --package @cssltdcode/cli cssltd
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
- **500+ AI models** -- use models from OpenAI, Anthropic, Google, and more
- **MCP servers** -- extend agent capabilities with the Model Context Protocol
- **Multiple modes** -- Plan with Architect, code with Coder, debug with Debugger, or create your own
- **Sessions** -- resume previous conversations and export transcripts
- **API keys optional** -- bring your own keys or use Cssltd credits

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

## Alternative Installation

### Homebrew (macOS/Linux)

```bash
brew install Cssltd-Org/tap/cssltd
```

### GitHub Releases

Download pre-built binaries from the [Releases page](https://github.com/Cssltd-Org/cssltdcode/releases).

## Documentation

- [Docs](https://cssltd.ai/docs)
- [Getting Started](https://cssltd.ai/docs/getting-started)

## Links

- [GitHub](https://github.com/Cssltd-Org/cssltdcode)
- [Discord](https://cssltd.ai/discord)
- [VS Code Extension](https://cssltd.ai/vscode-marketplace)
- [Website](https://cssltd.ai)

## License

MIT
