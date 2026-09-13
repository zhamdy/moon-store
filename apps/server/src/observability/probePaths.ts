/**
 * The paths an uptime probe or orchestrator may call.
 *
 * A standalone, dependency-free module on purpose: it is the single list that both the
 * route registration in `server/index.ts` and the rate-limit exemption in
 * `src/http/rateLimits.ts` read. Splitting `/api/health` into liveness and readiness
 * without updating the exemption would silently put the probes back on the shop's
 * request budget — a regression that fails no test and surfaces as the monitoring
 * reporting an outage it caused. One list, two readers, no way to update one and forget
 * the other.
 */
export const HEALTH_PATHS = ['/api/health', '/api/health/live', '/api/health/ready'] as const;

export type HealthPath = (typeof HEALTH_PATHS)[number];

const HEALTH_PATH_SET: ReadonlySet<string> = new Set(HEALTH_PATHS);

export function isHealthPath(path: string): boolean {
  return HEALTH_PATH_SET.has(path);
}
