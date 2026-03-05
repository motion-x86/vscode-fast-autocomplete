# Fast Autocomplete for VS Code

AI-powered inline ghost text completions using Claude (Anthropic) or OpenAI.

## Features

- **Inline ghost text** — completions appear at the cursor, accept with Tab
- **Status bar indicator** — shows provider state and request progress
- **Sidebar panel** — manage API keys and provider settings
- **Streaming** — optional token-by-token streaming
- **Privacy controls** — redact comments, strings, or custom patterns before sending
- **Custom prompts** — override system prompt and instructions per workspace

## Installation

Install from the VS Code Marketplace or manually:

```bash
npm install
npm run compile
# Then press F5 in VS Code to launch the Extension Development Host
```

## Setup

1. Open the command palette (`Ctrl+Shift+P`)
2. Run **FastAutocomplete: Set API Key (Claude)** or **FastAutocomplete: Set API Key (OpenAI)**
3. Run **FastAutocomplete: Select Provider** to choose your provider

## Usage

| Action | Key |
|--------|-----|
| Trigger completion | `Ctrl+Space` |
| Accept ghost text | `Tab` |
| Dismiss ghost text | `Escape` |
| Request alternative | `Ctrl+Shift+N` |

## Configuration

All settings are under `fastAutocomplete.*` in VS Code settings.

| Setting | Default | Description |
|---------|---------|-------------|
| `provider` | `claude` | AI provider (`claude` or `openai`) |
| `model` | `claude-sonnet-4-20250514` | Model identifier |
| `maxCompletionTokens` | `128` | Max tokens per completion |
| `contextLinesBefore` | `50` | Lines of prefix context |
| `contextLinesAfter` | `10` | Lines of suffix context |
| `streaming` | `false` | Stream tokens as they arrive |
| `requestTimeoutSeconds` | `10` | Request timeout |
| `privacy.redactComments` | `false` | Strip comments before sending |
| `privacy.redactStringLiterals` | `false` | Redact string contents |
| `privacy.noRetention` | `false` | Request no training use |

## License

MIT
