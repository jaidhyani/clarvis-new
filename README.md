# Clarvis

Web UI for Claude Code sessions via Claudekeeper.

## Overview

Clarvis is a lightweight web interface that connects to a Claudekeeper server to display and interact with Claude Code sessions. It provides:

- Session list grouped by working directory
- Attention indicators for sessions needing input
- Real-time message streaming
- Permission request handling
- Interactive messaging

## Setup

1. Start Claudekeeper first:
   ```bash
   cd ../claudekeeper && npm start
   ```

2. Start Clarvis:
   ```bash
   npm start
   ```

3. Open http://localhost:3000 in your browser

4. Enter your Claudekeeper URL and token to connect

## Configuration

Clarvis stores connection settings in localStorage. On first visit, enter:
- **URL**: Claudekeeper server URL (default: http://localhost:3100)
- **Token**: Your Claudekeeper authentication token

## Features

- **Session filtering**: Show all sessions or only those needing attention
- **Real-time updates**: WebSocket connection for live session updates
- **Attention queue**: Visual indicators and cards for permission requests
- **Interactive mode**: Send messages to active sessions
