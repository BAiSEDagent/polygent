'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('[Cogent] UI error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="px-4 py-8 text-center">
          <p className="text-[var(--text-secondary)] text-sm">Something went wrong.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-3 text-[var(--accent-blue)] text-sm"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
