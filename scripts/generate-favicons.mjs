import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');

const SOURCE = process.argv[2] || join(ROOT, 'logo-source.png');

const SIZES = [
  { name: 'favicon-16x16.png', size: 16 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

async function generateFavicons() {
  if (!existsSync(SOURCE)) {
    console.error(`Source image not found: ${SOURCE}`);
    console.error('Please save the logo as "logo-source.png" in the project root.');
    process.exit(1);
  }

  console.log('Generating favicons from:', SOURCE);

  // Generate PNG favicons
  for (const { name, size } of SIZES) {
    const output = join(PUBLIC, name);
    await sharp(SOURCE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      })
      .png()
      .toFile(output);
    console.log(`  Created: ${name} (${size}x${size})`);
  }

  // Generate favicon.ico (contains 16x16 and 32x32)
  const ico16 = await sharp(SOURCE)
    .resize(16, 16, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const ico32 = await sharp(SOURCE)
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toBuffer();

  const icoBuffer = await pngToIco([ico16, ico32]);
  await writeFile(join(PUBLIC, 'favicon.ico'), icoBuffer);
  console.log('  Created: favicon.ico (16x16, 32x32)');

  console.log('\nDone! Add this to your HTML <head>:');
  console.log(`
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
`);
}

generateFavicons().catch(console.error);
