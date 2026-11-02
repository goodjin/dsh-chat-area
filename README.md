# dsh-chat-area

DSH plugin for generic conversation-area enhancements. Works regardless of which agent is running.

## Features

| Feature | Description | Slot |
|---------|-------------|------|
| **File view** | In-conversation file reading, editing, open-with picker | `conversation.chat.turnTail` |
| **Mermaid** | Render Mermaid diagrams in Markdown code blocks | DOM-level |
| **Session ID bar** | Short session ID with copy button in conversation header | `conversation.session.header.utilities` |

## Installation

```sh
npm install @goodjin2/dsh-chat-area
```

## DSH Configuration

```json
{
  "plugins": [
    "@goodjin2/dsh-chat-area",
    "@threadharbor/dsh-acp-agent-ui"
  ]
}
```

## Coexistence with dsh-acp-agent-ui

This plugin and `dsh-acp-agent-ui` register into different slots and do not conflict. Both can be installed and active simultaneously.

## Requirements

- DSH >= 0.2.0-rc.2
- Host providing `remote.workspaceFiles` and `remote.session` (for file view)

## License

MIT
