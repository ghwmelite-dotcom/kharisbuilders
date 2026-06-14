// Generate web logo + favicon assets from the brand source mark.
// The source art is a colourful swirl on a SOLID WHITE background (no alpha),
// so we knock the white out to transparent (with a soft edge ramp) and emit the
// sizes the site needs. Re-run any time the source art changes:
//   node scripts/brand-assets.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'brand', 'mark-source.png');
const out = (...p) => join(root, 'public', ...p);

// Per-pixel knockout: near-white -> transparent, with a 30-wide ramp for clean edges.
async function knockoutWhite(srcPath) {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  for (let i = 0; i < data.length; i += ch) {
    const minc = Math.min(data[i], data[i + 1], data[i + 2]);
    data[i + 3] = minc >= 245 ? 0 : minc <= 215 ? 255 : Math.round((255 * (245 - minc)) / 30);
  }
  // re-encode, then trim the now-transparent border to a tight crop
  const png = await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toBuffer();
  return await sharp(png).trim().png().toBuffer();
}

const square = (buf, size, bg) =>
  sharp(buf).resize(size, size, { fit: 'contain', background: bg ?? { r: 0, g: 0, b: 0, alpha: 0 } });

// Assemble a multi-size .ico that embeds PNG images (supported by all modern browsers).
function pngsToIco(images /* [{size, png:Buffer}] */) {
  const count = images.length;
  const header = Buffer.alloc(6 + count * 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);
  let offset = header.length;
  for (let i = 0; i < count; i++) {
    const { size, png } = images[i];
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e); // width (0 => 256)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1); // height
    header.writeUInt8(0, e + 2); // palette
    header.writeUInt8(0, e + 3); // reserved
    header.writeUInt16LE(1, e + 4); // planes
    header.writeUInt16LE(32, e + 6); // bpp
    header.writeUInt32LE(png.length, e + 8); // size of image data
    header.writeUInt32LE(offset, e + 12); // offset
    offset += png.length;
  }
  return Buffer.concat([header, ...images.map((x) => x.png)]);
}

const mark = await knockoutWhite(SRC);

await Promise.all([
  // Header / footer logo mark (rendered at 40px, so 240 covers retina) — transparent
  square(mark, 240).png().toFile(out('images', 'logo.png')),
  // Favicons — transparent, square
  square(mark, 512).png().toFile(out('favicon-512.png')),
  square(mark, 192).png().toFile(out('favicon-192.png')),
  square(mark, 32).png().toFile(out('favicon-32.png')),
  square(mark, 16).png().toFile(out('favicon-16.png')),
  // Apple touch icon needs an opaque background (iOS ignores alpha) — white matches the brand art
  square(mark, 180, { r: 255, g: 255, b: 255, alpha: 1 }).flatten({ background: '#ffffff' }).png().toFile(out('apple-touch-icon.png')),
]);

// Multi-size favicon.ico (16/32/48) for the universal /favicon.ico fallback
const ico = pngsToIco(
  await Promise.all([16, 32, 48].map(async (size) => ({ size, png: await square(mark, size).png().toBuffer() }))),
);
const { writeFileSync } = await import('node:fs');
writeFileSync(out('favicon.ico'), ico);

console.log('Wrote: public/images/logo.png, favicon-{512,192,32,16}.png, apple-touch-icon.png, favicon.ico');
