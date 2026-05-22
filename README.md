# opencode-skills-as-commands

Expose all OpenCode skills as slash commands in the TUI autocomplete — no file duplication, no manual sync.

## What it does

Scans all standard OpenCode skill directories at startup and registers each valid `SKILL.md` as a slash command via the `config` hook. Skills then appear in `/` autocomplete alongside built-in commands.

## Install

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:cesumilo/opencode-skills-as-commands"]
}
```

OpenCode installs it automatically on next startup.

## How it works

1. Scans the 6 standard skill paths (`.opencode/skills/`, `~/.config/opencode/skills/`, `.claude/skills/`, `~/.claude/skills/`, `.agents/skills/`, `~/.agents/skills/`)
2. Parses each `SKILL.md` YAML frontmatter for `name` and `description`
3. Registers each skill as a slash command in the TUI

## Requirements

- OpenCode 1.0+
- Skills must have valid `name` and `description` in their `SKILL.md` frontmatter

## Development

```bash
bun install          # install dependencies
bun test             # run tests
bun prettier .       # format
bun eslint .         # lint
```

Pre-commit hooks run format check, lint, and tests on every commit:

```bash
pre-commit install
```

CI runs the same checks on every push and pull request via GitHub Actions.
