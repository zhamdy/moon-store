/**
 * The request half of the API contract, proven derived rather than described (#102).
 *
 * `check:api-docs` compares the *set* of routes. These assertions are the other axis: that
 * what the document says to send is what the validator accepts, and that it stays that way
 * because there is only one object, not two kept in agreement.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildOpenApiDocument, buildOpenApiSpec } from '../src/docs/buildOpenApi';
import { requestContracts } from '../src/docs/requestContracts';
import { defineRequestContract, indexContracts } from '../src/http/requestContracts';
import { usersRequestContracts } from '../src/modules/core/users/schemas';

const serverRoot = resolve(__dirname, '..');

type Json = Record<string, unknown>;

function operationOf(document: Json, method: string, path: string): Json {
  const paths = document.paths as Record<string, Record<string, Json>>;
  const operation = paths[path]?.[method.toLowerCase()];
  if (!operation) throw new Error(`no operation for ${method} ${path}`);
  return operation;
}

function bodySchemaOf(document: Json, method: string, path: string): Json {
  const requestBody = operationOf(document, method, path).requestBody as Json;
  const content = requestBody.content as Record<string, { schema: Json }>;
  return content['application/json'].schema;
}

function queryParamsOf(document: Json, method: string, path: string): Map<string, Json> {
  const parameters = (operationOf(document, method, path).parameters ?? []) as Array<{
    name?: string;
    in?: string;
    schema?: Json;
    required?: boolean;
  }>;
  return new Map(
    parameters
      .filter((parameter) => parameter.in === 'query' && typeof parameter.name === 'string')
      .map((parameter) => [parameter.name as string, parameter as unknown as Json])
  );
}

describe('request contracts', () => {
  it('rejects two contracts describing one operation', () => {
    const duplicate = defineRequestContract({
      method: 'GET',
      path: '/api/v1/users',
      operation: 'other',
    });
    expect(() => indexContracts([usersRequestContracts.listUsers, duplicate])).toThrow(
      /Duplicate request contract for GET \/api\/v1\/users/
    );
  });

  it('refuses to parse an input the operation does not declare, rather than allowing it', () => {
    // The failure mode this guards: a contract with no body silently accepting anything
    // because nothing was there to say no.
    expect(() => usersRequestContracts.deleteUser.parseBody({ anything: true })).toThrow(
      /declares no body schema/
    );
  });

  it('reports the locations each operation actually reads', () => {
    expect(usersRequestContracts.updateUser.locations()).toEqual(['body', 'params']);
    expect(usersRequestContracts.listUsers.locations()).toEqual(['query']);
    expect(usersRequestContracts.getFavorites.locations()).toEqual([]);
  });

  it('names an operation the document does not define instead of dropping it', () => {
    const orphan = defineRequestContract({
      method: 'POST',
      path: '/api/v1/nothing-here',
      operation: 'orphan',
      body: z.object({}),
    });
    const { unmatched } = buildOpenApiDocument([orphan]);
    expect(unmatched).toEqual(['POST /api/v1/nothing-here']);
  });
});

describe('generated request shapes agree with the validators', () => {
  const document = buildOpenApiSpec();

  it('documents required, optional and nullable exactly as the schema decides', () => {
    const create = bodySchemaOf(document, 'POST', '/api/v1/users');
    expect(create.required).toEqual(['name', 'email', 'password', 'role']);

    const update = bodySchemaOf(document, 'PUT', '/api/v1/users/{id}');
    expect(update.required).toBeUndefined();

    const properties = update.properties as Record<string, Json>;
    // `password` is `.optional().nullable()`: null clears it, omitted leaves it.
    expect(properties.password.type).toEqual(['string', 'null']);
    expect(properties.name.type).toBe('string');
  });

  it('carries the constraints the validator enforces, not just the types', () => {
    const create = bodySchemaOf(document, 'POST', '/api/v1/users');
    const properties = create.properties as Record<string, Json>;

    expect(properties.name).toMatchObject({ minLength: 1, maxLength: 255 });
    expect(properties.password).toMatchObject({ minLength: 6 });
    expect(properties.email).toMatchObject({ format: 'email' });
    expect(properties.role).toMatchObject({ enum: ['Admin', 'Cashier', 'Delivery'] });
  });

  it('says unknown keys are refused only where the schema refuses them', () => {
    // `favoritesSchema` is `.strict()`; the user schemas are not, and Zod's default is to
    // strip rather than reject. Documenting `additionalProperties: false` on the second
    // pair would promise a rejection that never happens.
    const favorites = bodySchemaOf(document, 'PUT', '/api/v1/users/me/favorites');
    expect(favorites.additionalProperties).toBe(false);

    const create = bodySchemaOf(document, 'POST', '/api/v1/users');
    expect(create.additionalProperties).toBeUndefined();
  });

  it('documents the array bound the validator applies', () => {
    const favorites = bodySchemaOf(document, 'PUT', '/api/v1/users/me/favorites');
    const properties = favorites.properties as Record<string, Json>;
    expect(properties.favorites).toMatchObject({ type: 'array', maxItems: 100 });
    expect(favorites.required).toEqual(['favorites']);
  });

  it('documents query inputs as the wire values a caller can send, not the parsed ones', () => {
    // `page` is a string that transforms to a number. Documenting `integer` would tell a
    // consumer to send JSON they cannot put in a query string, and the default would be
    // wrong too: the schema defaults the *string* '1'.
    const query = queryParamsOf(document, 'GET', '/api/v1/users');

    expect(query.get('page')).toMatchObject({
      required: false,
      schema: { type: 'string', pattern: '^\\d+$', default: '1' },
    });
    expect(query.get('pageSize')).toMatchObject({
      schema: { type: 'string', enum: ['10', '25', '50', '100'], default: '25' },
    });
    expect(query.get('sortOrder')).toMatchObject({
      schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
    });
    expect(query.get('search')).toMatchObject({
      required: false,
      schema: { type: 'string', minLength: 1, maxLength: 100 },
    });
  });

  it('documents path parameters from the schema that validates them', () => {
    const parameters = operationOf(document, 'DELETE', '/api/v1/users/{id}')
      .parameters as Array<Json>;
    expect(parameters).toContainEqual(
      expect.objectContaining({
        name: 'id',
        in: 'path',
        required: true,
        schema: expect.objectContaining({ type: 'string', pattern: '^\\d+$' }),
      })
    );
  });

  it('states the rules OpenAPI cannot express instead of dropping them', () => {
    const list = operationOf(document, 'GET', '/api/v1/users');
    expect(list.description).toContain('The query is strict');

    const update = operationOf(document, 'PUT', '/api/v1/users/{id}');
    expect(update.description).toContain('password may be null');
    // The hand-written classification survives alongside it.
    expect(update.description).toContain('Endpoint classification: M');
  });
});

describe('the generated document tracks the schema, not a copy of it', () => {
  it('changes when the schema changes', () => {
    const tightened = defineRequestContract({
      ...usersRequestContracts.updateFavorites,
      body: z.object({ favorites: z.array(z.unknown()).max(5) }).strict(),
    });

    const { document } = buildOpenApiDocument([tightened]);
    const properties = (
      bodySchemaOf(document, 'PUT', '/api/v1/users/me/favorites').properties as Record<string, Json>
    ).favorites as Json;

    expect(properties.maxItems).toBe(5);
    // ...and the committed document still says 100, so the two are genuinely coupled.
    const current = bodySchemaOf(buildOpenApiSpec(), 'PUT', '/api/v1/users/me/favorites');
    expect(((current.properties as Record<string, Json>).favorites as Json).maxItems).toBe(100);
  });

  it('enforces every location it documents, in every module', () => {
    /*
     * The defect this exists to catch, found in this repo rather than imagined: `users`
     * and `branches` declared `params` schemas that nothing ever called, so the published
     * document described a validation that did not run. That is the two-descriptions
     * problem the contract is supposed to make impossible, reintroduced through the door
     * marked "documentation only".
     *
     * A declared location must therefore have a `parse<Location>` call somewhere in the
     * module controllers. Source matching is coarse -- it proves the call exists, not that
     * it guards the right branch -- but it fails the moment a schema is declared and never
     * wired, which is the whole failure mode.
     */
    const controllers = readdirSync(resolve(serverRoot, 'src/modules'), { recursive: true })
      .filter((entry) => entry.toString().endsWith('controller.ts'))
      .map((entry) => readFileSync(resolve(serverRoot, 'src/modules', entry.toString()), 'utf8'))
      .join(' ');

    const unenforced: string[] = [];
    for (const contract of requestContracts) {
      for (const location of contract.locations()) {
        const method = `parse${location[0].toUpperCase()}${location.slice(1)}`;
        if (!controllers.includes(`.${contract.operation}.${method}`)) {
          unenforced.push(`${contract.key} declares ${location} but nothing calls ${method}`);
        }
      }
    }

    expect(unenforced, unenforced.join('; ')).toEqual([]);
  });

  it('keeps controllers off the schemas their contracts already own', () => {
    // A controller reaching past its contract to a schema directly is the drift this
    // replaced; it must not come back unnoticed.
    const controller = readFileSync(
      resolve(serverRoot, 'src/modules/core/users/controller.ts'),
      'utf8'
    );
    expect(controller).not.toMatch(/(create|update)UserSchema\s*\.\s*(safeParse|parse)\(/);
    expect(controller).not.toMatch(/favoritesSchema\s*\.\s*(safeParse|parse)\(/);
  });
});

describe('the builder is safe to run anywhere', () => {
  it('needs no database, credential, or environment to produce a document', () => {
    /*
     * Generation runs in CI and in a pre-commit hook, so nothing behind a contract may
     * reach a connection pool, and a schema file must not import the controller that
     * imports it. The second half is not hypothetical: `collections` kept its bodies in
     * the controller so they would sit beside the #78 reasoning, and the resulting cycle
     * loaded fine under vitest and threw `Cannot access 'collectionSchema' before
     * initialization` the moment `check:api-docs` required it. The unit suite proved
     * nothing here; the CLI did.
     */
    const schemaFiles = readdirSync(resolve(serverRoot, 'src/modules'), { recursive: true })
      .map((entry) => entry.toString())
      .filter((entry) => entry.endsWith('schemas.ts'));

    expect(schemaFiles.length).toBeGreaterThan(5);

    for (const relative of schemaFiles) {
      const imports = readFileSync(resolve(serverRoot, 'src/modules', relative), 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^\s*import\b/.test(line))
        .join(' ');
      expect(imports, `${relative} imports something it must not`).not.toMatch(
        /\/(service|repository|database)|\.\/controller/
      );
    }
    expect(() => buildOpenApiSpec()).not.toThrow();
  });

  it('produces byte-identical output on every run', () => {
    // The artifact is compared against a committed file, so ordering churn would show up
    // as drift that nobody caused.
    expect(JSON.stringify(buildOpenApiSpec())).toBe(JSON.stringify(buildOpenApiSpec()));
  });

  it('leaves every response, tag and security requirement the document already had', () => {
    const document = buildOpenApiSpec();
    const create = operationOf(document, 'POST', '/api/v1/users');

    expect(create.tags).toEqual(['Users']);
    expect(create.security).toEqual([{ BearerAuth: [] }]);
    expect(Object.keys(create.responses as Json)).toEqual([
      '200',
      '400',
      '401',
      '403',
      '404',
      '500',
    ]);
    expect((document.components as Json).securitySchemes).toBeDefined();
  });

  it('covers every operation the users router serves', () => {
    const usersKeys = requestContracts
      .filter((contract) => contract.path.startsWith('/api/v1/users'))
      .map((contract) => contract.key)
      .sort();

    expect(usersKeys).toEqual(
      [
        'DELETE /api/v1/users/{id}',
        'GET /api/v1/users',
        'GET /api/v1/users/delivery',
        'GET /api/v1/users/me/favorites',
        'PUT /api/v1/users/me/favorites',
        'PUT /api/v1/users/{id}',
        'POST /api/v1/users',
      ].sort()
    );
  });
});
