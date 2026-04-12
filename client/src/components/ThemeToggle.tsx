import { useTheme } from '../theme/ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextLabel = theme === 'dark' ? 'Light mode' : 'Dark mode'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      title={nextLabel}
      aria-label={nextLabel}
    >
      <span className="theme-toggle-text">{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
    </button>
  )
}
