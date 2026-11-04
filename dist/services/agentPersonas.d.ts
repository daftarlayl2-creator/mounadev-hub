export interface AgentPersona {
    id: string;
    name: string;
    role: string;
    systemPrompt: string;
}
export declare const AGENT_PERSONAS: Record<string, AgentPersona>;
export declare function getPersona(agentId: string): AgentPersona;
export declare function listPersonas(): AgentPersona[];
