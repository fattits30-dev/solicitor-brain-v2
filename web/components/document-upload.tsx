'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'

interface UploadedFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  message?: string
  documentId?: string
}

export default function DocumentUpload({ caseId }: { caseId: string }) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0
    }))
    setFiles(prev => [...prev, ...newFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'text/*': ['.txt', '.md'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
    },
    maxSize: 100 * 1024 * 1024 // 100MB
  })

  const uploadFiles = async () => {
    setUploading(true)
    
    for (let i = 0; i < files.length; i++) {
      const uploadFile = files[i]
      if (uploadFile.status !== 'pending') continue

      setFiles(prev => prev.map((f, idx) => 
        idx === i ? { ...f, status: 'uploading', progress: 0 } : f
      ))

      const formData = new FormData()
      formData.append('file', uploadFile.file)
      formData.append('case_id', caseId)
      formData.append('uploaded_by_id', '00000000-0000-0000-0000-000000000001') // Mock user ID

      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
        const response = await axios.post(
          'http://localhost:8000/api/v1/documents/upload',
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              ...(token && { 'Authorization': `Bearer ${token}` })
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / (progressEvent.total || 100)
              )
              setFiles(prev => prev.map((f, idx) => 
                idx === i ? { ...f, progress: percentCompleted } : f
              ))
            }
          }
        )

        setFiles(prev => prev.map((f, idx) => 
          idx === i ? {
            ...f,
            status: 'success',
            progress: 100,
            message: response.data.duplicate ? 'Duplicate (already exists)' : 'Uploaded successfully',
            documentId: response.data.document_id
          } : f
        ))
      } catch (error: any) {
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? {
            ...f,
            status: 'error',
            message: error.response?.data?.detail || 'Upload failed'
          } : f
        ))
      }
    }
    
    setUploading(false)
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <File className="h-4 w-4 text-gray-400" />
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">Drop the files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-2">Drag & drop documents here</p>
            <p className="text-sm text-gray-500">or click to select files</p>
            <p className="text-xs text-gray-400 mt-2">
              Supports PDF, Images (PNG, JPG), Text files, and Word documents (max 100MB)
            </p>
          </>
        )}
      </div>

      {files.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="font-medium text-gray-900 mb-3">Files to upload</h3>
          {files.map((uploadFile, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-white rounded-lg border"
            >
              <div className="flex items-center space-x-3 flex-1">
                {getStatusIcon(uploadFile.status)}
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {uploadFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB
                    {uploadFile.message && ` • ${uploadFile.message}`}
                  </p>
                  {uploadFile.status === 'uploading' && (
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${uploadFile.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {uploadFile.status !== 'uploading' && (
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 p-1 hover:bg-gray-100 rounded"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              )}
            </div>
          ))}
          
          <div className="flex justify-end mt-4">
            <button
              onClick={uploadFiles}
              disabled={uploading || files.every(f => f.status !== 'pending')}
              className={cn(
                "px-4 py-2 rounded-lg font-medium transition-colors",
                uploading || files.every(f => f.status !== 'pending')
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-primary text-white hover:bg-primary/90"
              )}
            >
              {uploading ? (
                <>
                  <Loader2 className="inline-block h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Upload Documents'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}