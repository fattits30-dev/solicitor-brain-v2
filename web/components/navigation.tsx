'use client'

import Link from 'next/link'
import { useAuth, usePermissions } from '@/contexts/auth-context'
import { LogOut, User, Settings, Upload, Search, FileText, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function Navigation() {
  const { user, isAuthenticated, logout, isLoading } = useAuth()
  const { canManageUsers, canUploadDocuments, isStaff } = usePermissions()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // During SSR or initial load, show minimal navigation
  if (!mounted || isLoading) {
    return (
      <nav className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              Solicitor Brain
            </Link>
            <div className="flex gap-4">
              {/* Empty during loading to prevent hydration mismatch */}
            </div>
          </div>
        </div>
      </nav>
    )
  }

  if (!isAuthenticated) {
    return (
      <nav className="border-b bg-white shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              Solicitor Brain
            </Link>
            <div className="flex gap-4">
              <Link 
                href="/auth/login" 
                className="text-sm font-medium text-gray-600 hover:text-blue-600"
              >
                Sign In
              </Link>
              <Link 
                href="/auth/register" 
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="border-b bg-white shadow-sm">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Solicitor Brain
          </Link>
          
          <div className="flex items-center gap-6">
            {/* Main Navigation */}
            <div className="flex gap-4">
              {canUploadDocuments && (
                <Link 
                  href="/" 
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
                >
                  <Upload size={16} />
                  Upload
                </Link>
              )}
              
              <Link 
                href="/search" 
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
              >
                <Search size={16} />
                Search
              </Link>
              
              <Link 
                href="/cases" 
                className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
              >
                <FileText size={16} />
                Cases
              </Link>
              
              {canManageUsers && (
                <Link 
                  href="/admin/users" 
                  className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-blue-600"
                >
                  <Users size={16} />
                  Users
                </Link>
              )}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4 border-l pl-4">
              <div className="text-sm">
                <div className="font-medium text-gray-900">{user?.full_name}</div>
                <div className="text-gray-500 capitalize">{user?.role}</div>
              </div>
              
              <div className="flex items-center gap-2">
                <Link 
                  href="/profile" 
                  className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-md"
                  title="Profile"
                >
                  <User size={16} />
                </Link>
                
                {isStaff && (
                  <Link 
                    href="/settings" 
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-md"
                    title="Settings"
                  >
                    <Settings size={16} />
                  </Link>
                )}
                
                <button
                  onClick={logout}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-gray-100 rounded-md"
                  title="Sign Out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}