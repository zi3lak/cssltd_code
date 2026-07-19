# Cssltdcode Rules Migration

This document explains how Cssltdcode rules are automatically migrated to Cssltdcode's `instructions` config array.

## Overview

Cssltdcode stores rules in various file locations. When Cssltdcode starts, it reads these files and injects their paths into the `instructions` config array, which Cssltdcode then loads as part of the system prompt.

## Key Guarantees

### 1. Read-Only Migration

The migration **never modifies project files**. We only:

- Read existing rule files from disk
- Inject file paths into the config's `instructions` array
- Never write to the project or modify any files

### 2. Combines with Existing Config (Never Overwrites)

If you have existing cssltdcode config with `instructions`, the Cssltdcode rules are **combined**, not replaced:

```typescript
// Example: User has cssltdcode.json with:
{ "instructions": ["AGENTS.md", "custom-rules.md"] }

// Cssltdcode rules add:
{ "instructions": [".cssltdcoderules", ".cssltdcode/rules/coding.md"] }

// Result (combined, deduplicated):
{ "instructions": ["AGENTS.md", "custom-rules.md", ".cssltdcoderules", ".cssltdcode/rules/coding.md"] }
```

### 3. Restart to Pick Up Changes

If you change your Cssltdcode configuration (e.g., edit `.cssltdcoderules`), simply restart cssltd-cli to pick up the new config. No manual migration or conversion needed.

## Source Locations

The migrator reads rules from these locations:

### Project Rules

| Location | Description |
|---|---|
| `.cssltdcoderules` | Legacy single-file rules in project root |
| `.cssltdcode/rules/*.md` | Directory-based rules (multiple markdown files) |
| `.cssltdcoderules-{mode}` | Mode-specific legacy rules (e.g., `.cssltdcoderules-code`) |
| `.cssltdcode/rules-{mode}/*.md` | Mode-specific rule directories |

### Global Rules

| Location | Description |
|---|---|
| `~/.cssltdcode/rules/*.md` | Global rules directory |

## File Mapping

| Cssltdcode Location | Cssltdcode Equivalent |
|---|---|
| `.cssltdcoderules` | `instructions: [".cssltdcoderules"]` |
| `.cssltdcoderules-{mode}` | `instructions: [".cssltdcoderules-{mode}"]` |
| `.cssltdcode/rules/*.md` | `instructions: [".cssltdcode/rules/file.md", ...]` |
| `.cssltdcode/rules-{mode}/*.md` | `instructions: [".cssltdcode/rules-{mode}/file.md", ...]` |
| `~/.cssltdcode/rules/*.md` | `instructions: ["~/.cssltdcode/rules/file.md", ...]` |

## AGENTS.md Compatibility

`AGENTS.md` is loaded **natively** by Cssltdcode - no migration needed. Cssltdcode automatically loads:

- `AGENTS.md` in project root
- `CLAUDE.md` in project root
- `~/.config/cssltd/AGENTS.md` (global)

## Not Migrated

The following are **not** migrated:

- `.roorules` - Roo-specific rules
- `.clinerules` - Cline-specific rules

Only Cssltdcode-specific files (`.cssltdcoderules`, `.cssltdcode/rules/`) are migrated.

## Mode-Specific Rules

Mode-specific rules (e.g., `.cssltdcoderules-code`, `.cssltdcode/rules-architect/`) are included by default. All mode-specific rules are loaded regardless of the current mode.

## Warnings

The migrator generates warnings for:

- **Legacy files**: When `.cssltdcoderules` is found, a warning suggests migrating to `.cssltdcode/rules/` directory structure

## Example

### Before (Cssltdcode)

```
project/
├── .cssltdcoderules           # Legacy rules
├── .cssltdcoderules-code      # Code-mode specific
└── .cssltdcode/
    └── rules/
        ├── coding.md        # Coding standards
        └── testing.md       # Testing guidelines
```

### After (Cssltdcode Config)

```json
{
  "instructions": [
    "/path/to/project/.cssltdcode/rules/coding.md",
    "/path/to/project/.cssltdcode/rules/testing.md",
    "/path/to/project/.cssltdcoderules",
    "/path/to/project/.cssltdcoderules-code"
  ]
}
```

## Troubleshooting

### Rules not appearing

1. Check the file exists at the expected location
2. Ensure markdown files have `.md` extension
3. Restart cssltd-cli to pick up changes

### Duplicate rules

The `mergeConfigConcatArrays` function automatically deduplicates the `instructions` array using `Array.from(new Set([...]))`.

## Related Files

- [`rules-migrator.ts`](../rules-migrator.ts) - Core migration logic
- [`config-injector.ts`](../config-injector.ts) - Config building and injection
- [`modes-migration.md`](./modes-migration.md) - Modes migration documentation
