import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import StatsGrid from "@/components/dashboard/stats-grid";
import RecentCases from "@/components/dashboard/recent-cases";
import AIActivityFeed from "@/components/dashboard/ai-activity-feed";
import QuickActions from "@/components/dashboard/quick-actions";

export default function Dashboard() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Dashboard" 
          subtitle="Welcome back. You have access to case management and AI-powered legal assistance."
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <StatsGrid />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <RecentCases />
              <AIActivityFeed />
            </div>

            <QuickActions />

            {/* Trauma-informed consent information */}
            <div className="bg-card rounded-lg border border-border p-6" data-testid="privacy-info">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <i className="fas fa-info-circle text-accent text-xl"></i>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-medium text-foreground mb-2" data-testid="privacy-info-title">
                    Your Data, Your Control
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4" data-testid="privacy-info-description">
                    We respect your privacy and put you in control. Before we process any sensitive documents with AI, 
                    we'll always ask for your explicit consent. You can review, modify, or revoke permissions at any time.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button className="inline-flex items-center px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/90 transition-colors" data-testid="review-permissions">
                      <i className="fas fa-shield-alt mr-2"></i>
                      Review Permissions
                    </button>
                    <button className="inline-flex items-center px-4 py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors" data-testid="export-data">
                      <i className="fas fa-download mr-2"></i>
                      Export My Data
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
