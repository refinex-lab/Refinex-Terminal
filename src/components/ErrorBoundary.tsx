import { Component, ErrorInfo, ReactNode } from "react";
import { toast } from "sonner";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary Component
 * Catches React errors and prevents app crashes
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Error Boundary caught an error:", error, errorInfo);

    // Show toast notification
    toast.error("An unexpected error occurred", {
      description: error.message,
      duration: 5000,
    });

    // Log to console for debugging
    console.error("Component Stack:", errorInfo.componentStack);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className="flex flex-col items-center justify-center h-screen p-8"
          style={{
            backgroundColor: "var(--ui-background)",
            color: "var(--ui-foreground)",
          }}
        >
          <div className="max-w-md text-center space-y-4">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-sm opacity-70">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded motion-safe:transition-colors"
                style={{
                  backgroundColor: "var(--ui-button-background)",
                  color: "var(--ui-button-foreground)",
                }}
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded motion-safe:transition-colors"
                style={{
                  backgroundColor: "var(--ui-button-background)",
                  color: "var(--ui-button-foreground)",
                }}
              >
                Reload App
              </button>
            </div>
            {import.meta.env.DEV && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm opacity-70">
                  Error Details
                </summary>
                <pre className="mt-2 p-4 rounded text-xs overflow-auto max-h-64 bg-black/20">
                  {this.state.error?.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
