/**
 * What the server actually publishes (#102).
 *
 * `buildOpenApi` is tested on its own; this is the narrower question of whether the
 * document reaches `/openapi.json` and `/reference`, because a derived spec nobody serves
 * is the state this branch spent most of its life in.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { servedOpenApiSpec } from '../src/docs/servedSpec';
import { buildOpenApiSpec } from '../src/docs/buildOpenApi';

type Json = Record<string, unknown>;

const serverRoot = resolve(__dirname, '..');
const entrypoint = readFileSync(resolve(serverRoot, 'index.ts'), 'utf8');

describe('the served OpenAPI document', () => {
  it('is the built document, not the hand-written base', () => {
    expect(JSON.stringify(servedOpenApiSpec)).toBe(JSON.stringify(buildOpenApiSpec()));
  });

  it('reaches both publication points', () => {
    // Both, deliberately: the JSON endpoint and the rendered reference were separate
    // references to the old constant, so updating one and not the other would have left
    // the browsable documentation describing a different API from the machine-readable one.
    expect(entrypoint).toMatch(/res\.json\(servedOpenApiSpec\)/);
    expect(entrypoint).toMatch(/content: servedOpenApiSpec/);
    expect(entrypoint).not.toMatch(/openApiSpec\b(?!\s*=)/);
  });

  it('publishes a real schema for every request body it claims', () => {
    const paths = servedOpenApiSpec.paths as Record<string, Record<string, Json>>;
    const vacuous: string[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) continue;
        const body = operation.requestBody as
          | { content?: Record<string, { schema?: Json }> }
          | undefined;
        for (const media of Object.values(body?.content ?? {})) {
          const schema = (media.schema ?? {}) as Json;
          if (schema.additionalProperties === true && !schema.properties) {
            vacuous.push(`${method.toUpperCase()} ${path}`);
          }
        }
      }
    }

    // 86 of these before #102 — every documented body in the API said "send an object".
    expect(vacuous, vacuous.join(', ')).toEqual([]);
  });

  it('keeps the hand-written half it does not derive', () => {
    const paths = servedOpenApiSpec.paths as Record<string, Record<string, Json>>;
    const sale = paths['/api/v1/sales'].post;

    expect(sale.tags).toEqual(['POS Sales']);
    expect(sale.security).toEqual([{ BearerAuth: [] }]);
    expect(Object.keys(sale.responses as Json).length).toBeGreaterThan(1);

    const components = servedOpenApiSpec.components as Json;
    expect((components.schemas as Json).SaleCalculationSnapshot).toBeDefined();
    expect((components.securitySchemes as Json).BearerAuth).toBeDefined();
  });

  it('has no regex scraper left to be mistaken for the generator', () => {
    // `scripts/generateOpenApi.ts` scraped the manifest's source text and produced a
    // document nothing served. Leaving a file named `generateOpenApi` beside a generator
    // that actually works is worse than either alone.
    expect(() => readFileSync(resolve(serverRoot, 'scripts/generateOpenApi.ts'))).toThrow();
  });
});
