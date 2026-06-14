// Generate Ghanaian worship hero images via Cloudflare Workers AI (Flux) and
// post-process to wide WebP. Uses getPlatformProxy() so the deployed env.AI
// binding is reachable locally — no API key needed.
//
//   CLOUDFLARE_ACCOUNT_ID=<your-account-id> node scripts/hero-images.mjs
//
// Writes N candidates per slot to public/images/hero/_candidates/, so you can
// pick the best and copy it to slide-<n>.webp (see plan Task 3).
import { getPlatformProxy } from 'wrangler';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images', 'hero', '_candidates');
mkdirSync(outDir, { recursive: true });

const CANDIDATES = 3; // per slot
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
const PROMPTS = [
  'A wide cinematic photograph of a joyful African (Ghanaian) church congregation with hands raised in worship, bright modern sanctuary, warm golden sunlight streaming through tall windows, vibrant and uplifting, shallow depth of field, no text',
  'A wide cinematic photograph of a Ghanaian church worship team and choir wearing vibrant kente cloth, seen from a flattering side and back angle, warm stage lighting, rich colours, celebratory atmosphere, no text',
  'A wide cinematic photograph of Ghanaian church drummers and instrumentalists with a celebrating congregation, motion and energy, colourful traditional cloth, golden hour light, joyful, no text',
];

const proxy = await getPlatformProxy();
try {
  for (let p = 0; p < PROMPTS.length; p++) {
    for (let c = 0; c < CANDIDATES; c++) {
      const label = `slide-${p + 1}-${String.fromCharCode(97 + c)}`; // slide-1-a, -b, -c
      process.stdout.write(`Generating ${label}... `);
      const res = await proxy.env.AI.run(MODEL, { prompt: PROMPTS[p], steps: 8 });
      const buf = Buffer.from(res.image, 'base64');
      const file = join(outDir, `${label}.webp`);
      await sharp(buf)
        .resize(1920, 1080, { fit: 'cover', position: 'attention' })
        .webp({ quality: 80 })
        .toFile(file);
      console.log('ok');
    }
  }
} finally {
  await proxy.dispose();
}

console.log(`\nDone. Review candidates in public/images/hero/_candidates/, then copy your`);
console.log(`picks to public/images/hero/slide-1.webp, slide-2.webp, slide-3.webp.`);
