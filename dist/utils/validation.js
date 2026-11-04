"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.optOutSchema = exports.templateSchema = exports.messageSchema = exports.contactSchema = exports.phoneSchema = void 0;
exports.validatePhone = validatePhone;
exports.normalizePhone = normalizePhone;
exports.formatPhone = formatPhone;
// src/utils/validation.ts
const zod_1 = require("zod");
exports.phoneSchema = zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');
exports.contactSchema = zod_1.z.object({
    phone: exports.phoneSchema,
    name: zod_1.z.string().min(1).max(100).optional(),
    business_name: zod_1.z.string().max(200).optional(),
    business_type: zod_1.z.string().max(50).optional(),
    source: zod_1.z.enum(['lead_gen', 'manual', 'inbound']).default('manual'),
    consent_status: zod_1.z.enum(['none', 'opted_in', 'opted_out']).default('none'),
    assigned_agent: zod_1.z.string().max(50).optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
exports.messageSchema = zod_1.z.object({
    contact_id: zod_1.z.string().uuid(),
    content: zod_1.z.string().min(1).max(4096),
    message_type: zod_1.z.enum(['text', 'template', 'media', 'location']).default('text'),
    idempotency_key: zod_1.z.string().max(255).optional(),
    template_name: zod_1.z.string().max(100).optional(),
    media_url: zod_1.z.string().url().optional(),
});
exports.templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Template name must be lowercase alphanumeric with underscores'),
    language: zod_1.z.string().length(2).default('fr'),
    category: zod_1.z.enum(['marketing', 'utility', 'authentication']).default('marketing'),
    content: zod_1.z.string().min(1).max(1024),
    variables: zod_1.z.array(zod_1.z.string()).default([]),
});
exports.optOutSchema = zod_1.z.object({
    reason: zod_1.z.string().min(1).max(500),
});
function validatePhone(phone) {
    return exports.phoneSchema.safeParse(phone).success;
}
function normalizePhone(phone) {
    // Remove spaces, dashes, parentheses
    let cleaned = phone.replace(/[\s\-()]/g, '');
    // Remove + prefix (Supabase masks phones starting with +)
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    // Assume Morocco if starts with 0
    if (cleaned.startsWith('0')) {
        cleaned = '212' + cleaned.substring(1);
    }
    return cleaned;
}
function formatPhone(phone) {
    // Add + prefix for display/sending
    if (!phone.startsWith('+')) {
        return '+' + phone;
    }
    return phone;
}
//# sourceMappingURL=validation.js.map