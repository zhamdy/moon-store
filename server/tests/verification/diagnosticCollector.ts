export interface EndpointDiagnostic {
  method: string;
  path: string;
  role: string;
  status: number;
  responseBody?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    stack?: string;
  };
  sql?: {
    query?: string;
    params?: unknown[];
    error?: string;
  };
  durationMs: number;
}

class DiagnosticCollector {
  private diagnostics: EndpointDiagnostic[] = [];

  public record(diagnostic: EndpointDiagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  public getDiagnostics(): EndpointDiagnostic[] {
    return this.diagnostics;
  }

  public getFailures(): EndpointDiagnostic[] {
    return this.diagnostics.filter((d) => d.status >= 500);
  }

  public getClientErrors(): EndpointDiagnostic[] {
    return this.diagnostics.filter((d) => d.status >= 400 && d.status < 500);
  }

  public getSuccesses(): EndpointDiagnostic[] {
    return this.diagnostics.filter((d) => d.status < 400);
  }

  public clear(): void {
    this.diagnostics = [];
  }
}

export const diagnosticCollector = new DiagnosticCollector();
