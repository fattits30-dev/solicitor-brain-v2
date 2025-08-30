import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navigationItems = [
  { href: "/", label: "Dashboard", icon: "fas fa-th-large" },
  { href: "/cases", label: "Cases", icon: "fas fa-folder-open" },
  { href: "/upload", label: "Upload Documents", icon: "fas fa-upload" },
  { href: "/search", label: "Search", icon: "fas fa-search" },
  { href: "/drafts", label: "Draft Studio", icon: "fas fa-edit" },
  { href: "/activity", label: "AI Activity", icon: "fas fa-robot", badge: true },
  { href: "/audit", label: "Audit Log", icon: "fas fa-clipboard-list" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="flex flex-col w-64 bg-card border-r border-border">
      <div className="flex items-center justify-between p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-brain text-primary-foreground text-sm" data-testid="logo-icon"></i>
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground" data-testid="app-title">Solicitor Brain</h1>
            <p className="text-xs text-muted-foreground" data-testid="app-subtitle">Legal Assistant</p>
          </div>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-2" data-testid="sidebar-navigation">
        {navigationItems.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          
          return (
            <Link key={item.href} href={item.href}>
              <a
                className={cn(
                  "flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <i className={`${item.icon} mr-3 w-4`}></i>
                {item.label}
                {item.badge && (
                  <span className="ml-auto w-2 h-2 bg-secondary rounded-full pulse-activity" data-testid="activity-indicator"></span>
                )}
              </a>
            </Link>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
            <i className="fas fa-user text-muted-foreground text-sm" data-testid="user-avatar"></i>
          </div>
          <div>
            <p className="text-sm font-medium" data-testid="user-name">Sarah Johnson</p>
            <p className="text-xs text-muted-foreground" data-testid="user-role">Senior Solicitor</p>
          </div>
        </div>
        <Link href="/settings">
          <a className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" data-testid="nav-settings">
            <i className="fas fa-cog mr-3 w-4"></i>
            Settings
          </a>
        </Link>
      </div>
    </aside>
  );
}
