// scripts/seed-agents.ts
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

const agents = [
  { id: 'mara', name: 'Mara', role: 'Manager', permissions: ['read', 'send', 'write', 'manage', 'admin'] },
  { id: 'sami', name: 'Sami', role: 'Sales', permissions: ['read', 'send', 'write'] },
  { id: 'bizdev', name: 'BizDev', role: 'Business Development', permissions: ['read', 'send', 'write'] },
  { id: 'copywriter', name: 'Copywriter', role: 'Copywriter', permissions: ['read'] },
  { id: 'lina', name: 'Lina', role: 'Designer', permissions: ['read'] },
  { id: 'yassine', name: 'Yassine', role: 'Frontend Dev', permissions: ['read'] },
  { id: 'omar', name: 'Omar', role: 'Backend Dev', permissions: ['read'] },
  { id: 'nour', name: 'Nour', role: 'Mobile Dev', permissions: ['read'] },
  { id: 'hana', name: 'Hana', role: 'QA Tester', permissions: ['read'] },
  { id: 'reda', name: 'Reda', role: 'DevOps', permissions: ['read'] },
  { id: 'creative-dir', name: 'Creative Dir', role: 'Creative Director', permissions: ['read'] },
  { id: 'architect', name: 'Architect', role: 'Architect', permissions: ['read'] },
  { id: 'ai-eng', name: 'AI Engineer', role: 'AI Engineer', permissions: ['read'] },
  { id: 'marketing', name: 'Marketing', role: 'Marketing', permissions: ['read'] },
  { id: 'ecommerce', name: 'E-commerce', role: 'E-commerce', permissions: ['read'] },
];

async function seed() {
  console.log('Seeding agent API keys...');
  const apiKeys: Record<string, string> = {};

  for (const agent of agents) {
    const apiKey = `caissa_${agent.id}_${uuidv4().replace(/-/g, '').substring(0, 32)}`;
    const hash = await bcrypt.hash(apiKey, 10);

    const { error } = await supabase
      .from('agents')
      .update({ api_key_hash: hash, permissions: agent.permissions })
      .eq('id', agent.id);

    if (error) {
      console.error(`Failed to update ${agent.id}:`, error.message);
    } else {
      apiKeys[agent.id] = apiKey;
      console.log(`  ${agent.id}: ${apiKey}`);
    }
  }

  // Write API keys to file
  const fs = require('fs');
  fs.writeFileSync('agent-api-keys.json', JSON.stringify(apiKeys, null, 2));
  console.log('\nAPI keys saved to agent-api-keys.json');
  console.log('IMPORTANT: Keep this file secure!');
}

seed().catch(console.error);