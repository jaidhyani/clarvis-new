# Clarvis Development Guide

## Architecture

Clarvis is a thin web UI client for Claudekeeper. It has no backend logic - just a static file server and frontend JavaScript.

## Key Files

- `server.js` - Simple static file server
- `public/index.html` - Entry point
- `public/js/app.js` - Main Preact application
- `public/js/client.js` - Claudekeeper API client
- `public/css/main.css` - Dark theme styles

## Frontend Stack

- Preact + htm (no build step)
- ES modules loaded directly
- marked.js for markdown rendering
- highlight.js for code syntax highlighting

## Data Flow

1. User enters Claudekeeper URL/token
2. ClaudekeeperClient connects via WebSocket
3. Sessions and attention data fetched via REST
4. WebSocket events update state in real-time
5. User actions call REST endpoints

## Design Principles

- Minimal: no backend logic, just serves static files
- Real-time: WebSocket for instant updates
- Attention-focused: visual indicators for sessions needing input
