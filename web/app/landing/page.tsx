import Link from 'next/link'
import { Shield, FileText, Search, Users } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Solicitor Brain
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Trauma-informed UK Legal Case Management System
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/auth/login"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-6 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-lg font-medium hover:bg-blue-50 transition"
            >
              Get Started
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mt-16">
          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
              <FileText className="text-blue-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Document Intelligence</h3>
            <p className="text-gray-600 text-sm">
              Automatic OCR, smart chunking, and intelligent document processing
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
              <Search className="text-green-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Semantic Search</h3>
            <p className="text-gray-600 text-sm">
              AI-powered search across all case documents and communications
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
              <Users className="text-purple-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">Role-Based Access</h3>
            <p className="text-gray-600 text-sm">
              Secure access control for solicitors, paralegals, and clients
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mb-4">
              <Shield className="text-red-600" size={24} />
            </div>
            <h3 className="text-lg font-semibold mb-2">GDPR Compliant</h3>
            <p className="text-gray-600 text-sm">
              Full audit trail, consent management, and data protection
            </p>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold mb-8">Powered by Modern Technology</h2>
          <div className="flex flex-wrap gap-4 justify-center">
            <span className="px-4 py-2 bg-gray-100 rounded-full text-sm">Next.js</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full text-sm">FastAPI</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full text-sm">PostgreSQL</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full text-sm">pgvector</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full text-sm">Tesseract OCR</span>
            <span className="px-4 py-2 bg-gray-100 rounded-full text-sm">JWT Auth</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t text-center text-gray-500 text-sm">
          <p>© 2024 Solicitor Brain. Trauma-informed legal case management.</p>
          <p className="mt-2">Built with security, accessibility, and user wellbeing in mind.</p>
        </div>
      </div>
    </div>
  )
}