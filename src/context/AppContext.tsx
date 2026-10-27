import React, { createContext, useContext, useState, useEffect } from 'react'

interface AppContextType {
  theme: 'dark' | 'light'
  toggleTheme: () => void
  showToast: (msg: string) => void
  toast: string | null
  globalSearch: string
  setGlobalSearch: (q: string) => void
  cmdOpen: boolean
  setCmdOpen: (open: boolean) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('predictintel-theme') as 'dark' | 'light') || 'dark'
    } catch {
      return 'dark'
    }
  })

  const [toast, setToast] = useState<string | null>(null)
  const [globalSearch, setGlobalSearch] = useState('')
  const [cmdOpen, setCmdOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('predictintel-theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3800)
  }

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        showToast,
        toast,
        globalSearch,
        setGlobalSearch,
        cmdOpen,
        setCmdOpen
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
