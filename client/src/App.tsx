import ErrorBoundary from '@/components/ErrorBoundary';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import Login from '@/pages/Login';
import NotFound from '@/pages/not-found';
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';
import { Route, Switch } from 'wouter';
import { queryClient } from './lib/queryClient';

// Lazy load page components for code splitting
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Cases = lazy(() => import('@/pages/cases'));
const Upload = lazy(() => import('@/pages/upload'));
const Search = lazy(() => import('@/pages/search'));
const Drafts = lazy(() => import('@/pages/drafts'));
const Activity = lazy(() => import('@/pages/activity'));
const Audit = lazy(() => import('@/pages/audit'));
const Settings = lazy(() => import('@/pages/settings'));
const AIWorkspace = lazy(() => import('@/pages/ai-workspace'));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Wrapper components for protected routes
function ProtectedDashboard() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}

function ProtectedCases() {
  return (
    <ProtectedRoute>
      <Cases />
    </ProtectedRoute>
  );
}

function ProtectedUpload() {
  return (
    <ProtectedRoute>
      <Upload />
    </ProtectedRoute>
  );
}

function ProtectedSearch() {
  return (
    <ProtectedRoute>
      <Search />
    </ProtectedRoute>
  );
}

function ProtectedDrafts() {
  return (
    <ProtectedRoute>
      <Drafts />
    </ProtectedRoute>
  );
}

function ProtectedActivity() {
  return (
    <ProtectedRoute>
      <Activity />
    </ProtectedRoute>
  );
}

function ProtectedAudit() {
  return (
    <ProtectedRoute requiredRole="admin">
      <Audit />
    </ProtectedRoute>
  );
}

function ProtectedSettings() {
  return (
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  );
}

function ProtectedAIWorkspace() {
  return (
    <ProtectedRoute>
      <AIWorkspace />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={ProtectedDashboard} />
        <Route path="/cases" component={ProtectedCases} />
        <Route path="/cases/:id" component={ProtectedCases} />
        <Route path="/upload" component={ProtectedUpload} />
        <Route path="/search" component={ProtectedSearch} />
        <Route path="/drafts" component={ProtectedDrafts} />
        <Route path="/activity" component={ProtectedActivity} />
        <Route path="/audit" component={ProtectedAudit} />
        <Route path="/settings" component={ProtectedSettings} />
        <Route path="/ai" component={ProtectedAIWorkspace} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  console.log('App component rendering...');

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
