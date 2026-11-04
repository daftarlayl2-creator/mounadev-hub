export declare const config: {
    port: number;
    nodeEnv: string;
    hubApiKey: string;
    supabase: {
        url: string;
        serviceKey: string;
    };
    openwa: {
        baseUrl: string;
        session: string;
        apiKey: string;
    };
    hermes: {
        apiUrl: string;
        apiKey: string;
        model: string;
    };
    whatsappAgent: {
        agentId: string;
        autoReply: boolean;
    };
    webhook: {
        secret: string;
    };
    rateLimits: {
        agentDaily: number;
        agentHourly: number;
        contactDaily: number;
        contactHourly: number;
        globalDaily: number;
        globalHourly: number;
    };
};
export declare function validateConfig(): void;
