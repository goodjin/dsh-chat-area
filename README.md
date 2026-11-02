# dsh-conversation-files

DSH plugin suite for conversation-area enhancements. A single package that bundles all conversation-region UI features into one independently installable plugin.

## Features

| Feature | Description | Slot |
|---------|-------------|------|
| **File view** | In-conversation file reading, editing, open-with picker | `conversation.chat.turnTail` |
| **Mermaid** | Render Mermaid diagrams in Markdown code blocks | DOM-level |
| **ACP process view** | Enhanced rendering for ACP agent process content | `conversation.chat.node` |
| **Interrupted recovery** | Recover button for turns interrupted with no answer | `conversation.chat.turnTail` |
| **Lost input** | Recover failed turns whose message never reached the conversation | `conversation.chat.node` |

## Installation

```sh
npm install @threadharbor/dsh-conversation-files
```

## DSH Configuration

```json
{
  "plugins": [
    "@threadharbor/dsh-conversation-files"
  ]
}
```

## Requirements

- DSH >= 0.2.0-rc.2
- Host providing `remote.workspaceFiles` and `remote.session` (for file view)

## Architecture

Each feature is a self-contained module under `src/`. The main `apply()` function registers all features independently — if one fails to register (missing slot, missing service), the others continue to work.

## License

MIT
