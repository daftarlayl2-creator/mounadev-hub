// tests/unit/automation.test.ts
import { describe, it, expect } from 'vitest';
import { automationService } from '../../src/services/automationService';

describe('AutomationService', () => {
  describe('isOptOutMessage', () => {
    it('detects English opt-out', () => {
      expect(automationService.isOptOutMessage('Please stop sending messages')).toBe(true);
      expect(automationService.isOptOutMessage('unsubscribe me')).toBe(true);
    });
    it('detects French opt-out', () => {
      expect(automationService.isOptOutMessage('arrêtez les messages')).toBe(true);
      expect(automationService.isOptOutMessage('désabonner')).toBe(true);
    });
    it('detects Arabic opt-out', () => {
      expect(automationService.isOptOutMessage('stop')).toBe(true);
    });
    it('returns false for normal messages', () => {
      expect(automationService.isOptOutMessage('Hello, I am interested')).toBe(false);
    });
  });

  describe('isComplaintOrSensitive', () => {
    it('detects complaints', () => {
      expect(automationService.isComplaintOrSensitive('This is terrible, I want a refund')).toBe(true);
      expect(automationService.isComplaintOrSensitive('You are a scam')).toBe(true);
    });
    it('detects French complaints', () => {
      expect(automationService.isComplaintOrSensitive('Je veux un remboursement')).toBe(true);
    });
    it('returns false for normal messages', () => {
      expect(automationService.isComplaintOrSensitive('Thank you for the information')).toBe(false);
    });
  });
});