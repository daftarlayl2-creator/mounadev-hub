// src/services/automationService.ts
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';
import { conversationService } from './conversationService';
import { contactService } from './contactService';
import { auditService } from './auditService';

export class AutomationService {
  // Route inbound message to appropriate agent
  async routeInbound(contactId: string, conversationId: string): Promise<string> {
    const contact = await contactService.getById(contactId);
    if (!contact) return 'sami'; // default

    // If contact has assigned agent, use it
    if (contact.assigned_agent) return contact.assigned_agent;

    // Route by business type
    const businessType = contact.business_type?.toLowerCase() || '';
    if (businessType.includes('restaurant') || businessType.includes('cafe')) return 'sami';
    if (businessType.includes('tech') || businessType.includes('software')) return 'bizdev';

    // Default to sami (sales)
    return 'sami';
  }

  // Auto-consent: inbound message implies opt-in
  async handleInboundConsent(contactId: string): Promise<void> {
    const contact = await contactService.getById(contactId);
    if (contact && contact.consent_status === 'none') {
      await contactService.update(contactId, {
        consent_status: 'opted_in',
        consent_date: new Date().toISOString(),
      });
      logger.info('Auto-consent granted via inbound message', { contactId });
    }
  }

  // Check if contact should receive auto-reply
  async shouldAutoReply(conversationId: string): Promise<boolean> {
    const conv = await conversationService.getById(conversationId);
    if (!conv || conv.status !== 'active') return false;

    // Don't auto-reply if conversation is escalated
    if (conv.status === 'escalated') return false;

    return true;
  }

  // Escalate conversation to human
  async escalateToHuman(conversationId: string, agentId: string, reason: string): Promise<void> {
    await conversationService.escalate(conversationId, agentId);
    await auditService.log({
      agentId,
      action: 'escalate_to_human',
      resourceType: 'conversation',
      resourceId: conversationId,
      details: { reason },
    });
    logger.info('Conversation escalated to human', { conversationId, reason });
  }

  // Check if message contains opt-out keywords
  isOptOutMessage(content: string): boolean {
    const keywords = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'arrêter', 'arrêtez', 'désabonner', 'no', 'لا', 'وقف'];
    const lower = content.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }

  // Check if message contains sensitive/complaint keywords
  isComplaintOrSensitive(content: string): boolean {
    const keywords = ['complaint', 'refund', 'lawsuit', 'angry', 'terrible', 'scam', 'fraud', 'plainte', 'remboursement', 'arnaque'];
    const lower = content.toLowerCase();
    return keywords.some(kw => lower.includes(kw));
  }
}

export const automationService = new AutomationService();