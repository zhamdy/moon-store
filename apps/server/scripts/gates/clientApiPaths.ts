/**
 * Every API path the dashboard calls, matched against the routes the server serves (#162).
 *
 * Reads the dashboard's source with the TypeScript parser rather than a regex: a path is an
 * argument in one of three shapes, and a regex that silently matches nothing is how a gate
 * passes for weeks while proving nothing.
 *
 * - `transport.request({ method, path })`
 * - `useApiQuery(key, path, ...)` — always a GET
 * - `const x = resource('name')`, then `x.useList()`, `x.useOne()`, `x.useRead(segment)`,
 *   `x.useSave()`, `x.useRemove()`, `x.useAction(action, { method })`, which build the URLs
 *   `shared/lib/resource.ts` builds.
 *
 * A path it cannot resolve statically is never skipped: it is reported as unresolved, and
 * passes only when a resolution names the concrete calls it makes.
 */
import ts from 'typescript';
import type { Method, ServedRoute } from './servedRoutes';

export interface SourceFile {
  /** Relative to the dashboard's `src/`, `/`-separated. */
  path: string;
  text: string;
}

export interface ClientCall {
  method: Method;
  /** Relative to `/api/v1`, no leading slash, interpolations as `:param`. */
  path: string;
  site: string;
  /** `file :: expression`, the key a resolution is matched by. */
  key: string;
}

export interface UnresolvedCall {
  key: string;
  site: string;
  why: string;
}

/**
 * `x.useSave()` sends POST `name` without an id and PUT `name/:id` with one, and which a page
 * does is decided at runtime. Both served, or neither, is unambiguous; exactly one served
 * needs a resolution saying which the page uses.
 */
export interface SaveHook {
  name: string;
  site: string;
  key: string;
}

export interface Resolution {
  file: string;
  /**
   * The call's source text, whitespace-collapsed — or `receiver.useSave()` for a save hook.
   * Every call site in `file` with this key is resolved by the entry.
   */
  expression: string;
  calls: readonly { method: Method; path: string }[];
  reason: string;
}

export interface Extraction {
  calls: ClientCall[];
  saves: SaveHook[];
  unresolved: UnresolvedCall[];
  resources: number;
}

const PARAM = ':param';
const RESOURCE_HOOKS = new Set([
  'useList',
  'useOne',
  'useRead',
  'useSave',
  'useRemove',
  'useAction',
]);
const METHODS: readonly Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const collapse = (text: string) => text.replace(/\s+/g, ' ').trim();
const resolutionKey = (r: Resolution) => `${r.file} :: ${collapse(r.expression)}`;

/** A string literal or template, with each interpolation as `:param`. `null` when dynamic. */
function literalPath(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  let raw: string;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    raw = node.text;
  } else if (ts.isTemplateExpression(node)) {
    raw = node.head.text + node.templateSpans.map((s) => PARAM + s.literal.text).join('');
  } else {
    return null;
  }
  const path = raw.split('?')[0]!.replace(/^\/+/, '');
  // An interpolation fused to other text inside one segment names no route shape.
  if (path.split('/').some((seg) => seg.includes(PARAM) && seg !== PARAM)) return null;
  return path;
}

function literalMethod(node: ts.Expression | undefined): Method | null {
  if (!node || !(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return null;
  const upper = node.text.toUpperCase() as Method;
  return METHODS.includes(upper) ? upper : null;
}

function property(obj: ts.ObjectLiteralExpression, name: string) {
  return obj.properties.find((p) => p.name && ts.isIdentifier(p.name) && p.name.text === name);
}

export function extractClientCalls(files: readonly SourceFile[]): Extraction {
  const out: Extraction = { calls: [], saves: [], unresolved: [], resources: 0 };

  for (const file of files) {
    const sf = ts.createSourceFile(
      file.path,
      file.text,
      ts.ScriptTarget.Latest,
      true,
      file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    );
    const siteOf = (node: ts.Node) =>
      `${file.path}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
    const keyOf = (node: ts.Node) => `${file.path} :: ${collapse(node.getText(sf))}`;
    const unresolved = (node: ts.Node, why: string) =>
      out.unresolved.push({ key: keyOf(node), site: siteOf(node), why });

    // `const x = resource<...>('name')` — a resource named dynamically cannot be followed.
    const resources = new Map<string, string | null>();
    const collect = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === 'resource'
      ) {
        const name = literalPath(node.initializer.arguments[0]);
        const usable = name !== null && !name.includes(PARAM);
        resources.set(node.name.text, usable ? name : null);
        out.resources += 1;
        if (!usable) unresolved(node.initializer, 'resource named by a non-literal');
      }
      ts.forEachChild(node, collect);
    };
    collect(sf);

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const push = (method: Method, path: string) =>
          out.calls.push({ method, path, site: siteOf(node), key: keyOf(node) });

        if (ts.isIdentifier(callee) && callee.text === 'useApiQuery') {
          const path = literalPath(node.arguments[1]);
          if (path === null) unresolved(node, 'useApiQuery path is not a literal');
          else push('GET', path);
        } else if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'request') {
          const arg = node.arguments[0];
          if (!arg || !ts.isObjectLiteralExpression(arg)) {
            unresolved(node, 'request() argument is not an object literal');
          } else {
            const pathProp = property(arg, 'path');
            const methodProp = property(arg, 'method');
            const path =
              pathProp && ts.isPropertyAssignment(pathProp)
                ? literalPath(pathProp.initializer)
                : null;
            const method =
              methodProp && ts.isPropertyAssignment(methodProp)
                ? literalMethod(methodProp.initializer)
                : null;
            if (path === null || method === null) {
              unresolved(node, `request() ${path === null ? 'path' : 'method'} is not a literal`);
            } else {
              push(method, path);
            }
          }
        } else if (
          ts.isPropertyAccessExpression(callee) &&
          RESOURCE_HOOKS.has(callee.name.text) &&
          ts.isIdentifier(callee.expression)
        ) {
          const hook = callee.name.text;
          const receiver = callee.expression.text;
          if (!resources.has(receiver)) {
            unresolved(node, `${receiver}.${hook}() on something not declared as resource() here`);
          } else {
            const name = resources.get(receiver);
            if (name) {
              if (hook === 'useList') push('GET', name);
              else if (hook === 'useOne') push('GET', `${name}/${PARAM}`);
              else if (hook === 'useRemove') push('DELETE', `${name}/${PARAM}`);
              else if (hook === 'useSave') {
                out.saves.push({
                  name,
                  site: siteOf(node),
                  key: `${file.path} :: ${receiver}.useSave()`,
                });
              } else if (hook === 'useRead') {
                const segment = literalPath(node.arguments[0]);
                if (segment === null) unresolved(node, 'useRead segment is not a literal');
                else push('GET', `${name}/${segment}`);
              } else if (hook === 'useAction') {
                const action = literalPath(node.arguments[0]);
                const options = node.arguments[1];
                let method: Method | null = 'POST';
                if (options) {
                  if (!ts.isObjectLiteralExpression(options)) method = null;
                  else {
                    const m = property(options, 'method');
                    if (m)
                      method = ts.isPropertyAssignment(m) ? literalMethod(m.initializer) : null;
                  }
                }
                if (action === null || method === null) {
                  unresolved(
                    node,
                    `useAction ${action === null ? 'action' : 'method'} is not a literal`
                  );
                } else {
                  push(method, `${name}/${PARAM}/${action}`);
                }
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return out;
}

/** `POSTPONED_PATHS` read from `postponedFeatures.ts` source, following same-file constants. */
export function readPostponedPaths(text: string): string[] {
  const sf = ts.createSourceFile('postponedFeatures.ts', text, ts.ScriptTarget.Latest, true);
  const constants = new Map<string, ts.Expression>();
  sf.forEachChild((stmt) => {
    if (!ts.isVariableStatement(stmt)) return;
    for (const decl of stmt.declarationList.declarations) {
      if (ts.isIdentifier(decl.name) && decl.initializer)
        constants.set(decl.name.text, decl.initializer);
    }
  });

  const unwrap = (e: ts.Expression): ts.Expression =>
    ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e)
      ? unwrap(e.expression)
      : e;
  const list = constants.get('POSTPONED_PATHS');
  if (!list) return [];
  const array = unwrap(list);
  if (!ts.isArrayLiteralExpression(array)) return [];

  return array.elements.map((el) => {
    let value = unwrap(el);
    if (ts.isIdentifier(value) && constants.has(value.text))
      value = unwrap(constants.get(value.text)!);
    if (!ts.isStringLiteral(value)) {
      throw new Error(`POSTPONED_PATHS holds an entry this gate cannot read: ${el.getText(sf)}`);
    }
    return value.text;
  });
}

/** Express semantics: a route `:x` segment matches anything; a literal matches only itself. */
function isServed(
  served: readonly ServedRoute[],
  method: Method,
  path: string,
  base: string
): boolean {
  const callSegs = `${base}/${path}`.split('/');
  return served.some((route) => {
    if (route.method !== method) return false;
    const routeSegs = route.path.split('/');
    if (routeSegs.length !== callSegs.length) return false;
    return routeSegs.every((seg, i) =>
      seg.startsWith(':') ? callSegs[i] !== '' : seg === callSegs[i]
    );
  });
}

export interface ClientPathDriftInput {
  extraction: Extraction;
  served: readonly ServedRoute[];
  postponedPaths: readonly string[];
  resolutions: readonly Resolution[];
  minimumCalls: number;
  base?: string;
}

export interface ClientPathDriftReport {
  checked: number;
  implausible: string[];
  /** A call to a route the server does not serve. */
  unserved: string[];
  /** Unserved, but the feature is hidden by `postponedFeatures.ts`: reported, not failed. */
  postponed: string[];
  /** Could not be resolved statically and has no resolution. */
  unresolved: string[];
  /** A resolution matching no call site: the code moved, so the entry must too. */
  staleResolutions: string[];
  /** Resolved through an explicit entry, for the record. */
  resolved: string[];
}

export function findClientPathDrift(input: ClientPathDriftInput): ClientPathDriftReport {
  const base = input.base ?? '/api/v1';
  const { extraction } = input;
  const report: ClientPathDriftReport = {
    checked: 0,
    implausible: [],
    unserved: [],
    postponed: [],
    unresolved: [],
    staleResolutions: [],
    resolved: [],
  };

  const total = extraction.calls.length + extraction.saves.length + extraction.unresolved.length;
  if (total < input.minimumCalls) {
    report.implausible.push(
      `Found ${total} client calls; expected at least ${input.minimumCalls}.`
    );
  }
  if (extraction.resources === 0) report.implausible.push('Found no resource() declarations.');
  if (input.served.length === 0) report.implausible.push('Found no served routes.');
  if (input.postponedPaths.length === 0) {
    report.implausible.push('Read no POSTPONED_PATHS; the postponed exemption would be silent.');
  }

  const used = new Set<Resolution>();
  const resolve = (key: string) => {
    const found = input.resolutions.find((r) => resolutionKey(r) === key);
    if (found) used.add(found);
    return found;
  };

  const toCheck: (Omit<ClientCall, 'key'> & { key?: string })[] = [];
  const applyResolution = (resolution: Resolution, site: string) => {
    for (const c of resolution.calls) {
      const path = c.path.replace(/^\/+/, '');
      toCheck.push({ method: c.method, path, site });
      report.resolved.push(`${site}  ${c.method} ${base}/${path}  (${resolution.reason})`);
    }
  };

  for (const call of extraction.calls) {
    const resolution = resolve(call.key);
    if (resolution) applyResolution(resolution, call.site);
    else toCheck.push(call);
  }

  for (const u of extraction.unresolved) {
    const resolution = resolve(u.key);
    if (resolution) applyResolution(resolution, u.site);
    else report.unresolved.push(`${u.site}  ${u.why}\n      key: ${u.key}`);
  }

  for (const save of extraction.saves) {
    const resolution = resolve(save.key);
    if (resolution) {
      applyResolution(resolution, save.site);
      continue;
    }
    const create = isServed(input.served, 'POST', save.name, base);
    const update = isServed(input.served, 'PUT', `${save.name}/${PARAM}`, base);
    if (create === update) {
      toCheck.push({ method: 'POST', path: save.name, site: save.site });
      toCheck.push({ method: 'PUT', path: `${save.name}/${PARAM}`, site: save.site });
    } else {
      report.unresolved.push(
        `${save.site}  useSave() where only ${create ? 'POST (create)' : 'PUT (update)'} is served; ` +
          `resolve whether this page creates, updates, or both\n      key: ${save.key}`
      );
    }
  }

  for (const r of input.resolutions) {
    if (!used.has(r)) report.staleResolutions.push(resolutionKey(r));
  }

  const postponedRoots = new Set(
    input.postponedPaths.map((p) => p.replace(/^\/+/, '').split('/')[0])
  );
  for (const call of toCheck) {
    report.checked += 1;
    if (isServed(input.served, call.method, call.path, base)) continue;
    const line = `${call.method} ${base}/${call.path}  (${call.site})`;
    if (postponedRoots.has(call.path.split('/')[0]!)) report.postponed.push(line);
    else report.unserved.push(call.key ? `${line}\n      key: ${call.key}` : line);
  }

  return report;
}

export function hasFailures(report: ClientPathDriftReport): boolean {
  return (
    report.implausible.length +
      report.unserved.length +
      report.unresolved.length +
      report.staleResolutions.length >
    0
  );
}
