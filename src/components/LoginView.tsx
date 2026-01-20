import { useState } from 'preact/hooks'

interface LoginViewProps {
  token: string
  loginError: string | null
  onTokenChange: (token: string) => void
  onConnect: () => void
}

export function LoginView({
  token,
  loginError,
  onTokenChange,
  onConnect
}: LoginViewProps) {
  const [showToken, setShowToken] = useState(false)

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      onConnect()
    }
  }

  return (
    <div class="login-container">
      <div class="login-card">
        <h1>Clarvis</h1>
        <p class="login-subtitle">Claude Code Web Interface</p>
        <div class="login-form">
          <div class="password-field">
            <input
              type={showToken ? 'text' : 'password'}
              placeholder="Enter your token"
              value={token}
              onInput={(e) => onTokenChange((e.target as HTMLInputElement).value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              class="toggle-visibility"
              onClick={() => setShowToken((s) => !s)}
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          {loginError && <div class="login-error">{loginError}</div>}
          <button class="btn-primary" onClick={onConnect}>
            Connect
          </button>
        </div>
      </div>
    </div>
  )
}
