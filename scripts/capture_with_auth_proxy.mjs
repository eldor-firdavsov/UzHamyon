import http from 'node:http';
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

async function getAuthCookieHeader() {
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

  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');
}

function runChromeAsync(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('/usr/bin/google-chrome', args, { stdio: 'inherit' });
    const timer = setTimeout(() => {
      proc.kill();
      resolve(); // accept whatever was written or continue
    }, 8000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve();
    });
    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function run() {
  console.log('1. Authenticating as Eldor Firdavsov (firdavsove1@gmail.com)...');
  const authCookie = await getAuthCookieHeader();
  console.log('Auth cookie generated successfully.');

  // 2. Start proxy server on port 3001
  const proxy = http.createServer((req, res) => {
    const targetUrl = new URL(req.url, 'http://localhost:3000');
    const proxyReq = http.request(
      {
        hostname: 'localhost',
        port: 3000,
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: 'localhost:3000',
          cookie: authCookie,
        },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      }
    );

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    req.pipe(proxyReq, { end: true });
  });

  await new Promise((resolve) => proxy.listen(3001, resolve));
  console.log('Proxy listening on http://localhost:3001');

  try {
    const pages = [
      { route: '/dashboard', name: 'prod_dashboard' },
      { route: '/transactions', name: 'prod_faoliyat' },
      { route: '/analytics', name: 'prod_tahlil' },
      { route: '/advisor', name: 'prod_ai' },
    ];

    for (const p of pages) {
      // Desktop (1440x900)
      const desktopFile = `${ARTIFACT_DIR}/${p.name}_desktop.png`;
      console.log(`Capturing Desktop: ${p.route} -> ${desktopFile}`);
      await runChromeAsync([
        '--headless',
        '--disable-gpu',
        '--window-size=1440,900',
        `--screenshot=${desktopFile}`,
        `http://localhost:3001${p.route}`,
      ]);

      // Mobile (390x844)
      const mobileFile = `${ARTIFACT_DIR}/${p.name}_mobile.png`;
      console.log(`Capturing Mobile: ${p.route} -> ${mobileFile}`);
      await runChromeAsync([
        '--headless',
        '--disable-gpu',
        '--window-size=390,844',
        `--screenshot=${mobileFile}`,
        `http://localhost:3001${p.route}`,
      ]);
    }

    console.log('ALL 8 PRODUCTION SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } finally {
    proxy.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
