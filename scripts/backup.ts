// scripts/backup.ts
import { getSupabase } from '../src/utils/supabase';
import { logger } from '../src/utils/logger';
import * as fs from 'fs';
import * as path from 'path';

async function backup() {
  const supabase = getSupabase();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(__dirname, '..', 'backups', timestamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const tables = ['agents', 'contacts', 'conversations', 'messages', 'message_templates', 'audit_log'];
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      logger.error(`Failed to backup ${table}`, { error: error.message });
      continue;
    }
    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    logger.info(`Backed up ${table}`, { rows: data?.length || 0, path: filePath });
  }

  logger.info('Backup complete', { dir: backupDir });
}

backup().catch((err) => {
  logger.error('Backup failed', { error: err.message });
  process.exit(1);
});