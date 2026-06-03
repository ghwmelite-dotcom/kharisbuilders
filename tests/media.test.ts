import { Miniflare } from 'miniflare';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { mediaUrl, uploadImage } from '../src/lib/media';

let mf: Miniflare;
let bucket: R2Bucket;
beforeAll(async () => {
  mf = new Miniflare({ modules: true, script: 'export default {};', r2Buckets: { MEDIA: 'media' } });
  bucket = (await mf.getR2Bucket('MEDIA')) as unknown as R2Bucket;
});
afterAll(async () => {
  await mf.dispose();
});

function file(type: string, bytes = 10, name = 'p.jpg') {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe('mediaUrl', () => {
  it('builds a /media/ path and is null-safe', () => {
    expect(mediaUrl('sermons/abc.jpg')).toBe('/media/sermons/abc.jpg');
    expect(mediaUrl(null)).toBeNull();
    expect(mediaUrl('')).toBeNull();
  });
});

describe('uploadImage', () => {
  it('stores a valid image and returns a prefixed key', async () => {
    const key = await uploadImage(bucket, file('image/jpeg'), 'sermons');
    expect(key).toMatch(/^sermons\/[a-z0-9]+\.jpg$/);
    const obj = await bucket.get(key);
    expect(obj).not.toBeNull();
  });
  it('rejects non-image types', async () => {
    await expect(uploadImage(bucket, file('application/pdf', 10, 'x.pdf'), 'events')).rejects.toThrow(/type/i);
  });
  it('rejects oversized files', async () => {
    await expect(uploadImage(bucket, file('image/png', 6_000_001, 'big.png'), 'events')).rejects.toThrow(/large/i);
  });
});
