import { expect, it } from 'vitest';
import { validatePhoto, MAX_PHOTO_DATA_LENGTH } from './photo';
import { photoDimensions, preparePhoto, MAX_UPLOAD_BYTES } from '../photos/prepare';
import { photoFixture } from '../testing/photo';
it('accepts embedded raster photos and rejects remote, SVG, corrupt and oversized data', () => {
  expect(validatePhoto(photoFixture)).toBe(photoFixture);
  expect(validatePhoto(undefined)).toBeUndefined();
  for (const value of ['https://example.com/photo.jpg', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJjZA==', 'data:image/jpeg;base64,!!!!!', 'x'.repeat(MAX_PHOTO_DATA_LENGTH + 1)]) expect(() => validatePhoto(value)).toThrow();
});
it('resizes without enlarging and preserves aspect ratio', () => {
  expect(photoDimensions(4000, 3000)).toEqual([1600, 1200]);
  expect(photoDimensions(3000, 4000)).toEqual([1200, 1600]);
  expect(photoDimensions(200, 100)).toEqual([200, 100]);
  expect(() => photoDimensions(0, 100)).toThrow();
});
it('refuses non-photo uploads and oversized originals before attempting image decoding', async () => {
  await expect(preparePhoto(new File(['abc'], 'text.txt', { type: 'text/plain' }))).rejects.toThrow('Choose a photo');
  const file = new File(['abc'], 'large.jpg', { type: 'image/jpeg' }); Object.defineProperty(file, 'size', { value: MAX_UPLOAD_BYTES + 1 });
  await expect(preparePhoto(file)).rejects.toThrow('20 MB');
});
