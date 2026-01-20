import { forwardRef } from 'preact/compat'

interface SearchBoxProps {
  value: string
  onChange: (value: string) => void
  onClear: () => void
}

export const SearchBox = forwardRef<HTMLInputElement, SearchBoxProps>(
  ({ value, onChange, onClear }, ref) => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClear()
        ;(e.target as HTMLInputElement).blur()
      }
    }

    return (
      <div class="search-box">
        <input
          type="text"
          ref={ref}
          value={value}
          onInput={(e) => onChange((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Search sessions... (⌘K)"
        />
        {value && (
          <button class="search-clear" onClick={onClear}>
            ×
          </button>
        )}
      </div>
    )
  }
)
