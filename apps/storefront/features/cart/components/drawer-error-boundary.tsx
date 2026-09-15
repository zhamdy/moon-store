import { Component, type ReactNode } from 'react';

interface DrawerErrorBoundaryProps {
  children: ReactNode;
  onError(): void;
}

/** Keeps a failed drawer chunk from taking the header (and every route) down with it. */
export class DrawerErrorBoundary extends Component<DrawerErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
