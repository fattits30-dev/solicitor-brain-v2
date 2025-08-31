import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Solicitor Brain - Document Intelligence',
  description: 'Trauma-informed UK legal case management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
          <nav className="border-b bg-white shadow-sm">
            <div className="container mx-auto px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-primary">Solicitor Brain</h1>
                <div className="flex gap-4">
                  <a href="/" className="text-sm font-medium hover:text-primary">Upload</a>
                  <a href="/search" className="text-sm font-medium hover:text-primary">Search</a>
                  <a href="/cases" className="text-sm font-medium hover:text-primary">Cases</a>
                </div>
              </div>
            </div>
          </nav>
          <main className="container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}