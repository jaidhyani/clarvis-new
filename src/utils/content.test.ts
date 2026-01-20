import { describe, it, expect } from 'vitest'
import { extractTextContent, hasToolUse, getWorkdirName } from './content.ts'

describe('extractTextContent', () => {
  it('returns empty string for null/undefined', () => {
    expect(extractTextContent(null)).toBe('')
    expect(extractTextContent(undefined)).toBe('')
  })

  it('returns string content directly', () => {
    expect(extractTextContent('hello world')).toBe('hello world')
  })

  it('extracts text from content block array', () => {
    const content = [
      { type: 'text' as const, text: 'First line' },
      { type: 'tool_use' as const, id: '1', name: 'test', input: {} },
      { type: 'text' as const, text: 'Second line' }
    ]
    expect(extractTextContent(content)).toBe('First line\nSecond line')
  })

  it('extracts text from object with text property', () => {
    expect(extractTextContent({ text: 'object text' })).toBe('object text')
  })
})

describe('hasToolUse', () => {
  it('returns false for string content', () => {
    expect(hasToolUse('hello')).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(hasToolUse(undefined)).toBe(false)
  })

  it('returns true when tool_use block exists', () => {
    const content = [
      { type: 'text' as const, text: 'hello' },
      { type: 'tool_use' as const, id: '1', name: 'test', input: {} }
    ]
    expect(hasToolUse(content)).toBe(true)
  })

  it('returns false when no tool_use blocks', () => {
    const content = [
      { type: 'text' as const, text: 'hello' }
    ]
    expect(hasToolUse(content)).toBe(false)
  })
})

describe('getWorkdirName', () => {
  it('extracts last path segment', () => {
    expect(getWorkdirName('/home/user/project')).toBe('project')
  })

  it('handles single segment', () => {
    expect(getWorkdirName('project')).toBe('project')
  })

  it('handles trailing slash', () => {
    // Current behavior - returns empty string for trailing slash
    // This is a known edge case
    expect(getWorkdirName('/home/user/project/')).toBe('')
  })
})
