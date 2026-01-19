# Clarvis V2 Spec - Interview Progress

**Status:** Interview complete

## Answers So Far

### Filesystem Browser
- **Approach:** Allowed roots only (server config controls safe directories)
- **Configuration:** Server config only (admin sets paths in .env or config file)

### Session Naming
- **When:** Anytime (can rename existing sessions from session list)

### Session Import
- **Mode:** One-time import (copy session data into Clarvis)
- **Scope:** Just register the session in Claudekeeper - Clarvis is thin UI layer, Claudekeeper is thin orchestration layer
- **Note:** Claudekeeper is NOT an archiving tool - it's core session management that Clarvis relies on

### Mobile
- **Focus:** Full productivity (everything desktop can do, responsive)
- **Nav bar issues:** Covers input area AND can't dismiss - two bugs to fix

### Slash Commands
- **Scope:** All commands (mirror full Claude Code functionality)
- **Autocomplete UX:** VS Code style
  - Floating ephemeral UI element above text input
  - Fuzzy matches `/<typed string>`
  - Dedicated "/" button triggers same UI with all options
  - Indicates currently "selected" command for tab completion
  - Selecting from UI enters command into text input (completing/replacing partial)

### Transcript View (ctrl+o equivalent)
- **Detail level:** Full CoT + tool calls and results

### User Interactions in History
- **Display:** Inline in conversation with distinct styling

### Claudekeeper Scope
- **Status:** Separate project - this spec is Clarvis UI only
- Clarvis calls Claudekeeper APIs; any backend features are out of scope

### Transcript View UX
- **Mode:** Toggle mode (switch between normal view and detailed view in same space)
- Same conversation area, toggle to show/hide CoT and tool details

### Design Direction
- **Style:** Claude.ai style (clean, light/dark themes, approachable)
- Emulate Anthropic's web UI aesthetic

### Theme Support
- **Mode:** Dark only (single dark theme)

### Priority
- **Order:** No priority - tackle in whatever order makes sense

### Implementation Discretion
- If implementer sees opportunities for strong wins with little/no downside, take them
- Document any deviations from the plan

## All Questions Answered

## Original Feature List

1. Filesystem browser for project selection (no more typing full paths)
2. Session naming/renaming anytime
3. Nav bar always hidable (fix mobile breakage)
4. Full /slash command support with autocomplete
5. Frontend polish pass (mobile focus)
6. User interactions visible in conversation history
7. Detailed transcript view (CoT + tool calls)
8. Import existing Claude Code sessions from disk
