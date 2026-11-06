import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourcePath = path.join(root, 'public/uzhamyon-brand-source.jpg');

if (!fs.existsSync(sourcePath)) {
  console.error('Source logo not found:', sourcePath);
  process.exit(1);
}

// 32-bit DIB ICO builder for maximum browser & OS compatibility
function createDibIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(images.length, 4);

  const dibs = [];
  for (const img of images) {
    const { width: w, height: h, rawBuffer } = img;
    const bih = Buffer.alloc(40);
    bih.writeUInt32LE(40, 0); // biSize
    bih.writeInt32LE(w, 4);   // biWidth
    bih.writeInt32LE(h * 2, 8); // biHeight * 2 (XOR mask + AND mask)
    bih.writeUInt16LE(1, 12);  // biPlanes
    bih.writeUInt16LE(32, 14); // biBitCount (32-bit RGBA)
    bih.writeUInt32LE(0, 16);  // biCompression = BI_RGB
    bih.writeUInt32LE(w * h * 4, 20); // biSizeImage

    // XOR mask: bottom to top, BGRA order
    const xorMask = Buffer.alloc(w * h * 4);
    const andRowBytes = Math.ceil(w / 32) * 4;
    const andMask = Buffer.alloc(andRowBytes * h);

    for (let y = 0; y < h; y++) {
      const srcY = h - 1 - y; // flip vertically
      for (let x = 0; x < w; x++) {
        const srcIdx = (srcY * w + x) * 4;
        const dstIdx = (y * w + x) * 4;
        const r = rawBuffer[srcIdx];
        const g = rawBuffer[srcIdx + 1];
        const b = rawBuffer[srcIdx + 2];
        const a = rawBuffer[srcIdx + 3];

        xorMask[dstIdx] = b;
        xorMask[dstIdx + 1] = g;
        xorMask[dstIdx + 2] = r;
        xorMask[dstIdx + 3] = a;

        if (a < 128) {
          const byteIdx = y * andRowBytes + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          andMask[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    const dib = Buffer.concat([bih, xorMask, andMask]);
    dibs.push(dib);
  }

  let offset = 6 + images.length * 16;
  const entries = [];
  for (let i = 0; i < images.length; i++) {
    const { width: w, height: h } = images[i];
    const dib = dibs[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(w === 256 ? 0 : w, 0);
    entry.writeUInt8(h === 256 ? 0 : h, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(dib.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += dib.length;
  }

  return Buffer.concat([header, ...entries, ...dibs]);
}

async function main() {
  console.log('🎨 UzHamyon rasmiy yangi yashil logotipi va barcha brend aktivlarini yaratish boshlandi...\n');

  // 1. High-precision De-fringed Transparent Cutout of the Green "U" Emblem
  const { data: rawData, info: rawInfo } = await sharp(sourcePath).raw().toBuffer({ resolveWithObject: true });
  const w = rawInfo.width, h = rawInfo.height;
  const transparentBuffer = Buffer.alloc(w * h * 4);
  const whiteThreshold = 251;

  for (let i = 0; i < w * h; i++) {
    const r = rawData[i * 3];
    const g = rawData[i * 3 + 1];
    const b = rawData[i * 3 + 2];

    if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
      transparentBuffer[i * 4] = 0;
      transparentBuffer[i * 4 + 1] = 0;
      transparentBuffer[i * 4 + 2] = 0;
      transparentBuffer[i * 4 + 3] = 0;
      continue;
    }

    // Measure color distance from white
    const diffR = 255 - r;
    const diffG = 255 - g;
    const diffB = 255 - b;
    const maxDiff = Math.max(diffR, diffG, diffB);

    let alpha = 1.0;
    if (maxDiff < 32) {
      alpha = Math.min(1.0, maxDiff / 32);
    }

    // Mathematical de-fringing to eliminate any edge white halo:
    // observed = alpha * fg + (1 - alpha) * 255
    // => fg = (observed - (1 - alpha) * 255) / alpha
    let fgR = r;
    let fgG = g;
    let fgB = b;
    if (alpha > 0.05 && alpha < 0.99) {
      fgR = Math.max(0, Math.min(255, Math.round((r - (1 - alpha) * 255) / alpha)));
      fgG = Math.max(0, Math.min(255, Math.round((g - (1 - alpha) * 255) / alpha)));
      fgB = Math.max(0, Math.min(255, Math.round((b - (1 - alpha) * 255) / alpha)));
    }

    transparentBuffer[i * 4] = fgR;
    transparentBuffer[i * 4 + 1] = fgG;
    transparentBuffer[i * 4 + 2] = fgB;
    transparentBuffer[i * 4 + 3] = Math.round(alpha * 255);
  }

  const transparentEmblemTrimmed = await sharp(transparentBuffer, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .trim()
    .toBuffer();

  // Master Transparent 512x512 with balanced padding (86% scale)
  const masterInnerSize = Math.round(512 * 0.86);
  const masterTransparent512 = await sharp(transparentEmblemTrimmed)
    .resize(masterInnerSize, masterInnerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/uzhamyon-icon-transparent.png'), masterTransparent512);
  fs.writeFileSync(path.join(root, 'public/uzhamyon-logo-transparent.png'), masterTransparent512);
  console.log('✓ Yaratildi: public/uzhamyon-icon-transparent.png va uzhamyon-logo-transparent.png (512x512 shaffof)');

  // 2. Master App Icon (512x512) for browser tab & PWA
  // Transparent crisp emblem directly for modern browsers
  fs.writeFileSync(path.join(root, 'public/icon.png'), masterTransparent512);
  fs.writeFileSync(path.join(root, 'src/app/icon.png'), masterTransparent512);
  console.log('✓ Yaratildi: public/icon.png va src/app/icon.png (512x512 master icon)');

  // 3. Brand Icon & Logo with crisp white background (512x512)
  const masterSolid512 = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: masterTransparent512, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/uzhamyon-icon.png'), masterSolid512);
  fs.writeFileSync(path.join(root, 'public/uzhamyon-logo.png'), masterSolid512);
  console.log('✓ Yaratildi: public/uzhamyon-icon.png va uzhamyon-logo.png (512x512 solid)');

  // 4. Apple Touch Icon (180x180) - Requires opaque background per Apple HIG
  const appleInner = Math.round(180 * 0.84);
  const appleEmblem = await sharp(transparentEmblemTrimmed)
    .resize(appleInner, appleInner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const appleIcon = await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: appleEmblem, gravity: 'center' }])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/apple-icon.png'), appleIcon);
  fs.writeFileSync(path.join(root, 'src/app/apple-icon.png'), appleIcon);
  console.log('✓ Yaratildi: public/apple-icon.png va src/app/apple-icon.png (180x180 Apple)');

  // 5. Multi-size Favicon ICO (48x48, 32x32, 16x16)
  const icoSizes = [48, 32, 16];
  const dibImages = [];

  for (const s of icoSizes) {
    const inner = Math.max(12, Math.round(s * 0.92));
    const resized = await sharp(transparentEmblemTrimmed)
      .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .raw()
      .toBuffer({ resolveWithObject: true });

    dibImages.push({ width: s, height: s, rawBuffer: resized.data });
  }

  const icoBuffer = createDibIco(dibImages);
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(root, 'src/app/favicon.ico'), icoBuffer);
  console.log('✓ Yaratildi: public/favicon.ico va src/app/favicon.ico (Multi-size DIB ICO 48x48, 32x32, 16x16)');

  // 6. BotFather Mini App Preview (640x360)
  const previewEmblemSize = 180;
  const previewEmblem = await sharp(transparentEmblemTrimmed)
    .resize(previewEmblemSize, previewEmblemSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // Create an elegant dark/emerald gradient card for BotFather preview
  const svgCard = `
    <svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0E1E08" />
          <stop offset="100%" stop-color="#163300" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="38%" r="45%">
          <stop offset="0%" stop-color="#9FE870" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#9FE870" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill="url(#bg)" />
      <rect width="640" height="360" fill="url(#glow)" />
      
      <!-- Brand Name -->
      <text x="320" y="270" font-family="system-ui, -apple-system, Inter, sans-serif" font-size="34" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="-0.5">UzHamyon</text>
      <!-- Subtitle -->
      <text x="320" y="304" font-family="system-ui, -apple-system, Inter, sans-serif" font-size="15" font-weight="500" fill="#9FE870" text-anchor="middle">Aqlli shaxsiy moliya va Telegram Mini App</text>
    </svg>
  `;

  const telegramPreview = await sharp(Buffer.from(svgCard))
    .composite([
      {
        input: previewEmblem,
        top: 42,
        left: Math.round((640 - previewEmblemSize) / 2),
      },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/telegram-app-preview.png'), telegramPreview);
  console.log('✓ Yaratildi: public/telegram-app-preview.png (640x360 BotFather preview)');

  console.log('\n🎉 Barcha UzHamyon yangi yashil logotiplari muvaffaqiyatli yangilandi!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
