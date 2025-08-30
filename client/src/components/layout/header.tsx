interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function Header({ title, subtitle, children }: HeaderProps) {
  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="page-title">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="page-subtitle">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <button 
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors" 
            aria-label="Notifications"
            data-testid="notifications-button"
          >
            <i className="fas fa-bell text-lg"></i>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full text-xs text-accent-foreground flex items-center justify-center" data-testid="notification-count">
              2
            </span>
          </button>
          
          <div className="flex items-center space-x-2 px-3 py-2 bg-secondary/10 rounded-lg" data-testid="ai-status">
            <div className="w-2 h-2 bg-secondary rounded-full pulse-activity"></div>
            <span className="text-sm font-medium text-secondary">AI Active</span>
          </div>
          
          {children}
        </div>
      </div>
    </header>
  );
}
