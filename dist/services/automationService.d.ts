export declare class AutomationService {
    routeInbound(contactId: string, conversationId: string): Promise<string>;
    handleInboundConsent(contactId: string): Promise<void>;
    shouldAutoReply(conversationId: string): Promise<boolean>;
    escalateToHuman(conversationId: string, agentId: string, reason: string): Promise<void>;
    isOptOutMessage(content: string): boolean;
    isComplaintOrSensitive(content: string): boolean;
}
export declare const automationService: AutomationService;
