"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.automationService = exports.AutomationService = void 0;
const logger_1 = require("../utils/logger");
const conversationService_1 = require("./conversationService");
const contactService_1 = require("./contactService");
const auditService_1 = require("./auditService");
class AutomationService {
    // Route inbound message to appropriate agent
    async routeInbound(contactId, conversationId) {
        const contact = await contactService_1.contactService.getById(contactId);
        if (!contact)
            return 'sami'; // default
        // If contact has assigned agent, use it
        if (contact.assigned_agent)
            return contact.assigned_agent;
        // Route by business type
        const businessType = contact.business_type?.toLowerCase() || '';
        if (businessType.includes('restaurant') || businessType.includes('cafe'))
            return 'sami';
        if (businessType.includes('tech') || businessType.includes('software'))
            return 'bizdev';
        // Default to sami (sales)
        return 'sami';
    }
    // Auto-consent: inbound message implies opt-in
    async handleInboundConsent(contactId) {
        const contact = await contactService_1.contactService.getById(contactId);
        if (contact && contact.consent_status === 'none') {
            await contactService_1.contactService.update(contactId, {
                consent_status: 'opted_in',
                consent_date: new Date().toISOString(),
            });
            logger_1.logger.info('Auto-consent granted via inbound message', { contactId });
        }
    }
    // Check if contact should receive auto-reply
    async shouldAutoReply(conversationId) {
        const conv = await conversationService_1.conversationService.getById(conversationId);
        if (!conv || conv.status !== 'active')
            return false;
        // Don't auto-reply if conversation is escalated
        if (conv.status === 'escalated')
            return false;
        return true;
    }
    // Escalate conversation to human
    async escalateToHuman(conversationId, agentId, reason) {
        await conversationService_1.conversationService.escalate(conversationId, agentId);
        await auditService_1.auditService.log({
            agentId,
            action: 'escalate_to_human',
            resourceType: 'conversation',
            resourceId: conversationId,
            details: { reason },
        });
        logger_1.logger.info('Conversation escalated to human', { conversationId, reason });
    }
    // Check if message contains opt-out keywords
    isOptOutMessage(content) {
        const keywords = ['stop', 'unsubscribe', 'opt out', 'opt-out', 'arrêter', 'arrêtez', 'désabonner', 'no', 'لا', 'وقف'];
        const lower = content.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    }
    // Check if message contains sensitive/complaint keywords
    isComplaintOrSensitive(content) {
        const keywords = ['complaint', 'refund', 'lawsuit', 'angry', 'terrible', 'scam', 'fraud', 'plainte', 'remboursement', 'arnaque'];
        const lower = content.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    }
}
exports.AutomationService = AutomationService;
exports.automationService = new AutomationService();
//# sourceMappingURL=automationService.js.map