import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { t } from '../i18n';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
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
