import { useState, useEffect } from 'preact/hooks'
import { loadFromStorage, saveToStorage } from '@/utils/storage.ts'

/**
 * Hook that syncs state with localStorage.
 * Returns [value, setValue] like useState, but persists to localStorage.
 */
export function useStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => loadFromStorage(key, defaultValue))

  useEffect(() => {
    saveToStorage(key, value)
  }, [key, value])

  return [value, setValue]
}
