// tests/unit/template.test.ts
import { describe, it, expect } from 'vitest';
import { templateService } from '../../src/services/templateService';

describe('TemplateService', () => {
  describe('validateVariables', () => {
    it('returns valid when all variables present', () => {
      const template = { variables: ['name', 'company'] } as any;
      const result = templateService.validateVariables(template, { name: 'John', company: 'Acme' });
      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it('returns invalid when variables missing', () => {
      const template = { variables: ['name', 'company'] } as any;
      const result = templateService.validateVariables(template, { name: 'John' });
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('company');
    });
  });

  describe('render', () => {
    it('replaces variables in content', () => {
      const template = { content: 'Hello {{name}}, welcome to {{company}}!' } as any;
      const result = templateService.render(template, { name: 'John', company: 'Acme' });
      expect(result).toBe('Hello John, welcome to Acme!');
    });

    it('leaves unreplaced variables', () => {
      const template = { content: 'Hello {{name}}!' } as any;
      const result = templateService.render(template, {});
      expect(result).toBe('Hello {{name}}!');
    });
  });
});