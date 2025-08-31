import React, { Suspense, ReactNode } from 'react';
import { ErrorBoundary } from './error-boundary';
import { Loader2 } from 'lucide-react';

interface AsyncBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  loadingText?: string;
}

/**
 * Combines error boundary with Suspense for async components
 * Handles both loading states and errors gracefully
 */
export function AsyncBoundary({ 
  children, 
  fallback,
  errorFallback,
  loadingText = "Loading..."
}: AsyncBoundaryProps) {
  const defaultFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>{loadingText}</span>
      </div>
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback || defaultFallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Specialized boundary for form submissions
 */
export function FormBoundary({ children }: { children: ReactNode }) {
  const errorFallback = (
    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
      <p className="text-sm text-destructive">
        An error occurred while processing your form. Please try again.
      </p>
    </div>
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      {children}
    </ErrorBoundary>
  );
}

/**
 * Specialized boundary for data fetching components
 */
export function DataBoundary({ 
  children,
  resource
}: { 
  children: ReactNode;
  resource?: string;
}) {
  const errorFallback = (
    <div className="p-6 text-center">
      <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-3">
        <span className="text-xl">⚠️</span>
      </div>
      <h3 className="font-medium mb-1">Unable to load {resource || 'data'}</h3>
      <p className="text-sm text-muted-foreground">
        Please check your connection and try again.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90"
      >
        Refresh Page
      </button>
    </div>
  );

  return (
    <AsyncBoundary 
      errorFallback={errorFallback}
      loadingText={`Loading ${resource || 'data'}...`}
    >
      {children}
    </AsyncBoundary>
  );
}