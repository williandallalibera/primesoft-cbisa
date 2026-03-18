import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const isDev = import.meta.env.DEV;
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <i className="fas fa-exclamation-triangle text-3xl" />
              <h1 className="text-xl font-bold">Algo salió mal</h1>
            </div>
            <p className="text-gray-600 mb-4">
              La aplicación encontró un error. Abra la consola del navegador (F12) para más detalles.
            </p>
            {isDev && (
              <pre className="text-left text-sm bg-gray-100 p-4 rounded-lg overflow-auto max-h-48 text-red-800">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-agro-primary text-white rounded-xl font-medium hover:opacity-90"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
