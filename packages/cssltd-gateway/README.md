# @cssltdcode/cssltd-gateway

Unified Cssltd Gateway package for CssltdCode providing authentication, AI provider integration, and API access.

## Features

- **Authentication**: Device authorization flow for Cssltd Gateway
- **AI Provider**: OpenRouter-based provider with Cssltd Gateway integration
- **API Integration**: Profile, balance, and model management
- **TUI Helpers**: Utilities for terminal UI components

## Installation

```bash
bun add @cssltdcode/cssltd-gateway
```

## Usage

### Plugin Registration

```typescript
import { CssltdAuthPlugin } from "@cssltdcode/cssltd-gateway"

// Register with CssltdCode
const plugins = [CssltdAuthPlugin]
```

### Provider Usage

```typescript
import { createCssltd } from "@cssltdcode/cssltd-gateway"

const provider = createCssltd({
  cssltdcodeToken: process.env.CSSLTDCODE_API_KEY,
  cssltdcodeOrganizationId: "org-123",
})

const model = provider.languageModel("anthropic/claude-sonnet-4")
```

### API Access

```typescript
import { fetchProfile, fetchBalance } from "@cssltdcode/cssltd-gateway"

const profile = await fetchProfile(token)
const balance = await fetchBalance(token)
```

## License

MIT
