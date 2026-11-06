import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourcePath = path.join(root, 'public/uzhamyon-bot-avatar.png');

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
  console.log('🎨 UzHamyon yangi rasmiy logolari va faviconlarni yaratish boshlandi...\n');

  // 1. Create Transparent Cutout of the Emblem
  const { data: rawData, info: rawInfo } = await sharp(sourcePath).raw().toBuffer({ resolveWithObject: true });
  const w = rawInfo.width, h = rawInfo.height;
  const transparentBuffer = Buffer.alloc(w * h * 4);

  for (let i = 0; i < w * h; i++) {
    const r = rawData[i * 3];
    const g = rawData[i * 3 + 1];
    const b = rawData[i * 3 + 2];
    const brightness = (r + g + b) / 3;

    let alpha = 0;
    if (brightness < 35) {
      alpha = 0;
    } else if (brightness > 65) {
      alpha = 255;
    } else {
      alpha = Math.round(((brightness - 35) / 30) * 255);
    }

    transparentBuffer[i * 4] = r;
    transparentBuffer[i * 4 + 1] = g;
    transparentBuffer[i * 4 + 2] = b;
    transparentBuffer[i * 4 + 3] = alpha;
  }

  const transparentEmblemTrimmed = await sharp(transparentBuffer, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .trim()
    .toBuffer();

  // Master Transparent 512x512 (with 8% padding for aesthetic balance)
  const masterInnerSize = Math.round(512 * 0.84);
  const masterTransparent512 = await sharp(transparentEmblemTrimmed)
    .resize(masterInnerSize, masterInnerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/uzhamyon-icon-transparent.png'), masterTransparent512);
  fs.writeFileSync(path.join(root, 'public/uzhamyon-logo-transparent.png'), masterTransparent512);
  console.log('✓ Yaratildi: public/uzhamyon-icon-transparent.png va uzhamyon-logo-transparent.png (512x512 shaffof)');

  // 2. Create Circular Badge Master Icon (512x512) for browser tab / PWA
  const circleSvg = `<svg width="512" height="512">
    <circle cx="256" cy="256" r="254" fill="white" />
  </svg>`;

  const circularMaster512 = await sharp(sourcePath)
    .resize(512, 512, { fit: 'cover' })
    .composite([
      {
        input: Buffer.from(circleSvg),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/uzhamyon-icon.png'), circularMaster512);
  fs.writeFileSync(path.join(root, 'public/uzhamyon-logo.png'), circularMaster512);
  fs.writeFileSync(path.join(root, 'public/icon.png'), circularMaster512);
  fs.writeFileSync(path.join(root, 'src/app/icon.png'), circularMaster512);
  console.log('✓ Yaratildi: public/icon.png va src/app/icon.png (512x512 circular emblem)');

  // 3. Apple Touch Icon (180x180)
  const appleIcon = await sharp(circularMaster512)
    .resize(180, 180, { fit: 'contain' })
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'public/apple-icon.png'), appleIcon);
  fs.writeFileSync(path.join(root, 'src/app/apple-icon.png'), appleIcon);
  console.log('✓ Yaratildi: public/apple-icon.png va src/app/apple-icon.png (180x180)');

  // 4. Multi-size Favicon ICO (48x48, 32x32, 16x16)
  const icoSizes = [48, 32, 16];
  const dibImages = [];

  for (const s of icoSizes) {
    const sCircleSvg = `<svg width="${s}" height="${s}">
      <circle cx="${s/2}" cy="${s/2}" r="${s/2 - 0.5}" fill="white" />
    </svg>`;

    const sResized = await sharp(sourcePath)
      .resize(s, s, { fit: 'cover' })
      .composite([
        {
          input: Buffer.from(sCircleSvg),
          blend: 'dest-in',
        },
      ])
      .raw()
      .toBuffer({ resolveWithObject: true });

    dibImages.push({ width: s, height: s, rawBuffer: sResized.data });
  }

  const icoBuffer = createDibIco(dibImages);
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(root, 'src/app/favicon.ico'), icoBuffer);
  console.log('✓ Yaratildi: public/favicon.ico va src/app/favicon.ico (Multi-size DIB ICO 48x48, 32x32, 16x16)');

  console.log('\n🎉 Barcha UzHamyon rasmiy brend va favicon fayllari muvaffaqiyatli yangilandi!');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
