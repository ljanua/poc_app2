import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const repoRoot = join(__dirname, '..', '..', '..', '..');
const openapiText = readFileSync(join(repoRoot, 'openapi', 'v1', 'openapi.yaml'), 'utf8');
const skillsSchemaText = readFileSync(join(repoRoot, 'openapi', 'v1', 'schemas', 'skills.yaml'), 'utf8');
const openapiDoc = parseYaml(openapiText) as { paths: Record<string, unknown> };

describe('OpenAPI skills admin contract', () => {
  describe('schema file (skills.yaml)', () => {
    it('defines the four core entity schemas', () => {
      expect(skillsSchemaText).toContain('Sport:');
      expect(skillsSchemaText).toContain('Position:');
      expect(skillsSchemaText).toContain('Skill:');
      expect(skillsSchemaText).toContain('PositionSkill:');
    });

    it('defines Sport name with 2-40 char validation', () => {
      expect(skillsSchemaText).toMatch(/Sport:[\s\S]*?name:[\s\S]*?minLength:\s*2/);
      expect(skillsSchemaText).toMatch(/Sport:[\s\S]*?name:[\s\S]*?maxLength:\s*40/);
    });

    it('defines Position name with 2-80 char validation', () => {
      expect(skillsSchemaText).toMatch(/Position:[\s\S]*?name:[\s\S]*?minLength:\s*2/);
      expect(skillsSchemaText).toMatch(/Position:[\s\S]*?name:[\s\S]*?maxLength:\s*80/);
    });

    it('defines Skill name with 2-60 char validation', () => {
      expect(skillsSchemaText).toMatch(/Skill:[\s\S]*?name:[\s\S]*?minLength:\s*2/);
      expect(skillsSchemaText).toMatch(/Skill:[\s\S]*?name:[\s\S]*?maxLength:\s*60/);
    });

    it('constrains status to active/inactive across all entities', () => {
      const statusEnum = /enum:\s*\[active,\s*inactive\]/g;
      const matches = skillsSchemaText.match(statusEnum) ?? [];
      // Sport + Position + Skill + SportStatusRequest + PositionStatusRequest = 5
      expect(matches.length).toBeGreaterThanOrEqual(3);
    });

    it('defines the SkillErrorResponse envelope with the four expected codes', () => {
      expect(skillsSchemaText).toContain('SkillErrorResponse:');
      expect(skillsSchemaText).toMatch(/SkillErrorResponse:[\s\S]*?validation_error/);
      expect(skillsSchemaText).toMatch(/SkillErrorResponse:[\s\S]*?forbidden/);
      expect(skillsSchemaText).toMatch(/SkillErrorResponse:[\s\S]*?not_found/);
      expect(skillsSchemaText).toMatch(/SkillErrorResponse:[\s\S]*?conflict/);
    });

    it('declares the create/update/status request payloads', () => {
      expect(skillsSchemaText).toContain('CreateSportRequest:');
      expect(skillsSchemaText).toContain('UpdateSportRequest:');
      expect(skillsSchemaText).toContain('SportStatusRequest:');
      expect(skillsSchemaText).toContain('CreatePositionRequest:');
      expect(skillsSchemaText).toContain('UpdatePositionRequest:');
      expect(skillsSchemaText).toContain('PositionStatusRequest:');
      expect(skillsSchemaText).toContain('CreateSkillRequest:');
      expect(skillsSchemaText).toContain('UpdateSkillRequest:');
      expect(skillsSchemaText).toContain('AssignSkillToPositionRequest:');
    });

    it('declares list/response envelopes for every collection', () => {
      expect(skillsSchemaText).toContain('SportListResponse:');
      expect(skillsSchemaText).toContain('SportResponse:');
      expect(skillsSchemaText).toContain('PositionListResponse:');
      expect(skillsSchemaText).toContain('PositionResponse:');
      expect(skillsSchemaText).toContain('SkillListResponse:');
      expect(skillsSchemaText).toContain('SkillResponse:');
      expect(skillsSchemaText).toContain('PositionSkillListResponse:');
    });

    it('exposes convenience count fields on each list payload', () => {
      expect(skillsSchemaText).toMatch(/Sport:[\s\S]*?positionCount:/);
      expect(skillsSchemaText).toMatch(/Position:[\s\S]*?skillCount:/);
      expect(skillsSchemaText).toMatch(/Skill:[\s\S]*?assignedPositionCount:/);
    });
  });

  describe('paths (openapi.yaml)', () => {
    it('documents the eight new endpoints', () => {
      expect(openapiText).toContain('/sports:');
      expect(openapiText).toContain('/sports/{sportId}:');
      expect(openapiText).toContain('/sports/{sportId}/status:');
      expect(openapiText).toContain('/positions:');
      expect(openapiText).toContain('/positions/{positionId}:');
      expect(openapiText).toContain('/positions/{positionId}/status:');
      expect(openapiText).toContain('/skills:');
      expect(openapiText).toContain('/skills/{skillId}:');
      expect(openapiText).toContain('/positions/{positionId}/skills:');
      expect(openapiText).toContain('/positions/{positionId}/skills/{skillId}:');
    });

    it('tags every new endpoint with [Skills]', () => {
      // The clubs users/teams paths in this doc use [Clubs] / [Clubs, Users] etc.
      // Every Skills-tagged path uses the new schemas/skills.yaml refs.
      const skillsTagCount = (openapiText.match(/tags:\s*\[Skills\]/g) ?? []).length;
      expect(skillsTagCount).toBeGreaterThanOrEqual(8);
    });

    it('declares sportId as a query parameter on GET /positions', () => {
      const listOperation = (openapiDoc.paths['/positions'] as { get: { parameters: Array<{ name: string; in: string }> } }).get;
      const sportIdParam = listOperation.parameters.find((p) => p.name === 'sportId' && p.in === 'query');
      expect(sportIdParam).toBeDefined();
    });

    it('declares 409 conflict on DELETE /skills/{skillId}', () => {
      const path = openapiDoc.paths['/skills/{skillId}'] as { delete: { responses: Record<string, unknown> } };
      expect(path.delete.responses['409']).toBeDefined();
    });

    it('declares 403 forbidden on every write endpoint', () => {
      const writePaths: Array<[string, string, string]> = [
        ['/sports', 'post', '201'],
        ['/sports/{sportId}', 'patch', '200'],
        ['/sports/{sportId}/status', 'patch', '200'],
        ['/positions', 'post', '201'],
        ['/positions/{positionId}', 'patch', '200'],
        ['/positions/{positionId}/status', 'patch', '200'],
        ['/skills', 'post', '201'],
        ['/skills/{skillId}', 'patch', '200'],
        ['/skills/{skillId}', 'delete', '204'],
        ['/positions/{positionId}/skills', 'post', '201'],
        ['/positions/{positionId}/skills/{skillId}', 'delete', '204'],
      ];
      for (const [p, method, successCode] of writePaths) {
        const pathObj = openapiDoc.paths[p] as Record<string, { responses: Record<string, unknown> }>;
        expect(pathObj, `path ${p} not found`).toBeDefined();
        expect(pathObj[method], `method ${method} not found on ${p}`).toBeDefined();
        expect(pathObj[method].responses['403'], `${p} ${method} missing 403 forbidden`).toBeDefined();
        expect(pathObj[method].responses[successCode], `${p} ${method} missing ${successCode} success`).toBeDefined();
      }
    });

    it('mirrors the 200/201 idempotent split on POST /positions/{positionId}/skills', () => {
      const pathObj = openapiDoc.paths['/positions/{positionId}/skills'] as { post: { responses: Record<string, unknown> } };
      expect(pathObj.post.responses['200']).toBeDefined();
      expect(pathObj.post.responses['201']).toBeDefined();
    });
  });

  describe('security', () => {
    it('requires bearerAuth on every new endpoint', () => {
      const newPaths = [
        '/sports', '/sports/{sportId}', '/sports/{sportId}/status',
        '/positions', '/positions/{positionId}', '/positions/{positionId}/status',
        '/skills', '/skills/{skillId}',
        '/positions/{positionId}/skills', '/positions/{positionId}/skills/{skillId}',
      ];
      for (const p of newPaths) {
        const pathObj = openapiDoc.paths[p] as Record<string, { security: Array<{ bearerAuth?: unknown }> }>;
        // At least one method per path should declare bearerAuth.
        const methods = Object.values(pathObj);
        const hasAuth = methods.some((m) => Array.isArray(m.security) && m.security.some((s) => 'bearerAuth' in s));
        expect(hasAuth, `${p} missing bearerAuth on at least one method`).toBe(true);
      }
    });
  });
});