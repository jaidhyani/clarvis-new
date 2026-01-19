# Clarvis

Web UI for Claude Code sessions via Claudekeeper.

## Setup

1. Start Claudekeeper first:
   ```bash
   cd ../claudekeeper && npm start
   ```

2. Start Clarvis:
   ```bash
   ALLOWED_ROOTS="/home/user/projects,/var/www" node server.js
   ```

3. Open http://localhost:3000 and enter your Claudekeeper token

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `CLAUDEKEEPER_URL` | http://localhost:3100 | Backend server |
| `ALLOWED_ROOTS` | (none) | Comma-separated paths for file browser |

## Features

- **Session management**: List, create, rename, delete sessions
- **File browser**: Visual directory picker (server-controlled allowed paths)
- **Slash commands**: VS Code-style autocomplete (`/help`, `/model`, etc.)
- **Transcript view**: Toggle to show Chain of Thought and tool calls
- **User interactions**: Questions and confirmations displayed inline
- **Mobile responsive**: Full functionality on mobile devices
- **Real-time updates**: WebSocket for live session state
- **Attention queue**: Permission requests and questions with Allow/Deny
