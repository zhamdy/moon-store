/**
 * Produces the served OpenAPI document by deriving every registered request shape from
 * the Zod schema that validates it (#102).
 *
 * ## Why it overlays rather than regenerates
 *
 * `src/docs/openapi.ts` is 11,868 hand-written lines, and almost all of that value is on
 * the *response* side: descriptions, examples, the sale-calculation snapshot schema, tags,
 * security. None of it is derivable, because no response in this server is Zod-validated —
 * generating responses would mean inventing schemas nothing enforces, which is the same
 * defect this change removes, pointed the other way.
 *
 * The request side is the opposite. All 86 documented request bodies are literally
 * `{ type: 'object', additionalProperties: true }` — the published document says nothing
 * about what to send, so replacing them cannot contradict a consumer that read them. That
 * asymmetry is what makes an overlay the right shape: derived requests, preserved
 * responses, one document, and a cutover with no request-shape breakage to audit.
 *
 * ## Determinism
 *
 * The output is compared against the committed document by `check:api-docs`, so it must
 * not depend on iteration order or on the clock. Parameters are sorted by location then
 * name; nothing here reads `Date.now()`, the environment, or the database.
 */
import { z } from 'zod';
import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { openApiSpec } from './openapi';
import { requestContracts } from './requestContracts';
import type { RequestContract } from '../http/requestContracts';

extendZodWithOpenApi(z);

type Json = Record<string, unknown>;

interface ParameterObject extends Json {
  name?: string;
  in?: string;
}

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Structured clone keeps the base document untouched for anything else importing it. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Runs one contract through the converter in isolation.
 *
 * One registry per contract, deliberately: a shared registry would let one operation's
 * `$ref`-able component names leak into another's output depending on registration order,
 * which is exactly the non-determinism the committed artifact cannot tolerate.
 */
function generateRequest(contract: RequestContract): {
  requestBody?: Json;
  parameters: ParameterObject[];
} {
  const registry = new OpenAPIRegistry();

  registry.registerPath({
    method: contract.method.toLowerCase() as Method,
    path: contract.path,
    request: {
      ...(contract.body
        ? {
            body: {
              required: true,
              content: {
                [contract.contentType ?? 'application/json']: { schema: contract.body },
              },
            },
          }
        : {}),
      ...(contract.query ? { query: contract.query as z.AnyZodObject } : {}),
      ...(contract.params ? { params: contract.params as z.AnyZodObject } : {}),
      ...(contract.headers ? { headers: contract.headers as z.AnyZodObject } : {}),
      ...(contract.cookies ? { cookies: contract.cookies as z.AnyZodObject } : {}),
    },
    responses: { 200: { description: 'Successful operation' } },
  });

  const document = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'contract', version: '1.0.0' },
  }) as unknown as { paths?: Record<string, Record<string, Json>> };

  const operation = document.paths?.[contract.path]?.[contract.method.toLowerCase()] ?? {};

  return {
    requestBody: operation.requestBody as Json | undefined,
    parameters: (operation.parameters as ParameterObject[] | undefined) ?? [],
  };
}

/**
 * Whether a schema carries a refinement the converter will drop.
 *
 * Measured, not assumed: `zod-to-openapi` unwraps a `ZodEffects` and generates the inner
 * object's parameters with no warning, so a `.refine()` enforcing "dateFrom before dateTo"
 * silently becomes two unconstrained strings. That is the precise failure this whole
 * change exists to stop, so a contract whose schema is refined must say what the rule is
 * in `beyondSchema` or the build fails.
 *
 * It looks only at the wrappers above the object, which is where cross-field rules live.
 * A `.refine()` on a single field is not detected and does not need to be: its constraint
 * is about that field, and the reader can see the field.
 */
function hasDroppedRefinement(schema: z.ZodTypeAny): boolean {
  let current: z.ZodTypeAny | undefined = schema;

  while (current) {
    if (current instanceof z.ZodEffects) return true;
    const def = current._def as { innerType?: z.ZodTypeAny };
    current = def.innerType;
  }
  return false;
}

function parameterIdentity(parameter: ParameterObject): string | null {
  if (typeof parameter.name !== 'string' || typeof parameter.in !== 'string') return null;
  return `${parameter.in}:${parameter.name}`;
}

/**
 * Derived parameters win; everything else the document already had is kept.
 *
 * `$ref` entries have no `name`/`in` of their own here — the shared `Idempotency-Key`
 * header is one — so they can never be matched and are always preserved. Dropping that
 * header while replacing a body would quietly un-document the retry contract.
 */
function mergeParameters(base: ParameterObject[], derived: ParameterObject[]): ParameterObject[] {
  const derivedIds = new Set(
    derived.map(parameterIdentity).filter((id): id is string => id !== null)
  );
  const kept = base.filter((parameter) => {
    const id = parameterIdentity(parameter);
    return id === null || !derivedIds.has(id);
  });

  return [...kept, ...derived].sort((a, b) => {
    const left = `${a.in ?? ''}:${a.name ?? ''}`;
    const right = `${b.in ?? ''}:${b.name ?? ''}`;
    return left.localeCompare(right);
  });
}

/**
 * Refinements OpenAPI cannot express are appended to the description instead of being
 * dropped. An unrepresentable rule that silently becomes "unconstrained" is worse than
 * the hand-written document was, because it now carries the authority of being generated.
 */
function withBeyondSchema(description: unknown, notes: readonly string[] | undefined): string {
  const base = typeof description === 'string' ? description : '';
  if (!notes || notes.length === 0) return base;
  const rules = notes.map((note) => `- ${note}`).join('\n');
  return `${base}\n\nRules the request schema enforces that OpenAPI cannot express:\n${rules}`.trim();
}

export interface BuildResult {
  document: Json;
  /** Contracts whose operation is absent from the base document — a wiring mistake. */
  unmatched: string[];
  /** Contracts with a refinement the converter drops and no `beyondSchema` note. */
  undocumentedRefinements: string[];
}

export function buildOpenApiDocument(
  contracts: readonly RequestContract[] = requestContracts
): BuildResult {
  const document = clone(openApiSpec) as unknown as Json;
  const paths = (document.paths ?? {}) as Record<string, Record<string, Json>>;
  const unmatched: string[] = [];
  const undocumentedRefinements: string[] = [];

  // Sorted so the artifact does not depend on the registry's declaration order.
  const ordered = [...contracts].sort((a, b) => a.key.localeCompare(b.key));

  for (const contract of ordered) {
    const method = contract.method.toLowerCase();
    const operation = paths[contract.path]?.[method];
    if (!operation) {
      unmatched.push(contract.key);
      continue;
    }

    if (!contract.beyondSchema?.length) {
      for (const location of contract.locations()) {
        const schema = contract[location] as z.ZodTypeAny;
        if (hasDroppedRefinement(schema)) {
          undocumentedRefinements.push(`${contract.key} (${location})`);
        }
      }
    }

    const { requestBody, parameters } = generateRequest(contract);

    if (requestBody) {
      operation.requestBody = requestBody;
    } else if (!contract.body) {
      // An operation that used to document a body and no longer declares one must lose
      // it: a stale `additionalProperties: true` reads as "send whatever you like".
      delete operation.requestBody;
    }

    const merged = mergeParameters((operation.parameters as ParameterObject[]) ?? [], parameters);
    if (merged.length > 0) operation.parameters = merged;

    const description = withBeyondSchema(operation.description, contract.beyondSchema);
    if (description) operation.description = description;
  }

  document.paths = paths;
  return { document, unmatched, undocumentedRefinements };
}

/** The document the server serves and the drift gate compares against. */
export function buildOpenApiSpec(): Json {
  const { document, unmatched } = buildOpenApiDocument();
  if (unmatched.length > 0) {
    throw new Error(
      `Request contracts reference operations the OpenAPI document does not define:\n  ${unmatched.join('\n  ')}`
    );
  }
  return document;
}
