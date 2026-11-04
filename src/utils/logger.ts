// src/utils/logger.ts
export function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, meta?: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`);
}

export const logger = {
  info: (msg: string, meta?: Record<string, any>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, any>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, any>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, any>) => log('debug', msg, meta),
};