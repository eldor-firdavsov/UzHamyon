import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

const ARTIFACT_DIR = '/home/eldor_firdavsov/.gemini/antigravity-ide/brain/ba8a4419-f27d-4d1f-a360-c6dc235b7da8';
const envContent = fs.readFileSync('.env.local', 'utf8');
const url = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const anonKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();
const serviceKey = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim();
const adminClient = createClient(url, serviceKey);

async function getAuthCookie() {
  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'magiclink',
    email: 'firdavsove1@gmail.com',
  });
  if (linkErr) throw linkErr;

  const cookies = {};
  const ssrClient = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => {
          cookies[name] = value;
        });
      },
    },
  });

  const { error } = await ssrClient.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (error) throw error;

  return cookies;
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function captureScreen(cdp, route, filename, width = 1440, height = 900) {
  console.log(`Capturing ${route} (${width}x${height}) -> ${filename}...`);

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  });

  await cdp.send('Page.navigate', { url: `http://localhost:3000${route}` });
  
  // Wait for network and DOM to settle
  await new Promise((r) => setTimeout(r, 2500));

  const screenshot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
  });

  const buffer = Buffer.from(screenshot.data, 'base64');
  fs.writeFileSync(`${ARTIFACT_DIR}/${filename}`, buffer);
  console.log(`Saved ${filename} (${buffer.length} bytes)`);
}

async function main() {
  console.log('1. Generating real session cookie for firdavsove1@gmail.com...');
  const cookies = await getAuthCookie();
  console.log('Generated cookies:', Object.keys(cookies));

  console.log('2. Launching headless Chrome with remote debugging on port 9222...');
  const chromeProcess = spawn('/usr/bin/google-chrome', [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    'about:blank',
  ], { stdio: 'ignore' });

  await new Promise((r) => setTimeout(r, 1500));

  try {
    const versionRes = await fetch('http://127.0.0.1:9222/json/list');
    const pages = await versionRes.json();
    const wsUrl = pages[0]?.webSocketDebuggerUrl;
    if (!wsUrl) throw new Error('No webSocketDebuggerUrl found');

    const cdp = new CDPClient(wsUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Network.enable');

    // Set auth cookies in Chrome
    for (const [name, value] of Object.entries(cookies)) {
      await cdp.send('Network.setCookie', {
        name,
        value,
        domain: 'localhost',
        path: '/',
      });
    }

    // ── Desktop screens (1440x900) ──
    await captureScreen(cdp, '/dashboard', 'prod_dashboard_desktop.png', 1440, 900);
    await captureScreen(cdp, '/transactions', 'prod_faoliyat_desktop.png', 1440, 900);
    await captureScreen(cdp, '/analytics', 'prod_tahlil_desktop.png', 1440, 900);
    await captureScreen(cdp, '/advisor', 'prod_ai_desktop.png', 1440, 900);

    // ── Mobile screens (390x844) ──
    await captureScreen(cdp, '/dashboard', 'prod_dashboard_mobile.png', 390, 844);
    await captureScreen(cdp, '/transactions', 'prod_faoliyat_mobile.png', 390, 844);
    await captureScreen(cdp, '/analytics', 'prod_tahlil_mobile.png', 390, 844);
    await captureScreen(cdp, '/advisor', 'prod_ai_mobile.png', 390, 844);

    cdp.close();
    console.log('All production screenshots successfully captured!');
  } finally {
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('Error in capture script:', err);
  process.exit(1);
});
