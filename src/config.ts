// src/config.ts
import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
  hubApiKey: process.env.HUB_API_KEY || '',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
  },
  openwa: {
    baseUrl: process.env.OPENWA_BASE_URL || 'http://localhost:2785',
    session: process.env.OPENWA_SESSION || '7224dc3e-1fce-4712-bd32-e23ff410dc90',
    apiKey: process.env.OPENWA_API_KEY || '',
  },
  hermes: {
    apiUrl: process.env.HERMES_API_URL || 'http://127.0.0.1:8642',
    apiKey: process.env.HERMES_API_KEY || '',
    model: process.env.HERMES_MODEL || 'hermes-agent',
  },
  whatsappAgent: {
    agentId: process.env.WHATSAPP_AGENT_ID || 'sami',
    autoReply: (process.env.WHATSAPP_AUTO_REPLY || 'true') === 'true',
  },
  webhook: {
    secret: process.env.WEBHOOK_SECRET || '',
  },
  rateLimits: {
    agentDaily: parseInt(process.env.RATE_LIMIT_AGENT_DAILY || '20', 10),
    agentHourly: parseInt(process.env.RATE_LIMIT_AGENT_HOURLY || '5', 10),
    contactDaily: parseInt(process.env.RATE_LIMIT_CONTACT_DAILY || '3', 10),
    contactHourly: parseInt(process.env.RATE_LIMIT_CONTACT_HOURLY || '1', 10),
    globalDaily: parseInt(process.env.RATE_LIMIT_GLOBAL_DAILY || '100', 10),
    globalHourly: parseInt(process.env.RATE_LIMIT_GLOBAL_HOURLY || '15', 10),
  },
};

export function validateConfig(): void {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  if (process.env.NODE_ENV === 'production') {
    required.push('WEBHOOK_SECRET', 'OPENWA_API_KEY');
    if ((process.env.WHATSAPP_AUTO_REPLY || 'true') === 'true') required.push('HERMES_API_KEY');
  }
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  if (process.env.NODE_ENV === 'production' && (process.env.WEBHOOK_SECRET || '').length < 32) {
    throw new Error('WEBHOOK_SECRET must be at least 32 characters in production');
  }
}