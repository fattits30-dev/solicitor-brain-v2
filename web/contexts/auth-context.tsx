'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  email: string
  username: string
  full_name: string
  role: 'admin' | 'solicitor' | 'paralegal' | 'client' | 'viewer'
  is_active: boolean
  is_verified: boolean
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email_or_username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<boolean>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const isAuthenticated = !!user

  // Define refreshToken function with useCallback to avoid dependency issues
  const refreshToken = useCallback(async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false
    
    const refresh_token = localStorage.getItem('refresh_token')
    if (!refresh_token) return false

    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh_token })
      })

      if (!response.ok) {
        return false
      }

      const data = await response.json()
      
      // Update stored tokens
      localStorage.setItem('access_token', data.tokens.access_token)
      localStorage.setItem('refresh_token', data.tokens.refresh_token)
      localStorage.setItem('user', JSON.stringify(data.user))
      
      setUser(data.user)
      return true
      
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    }
  }, [])

  // Check for existing auth on mount
  useEffect(() => {
    const initAuth = async () => {
      // Only run on client side
      if (typeof window === 'undefined') {
        setIsLoading(false)
        return
      }
      
      const token = localStorage.getItem('access_token')
      const savedUser = localStorage.getItem('user')
      
      if (token && savedUser) {
        try {
          // Try to parse the saved user first
          const parsedUser = JSON.parse(savedUser)
          setUser(parsedUser)
          
          // Then verify token with backend in background
          const response = await fetch('http://localhost:8000/api/v1/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (response.ok) {
            const userData = await response.json()
            setUser(userData)
          } else if (response.status === 401) {
            // Token expired, try to refresh
            const refreshed = await refreshToken()
            if (!refreshed) {
              // Refresh failed, clear auth
              localStorage.removeItem('access_token')
              localStorage.removeItem('refresh_token')
              localStorage.removeItem('user')
              setUser(null)
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error)
          // Clear invalid auth
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user')
          setUser(null)
        }
      }
      
      setIsLoading(false)
    }

    initAuth()
  }, [refreshToken])

  const login = async (email_or_username: string, password: string) => {
    setIsLoading(true)
    
    try {
      const response = await fetch('http://localhost:8000/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email_or_username, password })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Login failed')
      }

      const data = await response.json()
      
      // Store tokens and user data
      if (typeof window !== 'undefined') {
        localStorage.setItem('access_token', data.tokens.access_token)
        localStorage.setItem('refresh_token', data.tokens.refresh_token)
        localStorage.setItem('user', JSON.stringify(data.user))
      }
      
      setUser(data.user)
      
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('access_token')
        if (token) {
          // Call logout endpoint
          await fetch('http://localhost:8000/api/v1/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        }
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local storage and state
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
      }
      setUser(null)
      setIsLoading(false)
      router.push('/auth/login')
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    refreshToken
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protecting routes
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/auth/login')
      }
    }, [isAuthenticated, isLoading, router])

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
        </div>
      )
    }

    if (!isAuthenticated) {
      return null
    }

    return <Component {...props} />
  }
}

// Hook for role-based access control
export function usePermissions() {
  const { user } = useAuth()
  
  return {
    canUploadDocuments: user?.role ? ['admin', 'solicitor', 'paralegal'].includes(user.role) : false,
    canViewAllCases: user?.role ? ['admin', 'solicitor'].includes(user.role) : false,
    canManageUsers: user?.role === 'admin',
    canEditCases: user?.role ? ['admin', 'solicitor', 'paralegal'].includes(user.role) : false,
    isClient: user?.role === 'client',
    isStaff: user?.role ? ['admin', 'solicitor', 'paralegal'].includes(user.role) : false
  }
}