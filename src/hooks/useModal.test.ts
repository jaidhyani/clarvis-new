import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/preact'
import { useModal } from './useModal.ts'

describe('useModal', () => {
  it('starts with empty stack', () => {
    const { result } = renderHook(() => useModal())
    expect(result.current.modalStack).toEqual([])
    expect(result.current.activeModal).toBeNull()
  })

  it('opens modal onto stack', () => {
    const { result } = renderHook(() => useModal())

    act(() => {
      result.current.openModal('newSession')
    })

    expect(result.current.modalStack).toHaveLength(1)
    expect(result.current.activeModal).toBe('newSession')
  })

  it('opens child modal onto stack', () => {
    const { result } = renderHook(() => useModal())

    act(() => {
      result.current.openModal('newSession')
    })

    act(() => {
      result.current.openModal('fileBrowser')
    })

    expect(result.current.modalStack).toHaveLength(2)
    expect(result.current.activeModal).toBe('fileBrowser')
  })

  it('closeModal pops child, returns to parent', () => {
    const { result } = renderHook(() => useModal())

    act(() => {
      result.current.openModal('newSession')
      result.current.openModal('fileBrowser')
    })

    act(() => {
      result.current.closeModal()
    })

    expect(result.current.modalStack).toHaveLength(1)
    expect(result.current.activeModal).toBe('newSession')
  })

  it('closeAllModals clears stack', () => {
    const { result } = renderHook(() => useModal())

    act(() => {
      result.current.openModal('newSession')
      result.current.openModal('fileBrowser')
    })

    act(() => {
      result.current.closeAllModals()
    })

    expect(result.current.modalStack).toHaveLength(0)
    expect(result.current.activeModal).toBeNull()
  })

  it('passes modal data', () => {
    const { result } = renderHook(() => useModal())

    act(() => {
      result.current.openModal('workdirConfig', '/home/user/project')
    })

    expect(result.current.modalData).toBe('/home/user/project')
  })
})
