import { z } from 'zod';
export declare const phoneSchema: z.ZodString;
export declare const contactSchema: z.ZodObject<{
    phone: z.ZodString;
    name: z.ZodOptional<z.ZodString>;
    business_name: z.ZodOptional<z.ZodString>;
    business_type: z.ZodOptional<z.ZodString>;
    source: z.ZodDefault<z.ZodEnum<["lead_gen", "manual", "inbound"]>>;
    consent_status: z.ZodDefault<z.ZodEnum<["none", "opted_in", "opted_out"]>>;
    assigned_agent: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    source: "lead_gen" | "manual" | "inbound";
    consent_status: "none" | "opted_in" | "opted_out";
    name?: string | undefined;
    business_name?: string | undefined;
    business_type?: string | undefined;
    assigned_agent?: string | undefined;
    notes?: string | undefined;
}, {
    phone: string;
    name?: string | undefined;
    business_name?: string | undefined;
    business_type?: string | undefined;
    source?: "lead_gen" | "manual" | "inbound" | undefined;
    consent_status?: "none" | "opted_in" | "opted_out" | undefined;
    assigned_agent?: string | undefined;
    notes?: string | undefined;
}>;
export declare const messageSchema: z.ZodObject<{
    contact_id: z.ZodString;
    content: z.ZodString;
    message_type: z.ZodDefault<z.ZodEnum<["text", "template", "media", "location"]>>;
    idempotency_key: z.ZodOptional<z.ZodString>;
    template_name: z.ZodOptional<z.ZodString>;
    media_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    contact_id: string;
    content: string;
    message_type: "text" | "template" | "media" | "location";
    idempotency_key?: string | undefined;
    template_name?: string | undefined;
    media_url?: string | undefined;
}, {
    contact_id: string;
    content: string;
    message_type?: "text" | "template" | "media" | "location" | undefined;
    idempotency_key?: string | undefined;
    template_name?: string | undefined;
    media_url?: string | undefined;
}>;
export declare const templateSchema: z.ZodObject<{
    name: z.ZodString;
    language: z.ZodDefault<z.ZodString>;
    category: z.ZodDefault<z.ZodEnum<["marketing", "utility", "authentication"]>>;
    content: z.ZodString;
    variables: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    name: string;
    content: string;
    language: string;
    category: "marketing" | "utility" | "authentication";
    variables: string[];
}, {
    name: string;
    content: string;
    language?: string | undefined;
    category?: "marketing" | "utility" | "authentication" | undefined;
    variables?: string[] | undefined;
}>;
export declare const optOutSchema: z.ZodObject<{
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
}, {
    reason: string;
}>;
export declare function validatePhone(phone: string): boolean;
export declare function normalizePhone(phone: string): string;
export declare function formatPhone(phone: string): string;
