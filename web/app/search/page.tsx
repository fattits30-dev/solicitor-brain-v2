'use client'

import { useState } from 'react'
import { Search, FileText, Loader2, ChevronRight } from 'lucide-react'
import axios from 'axios'
import { cn } from '@/lib/utils'

interface SearchResult {
  chunk_id: string
  document_id: string
  document_name: string
  chunk_text: string
  similarity_score: number
  page_number?: number
  chunk_index: number
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchType, setSearchType] = useState<'semantic' | 'hybrid'>('semantic')
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await axios.post(
        `http://localhost:8000/api/v1/search/${searchType}`,
        searchType === 'semantic' 
          ? { query, limit: 20, threshold: 0.3 }
          : { query, limit: 20, keyword_weight: 0.3, semantic_weight: 0.7 }
      )
      setResults(response.data)
    } catch (error) {
      console.error('Search failed:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const toggleExpanded = (chunkId: string) => {
    setExpandedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(chunkId)) {
        newSet.delete(chunkId)
      } else {
        newSet.add(chunkId)
      }
      return newSet
    })
  }

  const highlightQuery = (text: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 font-semibold">{part}</mark>
        : part
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Document Search
        </h1>
        <p className="text-gray-600">
          Search across all documents using semantic search powered by AI embeddings
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter your search query..."
                className="w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={cn(
                "px-6 py-3 rounded-lg font-medium transition-colors",
                loading || !query.trim()
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-primary text-white hover:bg-primary/90"
              )}
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                'Search'
              )}
            </button>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                name="searchType"
                value="semantic"
                checked={searchType === 'semantic'}
                onChange={(e) => setSearchType(e.target.value as 'semantic')}
                className="mr-2"
              />
              <span className="text-sm">Semantic Search</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="searchType"
                value="hybrid"
                checked={searchType === 'hybrid'}
                onChange={(e) => setSearchType(e.target.value as 'hybrid')}
                className="mr-2"
              />
              <span className="text-sm">Hybrid Search (Semantic + Keyword)</span>
            </label>
          </div>
        </form>
      </div>

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Found {results.length} results
            </h2>
            <span className="text-sm text-gray-500">
              Sorted by relevance
            </span>
          </div>

          {results.map((result) => {
            const isExpanded = expandedResults.has(result.chunk_id)
            return (
              <div
                key={result.chunk_id}
                className="bg-white rounded-lg shadow-sm border overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {result.document_name}
                      </span>
                      {result.page_number && (
                        <span className="text-sm text-gray-500">
                          • Page {result.page_number}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded-full">
                        {(result.similarity_score * 100).toFixed(1)}% match
                      </span>
                      <button
                        onClick={() => toggleExpanded(result.chunk_id)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <ChevronRight 
                          className={cn(
                            "h-4 w-4 transition-transform",
                            isExpanded && "rotate-90"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  <div className={cn(
                    "text-sm text-gray-700 leading-relaxed",
                    !isExpanded && "line-clamp-3"
                  )}>
                    {highlightQuery(result.chunk_text)}
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        <div>
                          <span className="font-medium">Document ID:</span>
                          <span className="ml-1 font-mono">{result.document_id.slice(0, 8)}...</span>
                        </div>
                        <div>
                          <span className="font-medium">Chunk Index:</span>
                          <span className="ml-1">{result.chunk_index}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <div className="text-center py-12">
          <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No results found for "{query}"</p>
          <p className="text-sm text-gray-400 mt-2">
            Try different keywords or adjust your search query
          </p>
        </div>
      )}
    </div>
  )
}