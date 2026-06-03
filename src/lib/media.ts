export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
export const MAX_IMAGE_BYTES = 6_000_000; // 6 MB

/** Build the public URL for a stored R2 object key. Null-safe for optional keys. */
export function mediaUrl(key: string | null | undefined): string | null {
  return key ? `/media/${key}` : null;
}

/** Validate + store an uploaded image in R2 under `<prefix>/<rand>.<ext>`; returns the key. */
export async function uploadImage(bucket: R2Bucket, file: File, prefix: string): Promise<string> {
  const ext = ALLOWED_IMAGE_TYPES[file.type];
  if (!ext) throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large (max 6 MB).');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const key = `${prefix}/${rand}.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return key;
}
