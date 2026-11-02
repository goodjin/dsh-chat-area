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
| **Session ID bar** | Short session ID with copy button in conversation header | `conversation.session.header.utilities` |

## Installation

```sh
npm install @threadharbor/dsh-conversation-files
```

## DSH Configuration

```json
{
  "plugins": [
    "@threadharbor/dsh-conversation-files",
    "@threadharbor/dsh-acp-agent-ui"
  ]
}
```

## Coexistence with @threadharbor/dsh-acp-agent-ui

This plugin and `dsh-acp-agent-ui` register into different slots and do not conflict:

| This plugin | dsh-acp-agent-ui |
|---|---|
| `conversation.chat.turnTail` (list) | `conversation.composer.dock` (list) |
| `conversation.chat.node` (keyed, different keys) | `conversation.chat.node` (keyed, different keys) |
| `conversation.session.header.utilities` (list) | `shell.overlay` (list) |
| DOM-level Mermaid | `settings.section` (list) |
| | `conversation.input.model.label` (single) |

Both plugins can be installed and active simultaneously. Each degrades gracefully when its own dependencies are missing.

## Requirements

- DSH >= 0.2.0-rc.2
- Host providing `remote.workspaceFiles` and `remote.session` (for file view)

## License

MIT
