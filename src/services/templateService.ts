// src/services/templateService.ts
import { getSupabase } from '../utils/supabase';
import { logger } from '../utils/logger';

export interface MessageTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  content: string;
  variables: string[];
  status: string;
  provider_template_id?: string;
  created_at: string;
  updated_at: string;
}

export class TemplateService {
  async list(): Promise<MessageTemplate[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to list templates: ${error.message}`);
    return data || [];
  }

  async getByName(name: string): Promise<MessageTemplate | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').select('*').eq('name', name).single();
    if (error) return null;
    return data;
  }

  async create(template: Partial<MessageTemplate>): Promise<MessageTemplate> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').insert(template).select().single();
    if (error) throw new Error(`Failed to create template: ${error.message}`);
    logger.info('Template created', { name: template.name });
    return data;
  }

  async update(id: string, updates: Partial<MessageTemplate>): Promise<MessageTemplate> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('message_templates').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single();
    if (error) throw new Error(`Failed to update template: ${error.message}`);
    return data;
  }

  async submit(id: string): Promise<MessageTemplate> {
    return this.update(id, { status: 'pending' });
  }

  async approve(id: string, providerTemplateId?: string): Promise<MessageTemplate> {
    return this.update(id, { status: 'approved', provider_template_id: providerTemplateId });
  }

  async reject(id: string): Promise<MessageTemplate> {
    return this.update(id, { status: 'rejected' });
  }

  validateVariables(template: MessageTemplate, variables: Record<string, string>): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    for (const v of template.variables) {
      if (!variables[v]) missing.push(v);
    }
    return { valid: missing.length === 0, missing };
  }

  render(template: MessageTemplate, variables: Record<string, string>): string {
    let content = template.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return content;
  }
}

export const templateService = new TemplateService();