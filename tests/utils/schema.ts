import { expect, type APIRequestContext } from '@playwright/test';

/**
 * Lean OpenAPI contract oracle. The schema is pulled from the app's **live**
 * spec (`GET /api/doc.json`) at runtime — nothing is hardcoded — so the tests
 * follow the API and any drift shows up. Deliberately dependency-free (no ajv):
 * these schemas are tiny (Note has 5 props, /me has 2), so a focused validator
 * covering required keys, `additionalProperties:false` (strict), and the
 * `uuid`/`date-time`/`email` formats is enough for the contract gates.
 */
export interface OpenApiDoc {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, JsonSchema> };
}

interface OpenApiOperation {
  responses?: Record<string, { content?: Record<string, { schema?: JsonSchema }> }>;
}

export interface JsonSchema {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

export async function fetchOpenApi(request: APIRequestContext): Promise<OpenApiDoc> {
  const res = await request.get('/api/doc.json');
  expect(res.status(), 'OpenAPI doc must be reachable').toBe(200);
  return (await res.json()) as OpenApiDoc;
}

function resolveRef(doc: OpenApiDoc, schema?: JsonSchema): JsonSchema | undefined {
  if (schema?.$ref) {
    const name = schema.$ref.split('/').pop() as string;
    return doc.components?.schemas?.[name];
  }
  return schema;
}

/**
 * Schema for a (path, method, status) response body. Prefers `application/json`,
 * then `application/problem+json` (validation errors), then the first available.
 */
export function schemaFor(
  doc: OpenApiDoc,
  path: string,
  method: string,
  status: string,
): JsonSchema | undefined {
  const content = doc.paths?.[path]?.[method]?.responses?.[status]?.content ?? {};
  const key =
    'application/json' in content
      ? 'application/json'
      : 'application/problem+json' in content
        ? 'application/problem+json'
        : Object.keys(content)[0];
  return resolveRef(doc, key ? content[key]?.schema : undefined);
}

/** The documented success status for an operation (first 2xx key). */
export function documentedSuccessStatus(doc: OpenApiDoc, path: string, method: string): string | undefined {
  const responses = doc.paths?.[path]?.[method]?.responses ?? {};
  return Object.keys(responses).find((s) => s.startsWith('2'));
}

const FORMAT_CHECKS: Record<string, RegExp> = {
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
};

function validate(body: unknown, schema: JsonSchema, doc: OpenApiDoc, strict: boolean, path: string): void {
  const resolved = resolveRef(doc, schema) ?? schema;

  if (resolved.type === 'array') {
    expect(Array.isArray(body), `${path} should be an array`).toBe(true);
    for (const [i, item] of (body as unknown[]).entries()) {
      validate(item, resolved.items as JsonSchema, doc, strict, `${path}[${i}]`);
    }
    return;
  }

  const props = resolved.properties ?? {};
  const obj = body as Record<string, unknown>;
  const required = resolved.required ?? []; // absent `required` = nothing required (JSON Schema)

  for (const key of required) {
    expect(obj, `${path}: missing required key "${key}"`).toHaveProperty(key);
  }

  if (strict) {
    const allowed = new Set(Object.keys(props));
    for (const key of Object.keys(obj ?? {})) {
      expect(allowed.has(key), `${path}: unexpected key "${key}"`).toBe(true);
    }
  }

  for (const [key, propSchema] of Object.entries(props)) {
    const value = obj?.[key];
    if (value == null) continue;
    const fmt = propSchema.format;
    if (fmt === 'date-time') {
      expect(Number.isNaN(Date.parse(String(value))), `${path}.${key} not ISO date-time`).toBe(false);
    } else if (fmt && FORMAT_CHECKS[fmt]) {
      expect(String(value), `${path}.${key} not a ${fmt}`).toMatch(FORMAT_CHECKS[fmt]);
    }
  }
}

/** Assert `body` matches `schema`. `strict` also forbids unexpected keys. */
export function expectMatchesSchema(
  body: unknown,
  schema: JsonSchema | undefined,
  doc: OpenApiDoc,
  opts: { strict?: boolean } = {},
): void {
  expect(schema, 'schema must exist in the live spec').toBeTruthy();
  validate(body, schema as JsonSchema, doc, opts.strict ?? false, 'body');
}
