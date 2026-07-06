import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

describe('OpenAPI clubs-admin contract', () => {
  const openapiPath = path.join(process.cwd(), 'openapi', 'v1', 'openapi.yaml');
  const clubsSchemaPath = path.join(process.cwd(), 'openapi', 'v1', 'schemas', 'clubs.yaml');
  const usersSchemaPath = path.join(process.cwd(), 'openapi', 'v1', 'schemas', 'users.yaml');
  const examplesDir = path.join(process.cwd(), 'openapi', 'v1', 'examples');

  const openapi = parseYaml(fs.readFileSync(openapiPath, 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };

  it('adds the six new clubs-admin endpoints with consistent tags and security', () => {
    const expectations: Array<{ path: string; method: string; tag: string }> = [
      { path: '/clubs', method: 'post', tag: 'Clubs' },
      { path: '/clubs/{clubId}', method: 'patch', tag: 'Clubs' },
      { path: '/clubs/{clubId}/status', method: 'patch', tag: 'Clubs' },
      { path: '/clubs/{clubId}/coaches', method: 'post', tag: 'Clubs' },
      { path: '/clubs/{clubId}/teams', method: 'post', tag: 'Clubs' },
      { path: '/users/{userId}/clubs', method: 'get', tag: 'Users' },
      { path: '/users/{userId}/clubs', method: 'post', tag: 'Users' },
      { path: '/users/{userId}/clubs/{clubId}', method: 'delete', tag: 'Users' }
    ];

    for (const { path: p, method, tag } of expectations) {
      const pathItem = openapi.paths[p];
      expect(pathItem, `path ${p} should be defined`).toBeDefined();
      const operation = pathItem?.[method] as { tags?: string[]; security?: unknown[] } | undefined;
      expect(operation, `${method.toUpperCase()} ${p} should be defined`).toBeDefined();
      expect(operation?.tags, `${method.toUpperCase()} ${p} should expose tags`).toContain(tag);
      expect(operation?.security, `${method.toUpperCase()} ${p} should require bearerAuth`).toBeDefined();
    }
  });

  it('documents club-status enum on the Club schema with the same shape as teams', () => {
    const clubs = parseYaml(fs.readFileSync(clubsSchemaPath, 'utf8')) as {
      components: { schemas: { Club: { properties: Record<string, { enum?: string[] }> } } };
    };
    expect(clubs.components.schemas.Club.properties.status.enum).toEqual(['active', 'inactive']);
  });

  it('extends the User schema with an optional clubIds array', () => {
    const users = parseYaml(fs.readFileSync(usersSchemaPath, 'utf8')) as {
      components: {
        schemas: { User: { properties: Record<string, { type?: string; items?: { type?: string } }> } };
      };
    };
    const clubIds = users.components.schemas.User.properties.clubIds;
    expect(clubIds, 'User.clubIds should be defined').toBeDefined();
    expect(clubIds.type).toBe('array');
    expect(clubIds.items?.type).toBe('string');
  });

  it('exposes a status filter on GET /v1/clubs', () => {
    const op = openapi.paths['/clubs']?.get as {
      parameters?: Array<{ name: string; in: string; schema?: { enum?: string[] } }>;
    };
    const statusParam = op?.parameters?.find((p) => p.name === 'status' && p.in === 'query');
    expect(statusParam, 'GET /clubs should expose ?status= filter').toBeDefined();
    expect(statusParam?.schema?.enum).toEqual(['active', 'inactive', 'all']);
  });

  it('ships example fixtures for the new endpoints', () => {
    const expected = [
      'club-create-success.json',
      'club-update-success.json',
      'club-deactivate-success.json',
      'user-club-assign-success.json',
      'user-club-remove-success.json',
      'club-not-found.json',
      'forbidden-coach-user-club.json'
    ];
    for (const file of expected) {
      expect(fs.existsSync(path.join(examplesDir, file)), `example ${file} should exist`).toBe(true);
    }
  });
});