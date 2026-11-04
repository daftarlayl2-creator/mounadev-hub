// src/utils/supabase.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { logger } from './logger';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    supabaseInstance = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false },
    });
    logger.info('Supabase client initialized', { url: config.supabase.url });
  }
  return supabaseInstance;
}