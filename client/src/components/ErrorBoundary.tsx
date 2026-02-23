import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { t } from '../i18n';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <AlertTriangle className="h-12 w-12 text-gold" />
          <h2 className="text-xl font-display tracking-wider text-foreground">
            {t('error.title')}
          </h2>
          <p className="text-muted text-sm">
            {this.state.error?.message || t('error.title')}
          </p>
          <Button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
          >
            {t('error.tryAgain')}
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
