import type { SlashCommand } from '@/types/api.ts'

/** Slash commands available in the input */
export const SLASH_COMMANDS: SlashCommand[] = [
  { name: 'help', description: 'Show available commands' },
  { name: 'clear', description: 'Clear conversation history' },
  { name: 'compact', description: 'Summarize and compact conversation' },
  { name: 'bug', description: 'Report a bug in the current project' },
  { name: 'config', description: 'View or modify configuration' },
  { name: 'cost', description: 'Show token usage and costs' },
  { name: 'doctor', description: 'Check system health' },
  { name: 'init', description: 'Initialize Claude Code in a project' },
  { name: 'login', description: 'Log in to your account' },
  { name: 'logout', description: 'Log out of your account' },
  { name: 'mcp', description: 'Manage MCP servers' },
  { name: 'memory', description: 'Edit CLAUDE.md memory file' },
  { name: 'model', description: 'Switch AI model' },
  { name: 'permissions', description: 'View or manage permissions' },
  { name: 'pr-comments', description: 'View PR comments' },
  { name: 'review', description: 'Review code changes' },
  { name: 'terminal-setup', description: 'Set up terminal integration' },
  { name: 'vim', description: 'Toggle vim mode' },
  { name: 'add-dir', description: 'Add a directory to context' }
]

/** Default number of sessions to show per workdir */
export const DEFAULT_VISIBLE_SESSIONS = 5

/** How long to wait before refreshing sessions after creating one */
export const SESSION_CREATION_REFRESH_DELAY_MS = 2000

/** Maximum length for auto-generated session names from prompts */
export const MAX_SESSION_NAME_LENGTH = 128
