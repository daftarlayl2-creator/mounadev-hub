-- Caissa Communication Hub — Database Migration 001
-- Run this in Supabase SQL Editor

-- Contacts (leads)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  business_name TEXT,
  business_type TEXT,
  source TEXT DEFAULT 'manual',
  consent_status TEXT DEFAULT 'none',
  consent_date TIMESTAMPTZ,
  opt_out_date TIMESTAMPTZ,
  assigned_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  channel TEXT DEFAULT 'whatsapp',
  status TEXT DEFAULT 'active',
  assigned_agent TEXT,
  last_message_at TIMESTAMPTZ,
  window_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL,
  sender_type TEXT NOT NULL,
  sender_id TEXT,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  template_name TEXT,
  status TEXT DEFAULT 'queued',
  provider_message_id TEXT,
  idempotency_key TEXT UNIQUE,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Message Templates
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  language TEXT DEFAULT 'fr',
  category TEXT DEFAULT 'marketing',
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  provider_template_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_assigned ON contacts(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_conversations_contact ON conversations(contact_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_idempotency ON messages(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- RLS Policies (allow service role full access)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access contacts" ON contacts FOR ALL USING (true);
CREATE POLICY "Service role full access conversations" ON conversations FOR ALL USING (true);
CREATE POLICY "Service role full access messages" ON messages FOR ALL USING (true);
CREATE POLICY "Service role full access templates" ON message_templates FOR ALL USING (true);
CREATE POLICY "Service role full access audit" ON audit_log FOR ALL USING (true);

-- Update agents table to add api_key_hash and permissions
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- Grant permissions to existing agents
UPDATE agents SET permissions = ARRAY['read', 'send', 'write', 'manage', 'admin'] WHERE id = 'mara';
UPDATE agents SET permissions = ARRAY['read', 'send', 'write'] WHERE id IN ('sami', 'bizdev');
UPDATE agents SET permissions = ARRAY['read'] WHERE id NOT IN ('mara', 'sami', 'bizdev');