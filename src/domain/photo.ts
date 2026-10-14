export const MAX_PHOTO_BYTES = 512 * 1024;
export const MAX_PHOTO_DATA_LENGTH = Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 64;
/** Only embedded raster images; never remote URLs, SVG or executable content. */
export function validatePhoto(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.length > MAX_PHOTO_DATA_LENGTH) throw new Error('This photo is too large. Choose a smaller photo.');
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new Error('Choose a supported photo from your gallery or camera.');
  let bytes: string;
  try { bytes = atob(match[2]); } catch { throw new Error('This photo could not be read. Choose another photo.'); }
  const signature = match[1] === 'jpeg' ? bytes.startsWith('\xff\xd8\xff')
    : match[1] === 'png' ? bytes.startsWith('\x89PNG\r\n\x1a\n')
      : bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP';
  if (!signature || bytes.length > MAX_PHOTO_BYTES) throw new Error('This photo could not be read. Choose another photo.');
  return value;
}
