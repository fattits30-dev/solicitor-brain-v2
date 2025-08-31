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
      iconBg: "bg-gradient-to-br from-blue-500 to-indigo-600",
      iconColor: "text-white",
      cardBg: "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20",
      subtitle: "+2 from last month",
      trend: "up",
      testId: "stat-active-cases"
    },
    {
      label: "Documents Processed",
      value: stats.documentsProcessed,
      icon: "fas fa-file-alt",
      iconBg: "bg-gradient-to-br from-emerald-500 to-teal-600",
      iconColor: "text-white",
      cardBg: "bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20",
      subtitle: "+23 this week",
      trend: "up",
      testId: "stat-documents"
    },
    {
      label: "AI Queries Today",
      value: stats.aiQueries,
      icon: "fas fa-robot",
      iconBg: "bg-gradient-to-br from-purple-500 to-pink-600",
      iconColor: "text-white",
      cardBg: "bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20",
      subtitle: "Average response: 1.2s",
      trend: "stable",
      testId: "stat-ai-queries"
    },
    {
      label: "Privacy Score",
      value: `${stats.privacyScore}%`,
      icon: "fas fa-shield-alt",
      iconBg: "bg-gradient-to-br from-amber-500 to-orange-600",
      iconColor: "text-white",
      cardBg: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20",
      subtitle: "All data protected",
      trend: "up",
      testId: "stat-privacy-score"
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statsData.map((stat, index) => (
        <div 
          key={stat.label} 
          className={`${stat.cardBg} rounded-xl border border-white/50 dark:border-white/10 p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}
          data-testid={stat.testId}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {/* Decorative background element */}
          <div className="absolute -right-4 -top-4 w-24 h-24 opacity-10">
            <i className={`${stat.icon} text-6xl`}></i>
          </div>
          
          <div className="flex items-center justify-between relative">
            <div className="flex-1">
              <p className="text-sm font-medium text-muted-foreground mb-1" data-testid={`${stat.testId}-label`}>
                {stat.label}
              </p>
              <p className="text-3xl font-bold text-foreground" data-testid={`${stat.testId}-value`}>
                {stat.value}
              </p>
              <div className="flex items-center gap-2 mt-3">
                <p className="text-xs text-muted-foreground" data-testid={`${stat.testId}-subtitle`}>
                  {stat.subtitle}
                </p>
                {stat.trend === 'up' && (
                  <i className="fas fa-arrow-up text-xs text-green-600"></i>
                )}
                {stat.trend === 'down' && (
                  <i className="fas fa-arrow-down text-xs text-red-600"></i>
                )}
              </div>
            </div>
            <div className={`w-14 h-14 ${stat.iconBg} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
              <i className={`${stat.icon} ${stat.iconColor} text-xl`}></i>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
