# Clarvis V2 Specification

## Overview

Clarvis is a thin web UI client for Claudekeeper. This spec covers UI enhancements to make Clarvis a fully-featured Claude Code interface. Claudekeeper backend features are out of scope (separate project).

## Design System

- **Style:** Claude.ai aesthetic - clean, approachable, well-spaced
- **Theme:** Dark only
- **Typography:** System fonts for UI, monospace for code/transcripts

## Features

### 1. Filesystem Browser

Project selection via visual file browser instead of typing paths.

**Behavior:**
- Server config defines allowed root directories (`.env` or config file)
- Browser only shows directories within allowed roots
- User navigates tree to select project folder
- No arbitrary path access - security controlled server-side

**UI:**
- Tree view with expandable directories
- Current path breadcrumb
- Select button to confirm choice

---

### 2. Session Naming

Rename sessions anytime from the session list.

**Behavior:**
- Sessions can be renamed at any time (not just creation)
- Edit inline or via context menu
- Name persists in Claudekeeper

---

### 3. Session Import

Import existing Claude Code sessions from disk.

**Behavior:**
- One-time import (copies session data into system)
- Registers session in Claudekeeper
- Clarvis is thin UI layer - import logic lives in Claudekeeper
- Not an archiving tool - this is core session management

---

### 4. Mobile Fixes

Fix critical mobile usability issues.

**Issues to fix:**
1. Nav bar covers input area - must not overlap
2. Nav bar can't be dismissed - need way to hide/show

**Goal:** Full productivity on mobile (everything desktop can do, responsive)

---

### 5. Slash Commands

Full `/command` support mirroring Claude Code functionality.

**Scope:** All commands (not a subset)

**Autocomplete UX (VS Code style):**
- Floating ephemeral UI element above text input
- Appears when user types `/`
- Fuzzy matches `/<typed string>`
- Dedicated `/` button triggers same UI with all options
- Indicates currently selected command (for tab completion)
- Selecting from UI enters command into text input
- Replaces/completes partial command text

---

### 6. User Interactions in History

Make user interactions (questions, confirmations) visible in conversation.

**Display:** Inline in conversation flow with distinct styling
- Visually differentiated from assistant/user messages
- Shows the interaction prompt and user's response

---

### 7. Detailed Transcript View

Show Chain of Thought and tool calls/results (ctrl+o equivalent).

**Detail level:** Full CoT + tool calls and results

**UX:** Toggle mode
- Same conversation area
- Toggle switches between normal view and detailed view
- No modal or separate route
- Keyboard shortcut (ctrl+o or similar)

---

## Implementation Notes

### Allowed Roots Configuration

Server config (not UI-configurable):
```
ALLOWED_ROOTS=/home/user/projects,/var/www
```

### Out of Scope

- Claudekeeper backend changes (separate project/spec)
- Light theme
- Archiving functionality

### Implementer Discretion

If opportunities arise for strong wins with little/no downside, take them. Document any deviations from this plan.
