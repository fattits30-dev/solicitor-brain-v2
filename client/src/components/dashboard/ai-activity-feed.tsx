import { useQuery } from "@tanstack/react-query";
import type { AIActivity } from "@/lib/types";

export default function AIActivityFeed() {
  const { data: activities, isLoading } = useQuery<AIActivity[]>({
    queryKey: ["/api/ai-activity"],
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-lg border border-border">
        <div className="p-6 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">AI Activity</h2>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start space-x-3 animate-pulse">
              <div className="w-8 h-8 bg-muted rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'ocr': return { icon: 'fas fa-robot', color: 'text-secondary', bg: 'bg-secondary/10' };
      case 'rag': return { icon: 'fas fa-search', color: 'text-primary', bg: 'bg-primary/10' };
      case 'draft': return { icon: 'fas fa-edit', color: 'text-accent', bg: 'bg-accent/10' };
      case 'privacy': return { icon: 'fas fa-shield-alt', color: 'text-secondary', bg: 'bg-secondary/10' };
      default: return { icon: 'fas fa-robot', color: 'text-secondary', bg: 'bg-secondary/10' };
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} days ago`;
  };

  return (
    <div className="bg-card rounded-lg border border-border">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground" data-testid="ai-activity-title">AI Activity</h2>
          <div className="flex items-center space-x-2" data-testid="live-indicator">
            <div className="w-2 h-2 bg-secondary rounded-full pulse-activity"></div>
            <span className="text-xs text-secondary font-medium">Live</span>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
        {activities?.length === 0 ? (
          <div className="text-center text-muted-foreground p-8" data-testid="no-activities">
            No AI activity yet. Activities will appear here as the system processes documents and handles requests.
          </div>
        ) : (
          activities?.map((activity) => {
            const iconConfig = getActivityIcon(activity.type);
            return (
              <div key={activity.id} className="flex items-start space-x-3" data-testid={`activity-${activity.id}`}>
                <div className={`w-8 h-8 ${iconConfig.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                  <i className={`${iconConfig.icon} ${iconConfig.color} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground" data-testid={`activity-description-${activity.id}`}>
                    {activity.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1" data-testid={`activity-timestamp-${activity.id}`}>
                    {formatTimeAgo(activity.timestamp)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
