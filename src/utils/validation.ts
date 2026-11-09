// src/utils/validation.ts
import { z } from 'zod';

export const phoneSchema = z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

export const contactSchema = z.object({
  phone: phoneSchema,
  name: z.string().min(1).max(100).optional(),
  business_name: z.string().max(200).optional(),
  business_type: z.string().max(50).optional(),
  source: z.enum(['lead_gen', 'manual', 'inbound']).default('manual'),
  notes: z.string().max(1000).optional(),
}).strict();

export const contactUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  business_name: z.string().max(200).optional(),
  business_type: z.string().max(50).optional(),
  notes: z.string().max(1000).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one editable field is required');

export const conversationCreateSchema = z.object({
  contact_id: z.string().uuid(),
  channel: z.enum(['whatsapp', 'sms', 'email']).default('whatsapp'),
}).strict();

export const conversationUpdateSchema = z.object({
  status: z.enum(['active', 'closed', 'escalated']).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one editable field is required');

export const templateUpdateSchema = z.object({
  content: z.string().min(1).max(1024).optional(),
  language: z.string().length(2).optional(),
  category: z.enum(['marketing', 'utility', 'authentication']).optional(),
  variables: z.array(z.string().max(100)).max(100).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one editable field is required');

export const messageSchema = z.object({
  contact_id: z.string().uuid(),
  content: z.string().min(1).max(4096),
  message_type: z.enum(['text', 'template', 'media', 'location']).default('text'),
  idempotency_key: z.string().max(255).optional(),
  template_name: z.string().max(100).optional(),
  media_url: z.string().url().optional(),
}).strict();

export const templateMessageSchema = z.object({
  contact_id: z.string().uuid(),
  template_name: z.string().min(1).max(100),
  variables: z.record(z.string(), z.string().max(1000)).optional().refine(value => value === undefined || Object.keys(value).length <= 100, 'At most 100 template variables are allowed'),
  idempotency_key: z.string().max(255).optional(),
}).strict();

export const templateSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, 'Template name must be lowercase alphanumeric with underscores'),
  language: z.string().length(2).default('fr'),
  category: z.enum(['marketing', 'utility', 'authentication']).default('marketing'),
  content: z.string().min(1).max(1024),
  variables: z.array(z.string().max(100)).max(100).default([]),
}).strict();

export const optOutSchema = z.object({
  reason: z.string().min(1).max(500),
});

export function validatePhone(phone: string): boolean {
  return phoneSchema.safeParse(phone).success;
}

export function normalizePhone(phone: string): string {
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

export function formatPhone(phone: string): string {
  // Add + prefix for display/sending
  if (!phone.startsWith('+')) {
    return '+' + phone;
  }
  return phone;
}