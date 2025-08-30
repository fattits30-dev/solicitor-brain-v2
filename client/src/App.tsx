import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Dashboard from "@/pages/dashboard";
import Cases from "@/pages/cases";
import Upload from "@/pages/upload";
import Search from "@/pages/search";
import Drafts from "@/pages/drafts";
import Activity from "@/pages/activity";
import Audit from "@/pages/audit";
import Settings from "@/pages/settings";

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

function Router() {
  return (
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
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  console.log("App component rendering...");
  
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