import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Document, Case } from "@shared/schema";

interface SearchResult {
  id: string;
  document: Document;
  case: Case;
  relevanceScore: number;
  snippet: string;
  highlights: string[];
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("semantic");
  const [caseFilter, setCaseFilter] = useState("all");
  const [documentTypeFilter, setDocumentTypeFilter] = useState("all");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Queries
  const { data: cases } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    enabled: false, // We'll use this for document type filtering
  });

  const performSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setHasSearched(true);
    
    try {
      // Simulate AI-powered search results
      // In production, this would call a real search API with vector embeddings
      await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate search time
      
      const mockResults: SearchResult[] = [
        {
          id: "1",
          document: {
            id: "doc1",
            caseId: "case1",
            type: "Contract",
            source: "upload",
            path: "/uploads/employment_contract.pdf",
            hash: "abc123",
            ocrText: "Employment contract containing terms and conditions...",
            createdAt: new Date("2024-01-15"),
            updatedAt: new Date("2024-01-15"),
          },
          case: {
            id: "case1",
            title: "Employment Tribunal - Sarah vs TechCorp",
            clientRef: "EMP-2024-001",
            status: "active",
            riskLevel: "medium",
            description: "Employment dispute regarding unfair dismissal",
            createdAt: new Date("2024-01-10"),
            updatedAt: new Date("2024-01-15"),
          },
          relevanceScore: 0.92,
          snippet: `...employment ${searchQuery} agreement contains clauses related to termination procedures and notice periods...`,
          highlights: [searchQuery.toLowerCase()],
        },
        {
          id: "2",
          document: {
            id: "doc2",
            caseId: "case2",
            type: "Email",
            source: "import",
            path: "/imports/correspondence_jan2024.pdf",
            hash: "def456",
            ocrText: "Email correspondence regarding property dispute...",
            createdAt: new Date("2024-01-20"),
            updatedAt: new Date("2024-01-20"),
          },
          case: {
            id: "case2",
            title: "Property Dispute - Johnson Family Estate",
            clientRef: "PROP-2024-002",
            status: "active",
            riskLevel: "high",
            description: "Property boundary dispute with neighbour",
            createdAt: new Date("2024-01-18"),
            updatedAt: new Date("2024-01-20"),
          },
          relevanceScore: 0.78,
          snippet: `...regarding the ${searchQuery} mentioned in previous correspondence about property boundaries...`,
          highlights: [searchQuery.toLowerCase()],
        },
      ];
      
      // Filter results based on selected filters
      let filteredResults = mockResults;
      
      if (caseFilter !== "all") {
        filteredResults = filteredResults.filter(result => result.case.id === caseFilter);
      }
      
      if (documentTypeFilter !== "all") {
        filteredResults = filteredResults.filter(result => result.document.type.toLowerCase() === documentTypeFilter.toLowerCase());
      }
      
      setSearchResults(filteredResults);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
  };

  const getRelevanceColor = (score: number) => {
    if (score >= 0.9) return "bg-secondary text-secondary-foreground";
    if (score >= 0.7) return "bg-accent text-accent-foreground";
    return "bg-muted text-muted-foreground";
  };

  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights.length) return text;
    
    let highlightedText = text;
    highlights.forEach(highlight => {
      const regex = new RegExp(`(${highlight})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark class="bg-accent/30 text-accent-foreground">$1</mark>');
    });
    
    return highlightedText;
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Search" 
          subtitle="AI-powered semantic search across all case documents"
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Search Form */}
            <Card>
              <CardContent className="p-6">
                <form onSubmit={handleSearchSubmit} className="space-y-4">
                  <div className="flex flex-col lg:flex-row gap-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search across all case documents... (e.g., 'contract termination clause', 'witness statement')"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="text-base"
                        data-testid="search-input"
                      />
                    </div>
                    <Button 
                      type="submit" 
                      disabled={!searchQuery.trim() || isSearching}
                      className="lg:w-auto"
                      data-testid="search-submit"
                    >
                      {isSearching ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Searching...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-search mr-2"></i>
                          Search
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <Select value={searchType} onValueChange={setSearchType} data-testid="search-type">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="semantic">Semantic Search (AI-powered)</SelectItem>
                          <SelectItem value="keyword">Keyword Search</SelectItem>
                          <SelectItem value="hybrid">Hybrid (Semantic + Keyword)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Select value={caseFilter} onValueChange={setCaseFilter} data-testid="filter-case">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Cases</SelectItem>
                          {cases?.map((case_) => (
                            <SelectItem key={case_.id} value={case_.id}>
                              {case_.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter} data-testid="filter-document-type">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Document Types</SelectItem>
                          <SelectItem value="contract">Contracts</SelectItem>
                          <SelectItem value="email">Emails</SelectItem>
                          <SelectItem value="letter">Letters</SelectItem>
                          <SelectItem value="court_document">Court Documents</SelectItem>
                          <SelectItem value="evidence">Evidence</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Search Results */}
            {hasSearched && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Search Results</CardTitle>
                      <CardDescription>
                        {isSearching 
                          ? "Searching across case documents..." 
                          : `Found ${searchResults.length} results for "${searchQuery}"`
                        }
                      </CardDescription>
                    </div>
                    {searchResults.length > 0 && (
                      <Badge variant="outline" data-testid="search-results-count">
                        {searchResults.length} results
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isSearching ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="flex items-start space-x-4 p-4 border border-border rounded-lg">
                            <div className="w-12 h-12 bg-muted rounded-lg"></div>
                            <div className="flex-1">
                              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                              <div className="h-3 bg-muted rounded w-1/2 mb-2"></div>
                              <div className="h-3 bg-muted rounded w-full"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="text-center text-muted-foreground p-8" data-testid="no-search-results">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-search text-2xl"></i>
                      </div>
                      <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
                      <p className="text-sm">
                        Try adjusting your search terms or filters. The AI search works best with natural language queries.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {searchResults.map((result) => (
                        <div key={result.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors" data-testid={`search-result-${result.id}`}>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                <i className="fas fa-file-alt text-primary"></i>
                              </div>
                              <div>
                                <h3 className="font-medium text-foreground" data-testid={`result-document-type-${result.id}`}>
                                  {result.document.type}
                                </h3>
                                <p className="text-sm text-muted-foreground" data-testid={`result-case-title-${result.id}`}>
                                  {result.case.title}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge className={getRelevanceColor(result.relevanceScore)} data-testid={`result-relevance-${result.id}`}>
                                {Math.round(result.relevanceScore * 100)}% match
                              </Badge>
                              <Badge variant="outline" data-testid={`result-case-ref-${result.id}`}>
                                {result.case.clientRef || "No ref"}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <p 
                              className="text-sm text-foreground leading-relaxed"
                              dangerouslySetInnerHTML={{ 
                                __html: highlightText(result.snippet, result.highlights) 
                              }}
                              data-testid={`result-snippet-${result.id}`}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center space-x-4">
                              <span data-testid={`result-source-${result.id}`}>
                                Source: {result.document.source}
                              </span>
                              <Separator orientation="vertical" className="h-3" />
                              <span data-testid={`result-date-${result.id}`}>
                                {format(new Date(result.document.createdAt), "dd MMM yyyy")}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.location.href = `/cases/${result.case.id}`}
                                data-testid={`view-case-${result.id}`}
                              >
                                <i className="fas fa-folder-open mr-1"></i>
                                View Case
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                data-testid={`view-document-${result.id}`}
                              >
                                <i className="fas fa-file-alt mr-1"></i>
                                View Document
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Search Tips */}
            <Card>
              <CardHeader>
                <CardTitle>Search Tips</CardTitle>
                <CardDescription>Get better results with AI-powered search</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="semantic" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="semantic" data-testid="tip-semantic">Semantic Search</TabsTrigger>
                    <TabsTrigger value="keyword" data-testid="tip-keyword">Keyword Search</TabsTrigger>
                    <TabsTrigger value="advanced" data-testid="tip-advanced">Advanced Tips</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="semantic" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Natural Language Queries</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• "What are the termination clauses in employment contracts?"</li>
                          <li>• "Find documents about property boundary disputes"</li>
                          <li>• "Show me witness statements from court cases"</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Concept-Based Search</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• "Unfair dismissal evidence"</li>
                          <li>• "Compensation claims"</li>
                          <li>• "Legal precedents and case law"</li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="keyword" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Exact Matches</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• Use quotes for exact phrases: "notice period"</li>
                          <li>• Search for specific terms: contract, agreement, clause</li>
                          <li>• Case references: CASE-2024-001</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Boolean Operators</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• AND: employment AND termination</li>
                          <li>• OR: contract OR agreement</li>
                          <li>• NOT: property NOT residential</li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="advanced" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Privacy & Redaction</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• Personal information is automatically redacted</li>
                          <li>• Search indexes exclude sensitive data</li>
                          <li>• All searches are logged for audit purposes</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground mb-2">AI Processing</h4>
                        <ul className="text-muted-foreground space-y-1">
                          <li>• Results ranked by relevance and context</li>
                          <li>• OCR text is searchable within 24 hours</li>
                          <li>• Vector embeddings enable semantic understanding</li>
                        </ul>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
