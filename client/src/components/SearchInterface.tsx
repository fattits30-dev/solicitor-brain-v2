import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Search, 
  Filter, 
  FileText, 
  Calendar,
  User,
  Tag,
  Brain,
  Sparkles,
  ChevronRight,
  Clock
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SearchResult {
  id: string;
  documentId: string;
  documentName: string;
  excerpt: string;
  score: number;
  pageNumber?: number;
  matchType: 'semantic' | 'keyword' | 'hybrid';
  metadata?: {
    caseId?: string;
    caseName?: string;
    date?: string;
    author?: string;
    tags?: string[];
  };
}

interface SearchInterfaceProps {
  caseId?: string;
  onSelectDocument?: (documentId: string) => void;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  caseId,
  onSelectDocument
}) => {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<'semantic' | 'keyword' | 'hybrid'>('hybrid');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    dateRange: '',
    documentType: '',
    author: ''
  });
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // Load search history from localStorage
  useEffect(() => {
    const history = localStorage.getItem('searchHistory');
    if (history) {
      setSearchHistory(JSON.parse(history).slice(0, 5));
    }
  }, []);

  // Generate AI suggestions based on query
  useEffect(() => {
    if (query.length > 2) {
      generateSuggestions();
    }
  }, [query]);

  const generateSuggestions = async () => {
    try {
      const response = await fetch('/api/search/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, caseId })
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (err) {
      console.error('Failed to get suggestions:', err);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        type: searchType,
        ...(caseId && { caseId }),
        ...filters
      });

      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setResults(data.results || []);

      // Update search history
      const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 5);
      setSearchHistory(newHistory);
      localStorage.setItem('searchHistory', JSON.stringify(newHistory));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    handleSearch();
  };

  const getMatchTypeIcon = (type: string) => {
    switch (type) {
      case 'semantic':
        return <Brain className="h-4 w-4" />;
      case 'keyword':
        return <Search className="h-4 w-4" />;
      default:
        return <Sparkles className="h-4 w-4" />;
    }
  };

  const getMatchTypeColor = (type: string) => {
    switch (type) {
      case 'semantic':
        return 'bg-purple-100 text-purple-800';
      case 'keyword':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          AI-Powered Search
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Search Input */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Input
                type="text"
                placeholder="Search documents, cases, or ask a question..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            <Button 
              onClick={handleSearch} 
              disabled={loading || !query.trim()}
            >
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Search Type Selector */}
          <div className="flex gap-2 items-center">
            <span className="text-sm text-muted-foreground">Search Type:</span>
            <div className="flex gap-1">
              <Button
                variant={searchType === 'hybrid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('hybrid')}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Hybrid
              </Button>
              <Button
                variant={searchType === 'semantic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('semantic')}
              >
                <Brain className="h-3 w-3 mr-1" />
                Semantic
              </Button>
              <Button
                variant={searchType === 'keyword' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSearchType('keyword')}
              >
                <Search className="h-3 w-3 mr-1" />
                Keyword
              </Button>
            </div>
          </div>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Try:</span>
              {suggestions.map((suggestion, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="results" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="results">
                Results {results.length > 0 && `(${results.length})`}
              </TabsTrigger>
              <TabsTrigger value="history">Recent Searches</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="flex-1 overflow-auto mt-4">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Searching...</p>
                  </div>
                </div>
              ) : results.length > 0 ? (
                <div className="space-y-3">
                  {results.map((result) => (
                    <Card 
                      key={result.id} 
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onSelectDocument?.(result.documentId)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-medium text-sm">{result.documentName}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="secondary" 
                              className={getMatchTypeColor(result.matchType)}
                            >
                              {getMatchTypeIcon(result.matchType)}
                              <span className="ml-1 text-xs">
                                {Math.round(result.score * 100)}%
                              </span>
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                          {result.excerpt}
                        </p>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {result.pageNumber && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              Page {result.pageNumber}
                            </span>
                          )}
                          {result.metadata?.date && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(result.metadata.date).toLocaleDateString()}
                            </span>
                          )}
                          {result.metadata?.author && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {result.metadata.author}
                            </span>
                          )}
                        </div>

                        {result.metadata?.tags && result.metadata.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {result.metadata.tags.map((tag, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                <Tag className="h-2 w-2 mr-1" />
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : query && !loading ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Search className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No results found for "{query}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try different keywords or use semantic search
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Brain className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Enter a search query to find relevant documents
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="flex-1 overflow-auto mt-4">
              {searchHistory.length > 0 ? (
                <div className="space-y-2">
                  {searchHistory.map((historyQuery, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent cursor-pointer"
                      onClick={() => {
                        setQuery(historyQuery);
                        handleSearch();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{historyQuery}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32">
                  <Clock className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No search history</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
};