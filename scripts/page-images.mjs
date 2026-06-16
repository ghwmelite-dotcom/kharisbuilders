// Generate cinematic Ghanaian-worship hero images for the section pages + the
// blog welcome cover, via Cloudflare Workers AI (Flux) — same pipeline/style as
// scripts/hero-images.mjs. Writes N candidates per slot to
// public/images/pages/_candidates/ for review; pick the best and copy to the
// final <slot>.webp.
//
//   CLOUDFLARE_ACCOUNT_ID=<account-id> node scripts/page-images.mjs
import { getPlatformProxy } from 'wrangler';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'images', 'pages', '_candidates');
mkdirSync(outDir, { recursive: true });

const CANDIDATES = 2;
const MODEL = '@cf/black-forest-labs/flux-1-schnell';

const SLOTS = [
  {
    slot: 'sermons',
    prompt:
      'A wide cinematic photograph of a Ghanaian pastor preaching on a modern church stage holding an open Bible, viewed from the congregation, warm spotlight, softly blurred worship screens behind, reverent and inspiring, shallow depth of field, no text',
  },
  {
    slot: 'events',
    prompt:
      'A wide cinematic photograph of a joyful Ghanaian church community gathering, well-dressed people of all ages fellowshipping and smiling together after service, warm golden afternoon light, vibrant celebratory atmosphere, shallow depth of field, no text',
  },
  {
    slot: 'ministries',
    prompt:
      'A wide cinematic photograph of a small group of Ghanaian church members sitting in a circle in warm conversation and prayer with open Bibles, modern church room, soft natural light, authentic community and connection, shallow depth of field, no text',
  },
  {
    slot: 'giving',
    prompt:
      'A wide cinematic photograph of open hands gently placing an offering into a woven collection basket during a Ghanaian church service, warm golden light, a sense of generosity and gratitude, shallow depth of field, no text',
  },
  {
    slot: 'about',
    prompt:
      'A wide cinematic photograph of a warm diverse Ghanaian church congregation standing together in a bright modern sanctuary, a sense of family and belonging, golden sunlight through tall windows, shallow depth of field, no text',
  },
  {
    slot: 'visit',
    prompt:
      'A wide cinematic photograph of a warm inviting modern African church entrance with open glass doors and golden morning light, well-dressed people arriving and being welcomed, joyful welcoming atmosphere, shallow depth of field, no text',
  },
  {
    slot: 'live',
    prompt:
      'A wide cinematic photograph of a Ghanaian congregation worshipping with hands raised in a modern sanctuary, stage lights and large worship screens, a video camera softly in the foreground suggesting a live broadcast, energetic and uplifting, no text',
  },
  {
    slot: 'blog',
    prompt:
      'A wide cinematic still life of an open Bible beside a journal and a cup of coffee on a wooden table by a sunlit window, warm peaceful morning light, contemplative and inviting, shallow depth of field, no text',
  },
  {
    slot: 'welcome-cover',
    prompt:
      'A wide warm cinematic photograph of welcoming open church doors with golden light spilling out while a Ghanaian congregation warmly greets a newcomer with smiles and open arms, a sense of grace and belonging, shallow depth of field, no text',
  },
];

const proxy = await getPlatformProxy();
try {
  for (const s of SLOTS) {
    for (let c = 0; c < CANDIDATES; c++) {
      const label = `${s.slot}-${String.fromCharCode(97 + c)}`;
      process.stdout.write(`Generating ${label}... `);
      try {
        const res = await proxy.env.AI.run(MODEL, { prompt: s.prompt, steps: 8 });
        const buf = Buffer.from(res.image, 'base64');
        await sharp(buf)
          .resize(1920, 1080, { fit: 'cover', position: 'attention' })
          .webp({ quality: 80 })
          .toFile(join(outDir, `${label}.webp`));
        console.log('ok');
      } catch (e) {
        console.log('FAILED: ' + (e?.message ?? e));
      }
    }
  }
} finally {
  await proxy.dispose();
}
console.log('\nDone. Review public/images/pages/_candidates/, then copy picks to public/images/pages/<slot>.webp');
