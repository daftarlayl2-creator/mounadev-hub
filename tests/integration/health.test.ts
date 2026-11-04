// tests/integration/health.test.ts
import { describe, it, expect } from 'vitest';

describe('Health Endpoint', () => {
  it('should respond to health check', async () => {
    const res = await fetch('http://localhost:3001/health');
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.timestamp).toBeDefined();
  });
});