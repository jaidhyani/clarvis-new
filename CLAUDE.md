# Clarvis Development Guide

## Architecture

Clarvis is a thin web UI client for Claudekeeper. The server handles static files, API proxying, and the filesystem browser endpoint.

## Key Files

- `server.js` - Static server + API proxy + filesystem browser
- `public/index.html` - Entry point
- `public/js/app.js` - Main Preact application
- `public/js/client.js` - Claudekeeper API client
- `public/css/main.css` - Claude.ai dark theme styles

## Server Endpoints

- `/*` - Static files from `public/`
- `/api/*` - Proxied to Claudekeeper
- `/ws` - WebSocket proxy to Claudekeeper
- `/api/browse?path=` - Filesystem browser (respects ALLOWED_ROOTS)

## Frontend Stack

- Preact + htm (no build step)
- ES modules loaded directly
- marked.js for markdown rendering
- highlight.js for code syntax highlighting

## V2 Features

- **File browser**: Modal with directory tree, ALLOWED_ROOTS security
- **Session rename**: Double-click name in sidebar, Enter/Escape to save/cancel
- **Slash commands**: VS Code-style autocomplete above input
- **Transcript toggle**: Button shows/hides CoT and tool calls
- **User interactions**: Inline cards with question + answer
- **Mobile**: Dismissible sidebar, input never covered

## Data Flow

1. User enters token (stored in localStorage)
2. ClaudekeeperClient connects via WebSocket
3. Sessions and attention data fetched via REST
4. WebSocket events update state in real-time
5. User actions call REST endpoints

## Design Principles

- Minimal: thin UI layer, Claudekeeper handles logic
- Real-time: WebSocket for instant updates
- Mobile-first: full productivity on any device
- Security: server controls filesystem access via ALLOWED_ROOTS
