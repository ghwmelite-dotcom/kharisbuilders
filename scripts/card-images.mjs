// Generate the 3 homepage intro-card images (Plan a Visit / Watch Sermons / Give)
// via Cloudflare Workers AI (Flux). Writes candidates to public/images/home/_candidates/;
// pick the best and copy to visit.webp / sermons.webp / give.webp.
//
//   CLOUDFLARE_ACCOUNT_ID=<your-account-id> node scripts/card-images.mjs
import { getPlatformProxy } from 'wrangler';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images', 'home', '_candidates');
mkdirSync(outDir, { recursive: true });

const CANDIDATES = 2; // per card
const MODEL = '@cf/black-forest-labs/flux-1-schnell';
// Card aspect is 16:10 in the UI.
const CARDS = [
  {
    slot: 'visit',
    prompt:
      'A warm, inviting modern African church entrance with open glass doors and golden morning light, a few well-dressed people arriving seen from behind being welcomed, joyful welcoming atmosphere, cinematic, shallow depth of field, no text',
  },
  {
    slot: 'sermons',
    prompt:
      'A pastor preaching on a modern church stage holding an open Bible, viewed from the congregation at mid distance, warm spotlight, a large softly-blurred screen behind, cinematic, no text',
  },
  {
    slot: 'give',
    prompt:
      'Open hands gently placing an offering into a woven collection basket during an African church service, warm golden light, shallow depth of field, a sense of generosity and gratitude, cinematic, no text',
  },
];

const proxy = await getPlatformProxy();
try {
  for (const card of CARDS) {
    for (let c = 0; c < CANDIDATES; c++) {
      const label = `${card.slot}-${String.fromCharCode(97 + c)}`;
      process.stdout.write(`Generating ${label}... `);
      const res = await proxy.env.AI.run(MODEL, { prompt: card.prompt, steps: 8 });
      const buf = Buffer.from(res.image, 'base64');
      await sharp(buf)
        .resize(1200, 750, { fit: 'cover', position: 'attention' })
        .webp({ quality: 82 })
        .toFile(join(outDir, `${label}.webp`));
      console.log('ok');
    }
  }
} finally {
  await proxy.dispose();
}
console.log('\nDone. Review public/images/home/_candidates/, then copy picks to');
console.log('public/images/home/visit.webp, sermons.webp, give.webp');
