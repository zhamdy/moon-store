import fs from 'fs';
import path from 'path';
import { EndpointDiagnostic } from './diagnosticCollector';

export function generateMarkdownReport(diagnostics: EndpointDiagnostic[]): string {
  const total = diagnostics.length;
  const successes = diagnostics.filter((d) => d.status < 400);
  const clientErrors = diagnostics.filter((d) => d.status >= 400 && d.status < 500);
  const serverErrors = diagnostics.filter((d) => d.status >= 500);

  const lines: string[] = [
    `# API Endpoint Health & Verification Diagnostic Report`,
    ``,
    `**Execution Date:** ${new Date().toISOString()}`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Count | Percentage |`,
    `|---|---|---|`,
    `| Total Endpoints Tested | ${total} | 100% |`,
    `| Successes (2xx/3xx) | ${successes.length} | ${total > 0 ? ((successes.length / total) * 100).toFixed(1) : 0}% |`,
    `| Client Errors (4xx) | ${clientErrors.length} | ${total > 0 ? ((clientErrors.length / total) * 100).toFixed(1) : 0}% |`,
    `| Server Errors (500s) | ${serverErrors.length} | ${total > 0 ? ((serverErrors.length / total) * 100).toFixed(1) : 0}% |`,
    ``,
  ];

  if (serverErrors.length === 0) {
    lines.push(`> [!NOTE]`);
    lines.push(`> All tested endpoints passed without unhandled 500 Internal Server Errors.`);
    lines.push(``);
  } else {
    lines.push(`## 500 Internal Server Error Failures (${serverErrors.length})`);
    lines.push(``);
    lines.push(`| Method | Path | Role | Status | Error Code / Message |`);
    lines.push(`|---|---|---|---|---|`);
    for (const failure of serverErrors) {
      const errMsg =
        failure.error?.message || JSON.stringify(failure.responseBody) || 'Internal Error';
      lines.push(
        `| \`${failure.method}\` | \`${failure.path}\` | \`${failure.role}\` | \`${failure.status}\` | ${errMsg} |`
      );
    }
    lines.push(``);

    lines.push(`### Failure Diagnostics Details`);
    lines.push(``);
    for (const failure of serverErrors) {
      lines.push(`#### \`${failure.method} ${failure.path}\` (${failure.role})`);
      lines.push(`- **Status:** ${failure.status}`);
      lines.push(`- **Duration:** ${failure.durationMs}ms`);
      lines.push(`- **Response Body:**`);
      lines.push('```json');
      lines.push(JSON.stringify(failure.responseBody, null, 2));
      lines.push('```');
      if (failure.error?.stack) {
        lines.push(`- **Stack Trace:**`);
        lines.push('```text');
        lines.push(failure.error.stack);
        lines.push('```');
      }
      lines.push(``);
    }
  }

  lines.push(`## All Endpoint Results`);
  lines.push(``);
  lines.push(`| Method | Path | Role | Status | Duration | Result |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const item of diagnostics) {
    const icon = item.status < 400 ? '✅' : item.status < 500 ? '⚠️ (4xx)' : '❌ (500)';
    lines.push(
      `| \`${item.method}\` | \`${item.path}\` | \`${item.role}\` | \`${item.status}\` | ${item.durationMs}ms | ${icon} |`
    );
  }
  lines.push(``);

  return lines.join('\n');
}

export function saveReportToFile(markdown: string, outputPath: string): void {
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(outputPath, markdown, 'utf-8');
}
