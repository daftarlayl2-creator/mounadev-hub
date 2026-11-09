import { describe, expect, it } from 'vitest';
import { validateProductionCorsOrigins } from '../../src/config';

describe('production CORS origin validation', () => {
  it('accepts and deduplicates explicit HTTPS origins', () => {
    expect(validateProductionCorsOrigins('https://hub.mounadev.com, https://app.mounadev.com,https://hub.mounadev.com'))
      .toEqual(['https://hub.mounadev.com', 'https://app.mounadev.com']);
  });

  it('rejects an empty allowlist', () => {
    expect(() => validateProductionCorsOrigins(' , '))
      .toThrow('CORS_ORIGINS must contain at least one explicit HTTPS origin');
  });

  it('rejects wildcard origins', () => {
    expect(() => validateProductionCorsOrigins('*'))
      .toThrow('CORS_ORIGINS must contain valid origin URLs only');
  });

  it('rejects non-HTTPS origins', () => {
    expect(() => validateProductionCorsOrigins('http://hub.mounadev.com'))
      .toThrow('CORS_ORIGINS entries must be exact HTTPS origins');
  });

  it('rejects paths and credentials rather than silently broadening an origin', () => {
    expect(() => validateProductionCorsOrigins('https://hub.mounadev.com/dashboard'))
      .toThrow('CORS_ORIGINS entries must be exact HTTPS origins');
    expect(() => validateProductionCorsOrigins('https://user:pass@hub.mounadev.com'))
      .toThrow('CORS_ORIGINS entries must be exact HTTPS origins');
  });
});
