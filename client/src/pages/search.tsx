import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { Case } from '@shared/schema';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  FileText,
  Filter,
  Hash,
  History,
  Search as SearchIcon,
  Sparkles,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface SearchResult {
  id: string;
  documentId: string;
  documentName: string;
  caseId?: string;
  caseTitle?: string;
  caseRef?: string;
  snippet: string;
  page?: number;
  chunkIndex?: number;
  score: number;
  type?: string;
  createdAt: string;
  citation: {
    source: string;
    page?: number;
    confidence: number;
  };
}

interface SearchResponse {
  query: string;
  searchType: string;
  total: number;
  results: SearchResult[];
  timestamp: string;
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchType, setSearchType] = useState<'hybrid' | 'vector' | 'keyword'>('hybrid');
  const [caseFilter, setCaseFilter] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch cases for filter dropdown
  const { data: cases } = useQuery<Case[]>({
    queryKey: ['/api/cases'],
  });

  // Toast hook
  const { toast } = useToast();

  // Search mutation
  const searchMutation = useMutation({
    mutationFn: async (payload: any) => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Search failed');
      }

      return response.json() as Promise<SearchResponse>;
    },
    onError: (error: any) => {
      toast({
        title: 'Search failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Search suggestions query
  const { data: suggestions } = useQuery({
    queryKey: ['/api/search/suggestions', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return { suggestions: [] };

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return { suggestions: [] };
      return response.json();
    },
    enabled: searchQuery.length >= 2,
  });

  // Search history query
  const { data: searchHistory } = useQuery({
    queryKey: ['/api/search/history'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/search/history?limit=5', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) return { history: [] };
      return response.json();
    },
  });

  const performSearch = useCallback(() => {
    if (!debouncedQuery.trim()) return;

    searchMutation.mutate({
      query: debouncedQuery,
      searchType,
      caseId: caseFilter || undefined,
      filters: {
        documentType: documentTypeFilter || undefined,
      },
      limit: 20,
    });
  }, [debouncedQuery, searchType, caseFilter, documentTypeFilter]);

  // Auto-search when filters or query change
  useEffect(() => {
    if (debouncedQuery) {
      performSearch();
    }
  }, [debouncedQuery, searchType, caseFilter, documentTypeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'text-green-600 dark:text-green-400';
    if (score >= 0.7) return 'text-blue-600 dark:text-blue-400';
    if (score >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Search" subtitle="AI-powered search across all documents and cases" />

        <div className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl mx-auto p-6 space-y-6">
            {/* Search Bar */}
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-1 relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search documents, cases, legal terms..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 text-base"
                        autoFocus
                      />

                      {/* Search suggestions dropdown */}
                      {suggestions?.suggestions && suggestions.suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg z-10">
                          <ScrollArea className="max-h-60">
                            {suggestions.suggestions.map((suggestion: string, i: number) => (
                              <button
                                key={i}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-muted text-sm"
                                onClick={() => setSearchQuery(suggestion)}
                              >
                                {suggestion}
                              </button>
                            ))}
                          </ScrollArea>
                        </div>
                      )}
                    </div>

                    <Button
                      type="submit"
                      disabled={searchMutation.isPending || !searchQuery.trim()}
                    >
                      {searchMutation.isPending ? <>Searching...</> : <>Search</>}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {(caseFilter || documentTypeFilter) && (
                        <Badge variant="secondary" className="ml-2">
                          {[caseFilter, documentTypeFilter].filter(Boolean).length}
                        </Badge>
                      )}
                    </Button>
                  </div>

                  {/* Filters */}
                  {showFilters && (
                    <div className="flex gap-4 pt-2 border-t">
                      <Select value={searchType} onValueChange={(v: any) => setSearchType(v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hybrid">
                            <Sparkles className="h-4 w-4 inline mr-2" />
                            Hybrid Search
                          </SelectItem>
                          <SelectItem value="vector">AI Semantic</SelectItem>
                          <SelectItem value="keyword">Keyword Only</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={caseFilter} onValueChange={setCaseFilter}>
                        <SelectTrigger className="w-64">
                          <SelectValue placeholder="All Cases" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Cases</SelectItem>
                          {cases?.map((case_) => (
                            <SelectItem key={case_.id} value={case_.id}>
                              {case_.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="All Types" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">All Types</SelectItem>
                          <SelectItem value="contract">Contracts</SelectItem>
                          <SelectItem value="email">Emails</SelectItem>
                          <SelectItem value="letter">Letters</SelectItem>
                          <SelectItem value="evidence">Evidence</SelectItem>
                          <SelectItem value="court_document">Court Documents</SelectItem>
                        </SelectContent>
                      </Select>

                      {(caseFilter || documentTypeFilter) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setCaseFilter('');
                            setDocumentTypeFilter('');
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>

            {/* Search History */}
            {!searchQuery && searchHistory?.history && searchHistory.history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Recent Searches
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.history.map((item: any, i: number) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        onClick={() => setSearchQuery(item.query)}
                      >
                        {item.query}
                        <Badge variant="secondary" className="ml-2">
                          {item.results_count}
                        </Badge>
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Results */}
            {searchMutation.data && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Search Results</CardTitle>
                      <CardDescription>
                        Found {searchMutation.data.total} results for "{searchMutation.data.query}"
                      </CardDescription>
                    </div>
                    <Badge variant="outline">{searchMutation.data.searchType} search</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {searchMutation.data.results.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No results found</h3>
                      <p className="text-muted-foreground">
                        Try adjusting your search terms or filters
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {searchMutation.data.results.map((result) => (
                        <div
                          key={result.id}
                          className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{result.documentName}</span>
                              {result.page && <Badge variant="secondary">Page {result.page}</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-medium ${getScoreColor(result.score)}`}
                              >
                                {Math.round(result.score * 100)}% match
                              </span>
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-3">
                            {highlightText(result.snippet, searchQuery)}
                          </p>

                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                              {result.caseTitle && (
                                <div className="flex items-center gap-1">
                                  <Hash className="h-3 w-3" />
                                  {result.caseTitle}
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(result.createdAt), 'MMM d, yyyy')}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {result.caseId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => (window.location.href = `/cases/${result.caseId}`)}
                                >
                                  View Case
                                  <ChevronRight className="h-3 w-3 ml-1" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  (window.location.href = `/documents/${result.documentId}`)
                                }
                              >
                                View Document
                                <ChevronRight className="h-3 w-3 ml-1" />
                              </Button>
                            </div>
                          </div>

                          {/* Citation info */}
                          {result.citation && (
                            <div className="mt-2 pt-2 border-t">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  Citation
                                </Badge>
                                <span>{result.citation.source}</span>
                                {result.citation.page && <span>• Page {result.citation.page}</span>}
                                <span>
                                  • {Math.round(result.citation.confidence * 100)}% confidence
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Loading state */}
            {searchMutation.isPending && (
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Tips */}
            {!searchQuery && !searchMutation.data && (
              <Card>
                <CardHeader>
                  <CardTitle>Search Tips</CardTitle>
                  <CardDescription>Get the most out of AI-powered search</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="natural" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="natural">Natural Language</TabsTrigger>
                      <TabsTrigger value="keywords">Keywords</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    <TabsContent value="natural" className="mt-4">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">Ask questions in plain English:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>"What are the key terms in the employment contract?"</li>
                          <li>"Find all documents mentioning compensation"</li>
                          <li>"Show me correspondence from January 2024"</li>
                        </ul>
                      </div>
                    </TabsContent>

                    <TabsContent value="keywords" className="mt-4">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">
                          Use specific terms for exact matches:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Contract numbers: "EMP-2024-001"</li>
                          <li>Legal terms: "breach", "termination", "liability"</li>
                          <li>Names and entities: "John Smith", "TechCorp Ltd"</li>
                        </ul>
                      </div>
                    </TabsContent>

                    <TabsContent value="advanced" className="mt-4">
                      <div className="space-y-2 text-sm">
                        <p className="text-muted-foreground">Advanced search features:</p>
                        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                          <li>Hybrid search combines AI understanding with keyword matching</li>
                          <li>Vector search finds conceptually similar content</li>
                          <li>Filter by case or document type for focused results</li>
                          <li>All searches include automatic PII redaction</li>
                        </ul>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
