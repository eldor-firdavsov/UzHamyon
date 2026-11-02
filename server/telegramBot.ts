import path from 'node:path';
import fs from 'node:fs';

// Load .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  }
} catch (e) {
  console.warn('Could not load .env.local:', e);
}

import { runTelegramPolling } from '../src/lib/telegram/bot.ts';

const controller = new AbortController();

process.on('SIGINT', () => {
  console.log('\nStopping Telegram bot...');
  controller.abort();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nStopping Telegram bot...');
  controller.abort();
  process.exit(0);
});

runTelegramPolling(controller.signal).catch((err) => {
  console.error('Fatal error in Telegram bot poller:', err);
  process.exit(1);
});
