// tests/unit/validation.test.ts
import { describe, it, expect } from 'vitest';
import { normalizePhone, formatPhone } from '../../src/utils/validation';

describe('normalizePhone', () => {
  it('strips + prefix', () => {
    expect(normalizePhone('+212612345678')).toBe('212612345678');
  });
  it('converts 0-prefix to 212', () => {
    expect(normalizePhone('0612345678')).toBe('212612345678');
  });
  it('keeps 212 prefix', () => {
    expect(normalizePhone('212612345678')).toBe('212612345678');
  });
  it('removes spaces and dashes', () => {
    expect(normalizePhone('+212 612-345-678')).toBe('212612345678');
  });
});

describe('formatPhone', () => {
  it('adds + prefix', () => {
    expect(formatPhone('212612345678')).toBe('+212612345678');
  });
  it('keeps existing +', () => {
    expect(formatPhone('+212612345678')).toBe('+212612345678');
  });
});