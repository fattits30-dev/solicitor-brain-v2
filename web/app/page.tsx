'use client'

import DocumentUpload from '@/components/document-upload'
import { useAuth, usePermissions } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()
  const { canUploadDocuments } = usePermissions()
  const router = useRouter()
  
  // Mock case ID for testing - in production this would come from case selection
  const mockCaseId = '123e4567-e89b-12d3-a456-426614174000'

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

  if (!canUploadDocuments) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-200">
          <h2 className="text-lg font-semibold text-yellow-900 mb-2">Access Restricted</h2>
          <p className="text-yellow-800">
            You do not have permission to upload documents. Please contact your administrator if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Document Upload
        </h1>
        <p className="text-gray-600">
          Upload documents for processing and analysis. Files will be automatically OCR&apos;d and indexed for search.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Case Information</h2>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
              Active Case
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Case ID:</span>
              <span className="ml-2 font-mono text-xs">{mockCaseId}</span>
            </div>
            <div>
              <span className="text-gray-500">Client:</span>
              <span className="ml-2">Test Client</span>
            </div>
          </div>
        </div>

        <DocumentUpload caseId={mockCaseId} />
      </div>

      <div className="mt-8 bg-blue-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Processing Pipeline</h3>
        <div className="space-y-2 text-sm text-blue-800">
          <div className="flex items-start">
            <span className="font-semibold mr-2">1.</span>
            <div>
              <strong>Upload & Deduplication:</strong> Files are checked for duplicates using SHA256 hashing
            </div>
          </div>
          <div className="flex items-start">
            <span className="font-semibold mr-2">2.</span>
            <div>
              <strong>OCR Processing:</strong> Text extraction from PDFs and images using Tesseract
            </div>
          </div>
          <div className="flex items-start">
            <span className="font-semibold mr-2">3.</span>
            <div>
              <strong>Smart Chunking:</strong> Documents split into semantic chunks for better retrieval
            </div>
          </div>
          <div className="flex items-start">
            <span className="font-semibold mr-2">4.</span>
            <div>
              <strong>Embedding Generation:</strong> Vector embeddings created for semantic search
            </div>
          </div>
          <div className="flex items-start">
            <span className="font-semibold mr-2">5.</span>
            <div>
              <strong>Indexing:</strong> Stored in PostgreSQL with pgvector for instant search
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}