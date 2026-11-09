// scripts/seed-agents.ts
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceKey);

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
  const outputPath = path.resolve(process.env.AGENT_API_KEYS_FILE || 'agent-api-keys.json');
  const apiKeys: Record<string, string> = {};
  const hashes: Record<string, string> = {};

  // Generate and hash all credentials before changing any database rows.
  for (const agent of agents) {
    const apiKey = `caissa_${agent.id}_${uuidv4().replace(/-/g, '').substring(0, 32)}`;
    apiKeys[agent.id] = apiKey;
    hashes[agent.id] = await bcrypt.hash(apiKey, 10);
  }

  // Create the operator-only credential file before applying rotations. Exclusive
  // creation prevents an accidental rerun from overwriting the only copy of keys.
  // POSIX permissions are owner read/write; Windows applies its platform defaults.
  fs.writeFileSync(outputPath, JSON.stringify(apiKeys, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  try {
    fs.chmodSync(outputPath, 0o600);
  } catch {
    // chmod semantics vary by platform; the file was still created exclusively.
  }

  const failedAgents: string[] = [];
  for (const agent of agents) {
    const { error } = await supabase
      .from('agents')
      .update({ api_key_hash: hashes[agent.id], permissions: agent.permissions })
      .eq('id', agent.id);

    if (error) {
      failedAgents.push(agent.id);
      console.error(`Failed to update agent credentials: ${agent.id}`);
    }
  }

  if (failedAgents.length > 0) {
    console.error(`Credential rotation incomplete for agent IDs: ${failedAgents.join(', ')}`);
    console.error(`Review the protected credential file at: ${outputPath}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Agent credentials generated and stored at: ${outputPath}`);
  console.log('Do not commit, upload, paste, or include this file in logs or support requests.');
}

seed().catch((error: unknown) => {
  // Never print credential values or provider request objects.
  console.error('Agent credential seeding failed:', error instanceof Error ? error.message : 'unknown error');
  process.exitCode = 1;
});
