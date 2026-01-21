# Inline Tool Calls & UX Improvements

## Overview

Four UX improvements to make Clarvis display conversations more like Claude Code.

## Changes

### 1. Inline Tool Calls

**Goal**: Display tool_use and tool_result blocks inline within messages, matching Claude Code's display.

**Current behavior**: Tool calls are hidden unless "detailed view" is enabled. Only text content shows.

**New behavior**: Render all content blocks in order (text, tool_use, tool_result interleaved as they appear in the content array).

**Tool display format**:
```
● ToolName(key_param: value)
  └─ First line of result truncated to ~80 chars...
```

- Collapsed by default showing truncated first line of result
- Click to expand full result
- Tool results linked to tool_use via `tool_use_id`

**Files to modify**:
- `src/components/Chat/Message.tsx` - Main rendering logic
- `src/utils/content.ts` - Add helper to extract key param for display
- `public/css/main.css` - Styles for tool blocks

### 2. Instant Scroll-to-Bottom

**Goal**: When loading conversation history, start at the bottom instantly (no visible scrolling).

**Current behavior**: Messages load, then smooth-scroll to bottom (user sees scroll animation through history).

**New behavior**:
- Use `useLayoutEffect` to set `scrollTop = scrollHeight` before browser paints
- Only use smooth scroll for new messages arriving during active session

**Files to modify**:
- `src/components/Chat/MessageList.tsx` - Add initial load detection, use useLayoutEffect

### 3. "Working..." Loading Indicator

**Goal**: Show when Claude is working, using session status from WebSocket.

**Current behavior**: Bouncing dots triggered by `awaitingResponse` state (broken).

**New behavior**:
- Show indicator when `activeSession?.status === 'running'`
- Display: pulsing dot + "Working..." text
- Remove dependency on `awaitingResponse` for the indicator (may keep for optimistic message display)

**Files to modify**:
- `src/components/Chat/MessageList.tsx` - Replace loading indicator, add `sessionStatus` prop
- `src/App.tsx` - Pass session status to MessageList
- `public/css/main.css` - Pulsing animation styles

### 4. Detailed View (Deferred)

Noted for future: Full ctrl+o style detailed view. The expandable tool results from #1 are a step toward this.

## Implementation Order

1. Inline tool calls (biggest visual change)
2. "Working..." indicator (fixes broken feature)
3. Instant scroll-to-bottom (polish)

## Testing

- Load a session with tool calls, verify they display inline in correct order
- Verify tool results are collapsible
- Start a new query, verify "Working..." appears when session is running
- Switch between sessions, verify scroll starts at bottom without animation
