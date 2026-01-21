# Changelog

All notable changes to Clarvis will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Inline tool call display showing tool name and key parameter (e.g., `Read (file.ts)`, `Bash (git status)`)
- Collapsible tool results - click to expand full output
- "Working..." indicator with pulsing animation when Claude is processing
- Instant scroll-to-bottom when loading conversation history
- V2 features documentation with screenshots

### Changed
- Message rendering now displays content blocks in order (text, tool_use, tool_result interleaved)
- Loading indicator now uses session status from WebSocket instead of local state

### Fixed
- Broken bouncing dots loading animation replaced with working session-status indicator
- Conversation history no longer scrolls visibly when switching sessions

## [0.3.0] - 2026-01-19

### Added
- TypeScript migration with strict type checking
- Dynamic syntax highlighting for code blocks
- Session grouping by workdir in sidebar

## [0.2.0] - 2026-01-18

### Added
- Session management (create, delete, rename)
- Permission mode selection
- Attention item handling (allow/deny)
- Pull-to-refresh on mobile

## [0.1.0] - 2026-01-17

### Added
- Initial release
- WebSocket connection to Claudekeeper
- Session list with search and filter
- Message display with markdown rendering
- Dark theme UI
