/**
 * The document this server publishes (#102).
 *
 * Built once at import and reused, because it is a pure function of code: the same
 * `openapi.ts` and the same contracts produce the same bytes on every call, and rebuilding
 * per request would cost work to arrive at an identical answer.
 *
 * Building at import is also the point at which a wiring mistake surfaces. `buildOpenApiSpec`
 * throws when a contract names an operation the document does not define, or carries a
 * refinement it has not written down — so the process refuses to start rather than serving
 * a document that quietly lost a rule. That is the right trade for an artifact whose only
 * job is to be trustworthy.
 */
import { buildOpenApiSpec } from './buildOpenApi';

export const servedOpenApiSpec = buildOpenApiSpec();
