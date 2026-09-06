/**
 * One description of a request, used by both the validator and the documentation (#102).
 *
 * ## Why a descriptor rather than a second registry
 *
 * Before this, a request had two descriptions: the Zod schema in the controller, which
 * decides what the server accepts, and `src/docs/openapi.ts`, which tells consumers what
 * to send. Nothing held them together — `check:api-docs` compares the *set* of routes and
 * says so explicitly. A documented body could promise a field the validator rejects and
 * every gate stayed green.
 *
 * A registry that merely points at "the same" schema does not fix that: it can drift the
 * moment a controller parses with something else. So a contract is not a description of
 * the validator, it *is* the validator — `parseBody` is what the controller calls, and the
 * schema the document is generated from is the same object. Swapping one means swapping
 * the other, because there is only one.
 *
 * ## What it deliberately does not do
 *
 * Validate responses. Responses are not Zod-validated anywhere in this server, so deriving
 * them would mean inventing schemas that nothing enforces — documentation with the same
 * defect this exists to remove. `src/docs/openapi.ts` keeps its hand-written responses and
 * `buildOpenApi` preserves them untouched.
 */
import { z } from 'zod';
import type { HttpMethod } from './endpointManifest';

/** Where an input rides. `body` is the only one with a content type. */
export type RequestLocation = 'body' | 'query' | 'params' | 'headers' | 'cookies';

export interface RequestContractDefinition {
  readonly method: HttpMethod;
  /**
   * OpenAPI-style path with `{id}` placeholders, matching `src/docs/openapi.ts`.
   * `checkApiDocDrift` already converts between this and Express's `:id`.
   */
  readonly path: string;
  readonly operation: string;
  readonly body?: z.ZodTypeAny;
  readonly query?: z.ZodTypeAny;
  readonly params?: z.ZodTypeAny;
  readonly headers?: z.ZodTypeAny;
  readonly cookies?: z.ZodTypeAny;
  /** Defaults to `application/json`. Set it for uploads and other non-JSON bodies. */
  readonly contentType?: string;
  /**
   * Constraints the schema enforces that OpenAPI cannot express — cross-field
   * refinements, mostly. Rendered into the operation description rather than dropped,
   * because an unrepresentable rule silently becoming "unconstrained" is the failure
   * this whole change exists to stop.
   */
  readonly beyondSchema?: readonly string[];
}

export interface RequestContract extends RequestContractDefinition {
  /** `GET /api/v1/users/{id}` — the key every registry and gate uses. */
  readonly key: string;
  parseBody<T = unknown>(input: unknown): T;
  parseQuery<T = unknown>(input: unknown): T;
  parseParams<T = unknown>(input: unknown): T;
  parseHeaders<T = unknown>(input: unknown): T;
  parseCookies<T = unknown>(input: unknown): T;
  /** The locations this operation actually takes input in. */
  locations(): readonly RequestLocation[];
}

function parserFor(
  schema: z.ZodTypeAny | undefined,
  location: RequestLocation,
  key: string
): (input: unknown) => unknown {
  return (input: unknown) => {
    if (!schema) {
      // Not a validation failure: the caller asked for an input this operation does not
      // declare, which is a wiring mistake and must not read as "anything is allowed".
      throw new Error(`${key} declares no ${location} schema`);
    }
    return schema.parse(input);
  };
}

export function defineRequestContract(definition: RequestContractDefinition): RequestContract {
  const key = `${definition.method} ${definition.path}`;

  return {
    ...definition,
    key,
    parseBody: parserFor(definition.body, 'body', key) as RequestContract['parseBody'],
    parseQuery: parserFor(definition.query, 'query', key) as RequestContract['parseQuery'],
    parseParams: parserFor(definition.params, 'params', key) as RequestContract['parseParams'],
    parseHeaders: parserFor(definition.headers, 'headers', key) as RequestContract['parseHeaders'],
    parseCookies: parserFor(definition.cookies, 'cookies', key) as RequestContract['parseCookies'],
    locations() {
      const all: RequestLocation[] = ['body', 'query', 'params', 'headers', 'cookies'];
      return all.filter((location) => definition[location] !== undefined);
    },
  };
}

/**
 * The `{id}` in a path, as it actually arrives: a string, which the controller then
 * `Number()`s or hands to a repository.
 *
 * Shared because roughly seventy operations take exactly this and a copy per module is a
 * copy that drifts. `.strict()` matters here for a different reason than on a body: Express
 * puts only the route's own parameters in `req.params`, so an unexpected key means the
 * contract's path and the router's path have diverged.
 */
export function pathIdParams(name = 'id'): z.ZodTypeAny {
  return z
    .object({ [name]: z.string().regex(/^\d+$/, `${name} must be a positive integer`) })
    .strict();
}

/**
 * How an operation's request input is accounted for.
 *
 * Every served route must land in one of these before the coverage gate can claim the
 * spec is derived. "Not listed" is the state that has to be impossible: a route nobody
 * classified looks identical to one that genuinely takes no input.
 */
export type RequestInputClassification =
  /** Inputs are described by a contract, and the controller parses through it. */
  | 'contract'
  /** Takes no body, query, or path input at all. */
  | 'none'
  /** Parsed by something that is not a Zod schema; documented by hand, with a reason. */
  | 'custom';

export interface UnconvertedOperation {
  readonly key: string;
  readonly classification: Exclude<RequestInputClassification, 'contract'>;
  readonly reason: string;
}

/** Duplicate keys mean two contracts describe one operation; the last would win silently. */
export function indexContracts(
  contracts: readonly RequestContract[]
): Map<string, RequestContract> {
  const byKey = new Map<string, RequestContract>();
  for (const contract of contracts) {
    if (byKey.has(contract.key)) {
      throw new Error(`Duplicate request contract for ${contract.key}`);
    }
    byKey.set(contract.key, contract);
  }
  return byKey;
}
