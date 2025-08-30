import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Case } from "@shared/schema";

export default function RecentCases() {
  const { data: cases, isLoading } = useQuery<Case[]>({
    queryKey: ["/api/cases"],
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Recent Cases</h2>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="flex items-center space-x-4 p-4">
                <div className="w-10 h-10 bg-muted rounded-lg"></div>
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-muted rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const recentCases = cases?.slice(0, 3) || [];

  const getCaseIcon = (title: string) => {
    if (title.toLowerCase().includes('employment')) return 'fas fa-gavel';
    if (title.toLowerCase().includes('property')) return 'fas fa-home';
    if (title.toLowerCase().includes('contract')) return 'fas fa-file-contract';
    return 'fas fa-folder-open';
  };

  const getPriorityColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'high': return 'bg-accent/10 text-accent';
      case 'medium': return 'bg-secondary/10 text-secondary';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const caseDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - caseDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Less than an hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <div className="lg:col-span-2 bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground" data-testid="recent-cases-title">Recent Cases</h2>
          <Link href="/cases">
            <a className="text-sm text-primary hover:text-primary/80 font-medium" data-testid="view-all-cases">
              View All
            </a>
          </Link>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {recentCases.length === 0 ? (
          <div className="text-center text-muted-foreground p-8" data-testid="no-cases">
            No cases found. Create your first case to get started.
          </div>
        ) : (
          recentCases.map((case_) => (
            <Link key={case_.id} href={`/cases/${case_.id}`}>
              <a className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`case-${case_.id}`}>
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className={`${getCaseIcon(case_.title)} text-primary`}></i>
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground" data-testid={`case-title-${case_.id}`}>
                      {case_.title}
                    </h3>
                    <p className="text-sm text-muted-foreground" data-testid={`case-client-${case_.id}`}>
                      Client: [REDACTED]
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(case_.riskLevel)}`} data-testid={`case-priority-${case_.id}`}>
                    {case_.riskLevel === 'high' ? 'High Priority' : 
                     case_.riskLevel === 'medium' ? 'In Progress' : 'Review'}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1" data-testid={`case-updated-${case_.id}`}>
                    {formatTimeAgo(case_.updatedAt.toString())}
                  </p>
                </div>
              </a>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
