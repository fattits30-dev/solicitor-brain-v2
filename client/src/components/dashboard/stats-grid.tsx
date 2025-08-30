import { useQuery } from "@tanstack/react-query";
import type { DashboardStats } from "@/lib/types";

export default function StatsGrid() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card rounded-lg border border-border p-6 animate-pulse">
            <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-3 bg-muted rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Unable to load dashboard statistics
      </div>
    );
  }

  const statsData = [
    {
      label: "Active Cases",
      value: stats.activeCases,
      icon: "fas fa-folder-open",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      subtitle: "+2 from last month",
      testId: "stat-active-cases"
    },
    {
      label: "Documents Processed",
      value: stats.documentsProcessed,
      icon: "fas fa-file-alt",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
      subtitle: "+23 this week",
      testId: "stat-documents"
    },
    {
      label: "AI Queries Today",
      value: stats.aiQueries,
      icon: "fas fa-robot",
      iconBg: "bg-accent/10",
      iconColor: "text-accent",
      subtitle: "Average response: 1.2s",
      testId: "stat-ai-queries"
    },
    {
      label: "Privacy Score",
      value: `${stats.privacyScore}%`,
      icon: "fas fa-shield-alt",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
      subtitle: "All data protected",
      testId: "stat-privacy-score"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat) => (
        <div key={stat.label} className="bg-card rounded-lg border border-border p-6" data-testid={stat.testId}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground" data-testid={`${stat.testId}-label`}>
                {stat.label}
              </p>
              <p className="text-3xl font-bold text-foreground" data-testid={`${stat.testId}-value`}>
                {stat.value}
              </p>
            </div>
            <div className={`w-12 h-12 ${stat.iconBg} rounded-lg flex items-center justify-center`}>
              <i className={`${stat.icon} ${stat.iconColor} text-xl`}></i>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4" data-testid={`${stat.testId}-subtitle`}>
            {stat.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}
