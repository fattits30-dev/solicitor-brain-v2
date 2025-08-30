import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: "20px",
          margin: "20px",
          border: "2px solid red",
          borderRadius: "8px",
          backgroundColor: "#fee",
          fontFamily: "monospace",
        }}>
          <h2 style={{ color: "red" }}>Application Error</h2>
          <details style={{ whiteSpace: "pre-wrap" }}>
            <summary>Error Details (Click to expand)</summary>
            <br />
            <strong>Error:</strong>
            <pre>{this.state.error && this.state.error.toString()}</pre>
            <br />
            <strong>Stack:</strong>
            <pre>{this.state.error && this.state.error.stack}</pre>
            <br />
            <strong>Component Stack:</strong>
            <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          </details>
          <br />
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;