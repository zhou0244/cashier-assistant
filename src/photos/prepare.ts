import { validatePhoto, MAX_PHOTO_DATA_LENGTH } from '../domain/photo';
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export function photoDimensions(width: number, height: number, longest = 1600): [number, number] {
  if (!width || !height || !Number.isFinite(width + height)) throw new Error('This photo could not be read.');
  const scale = Math.min(1, longest / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}
export async function preparePhoto(file: File): Promise<string> {
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw new Error('Choose a photo smaller than 20 MB.');
  if (file.type && (!file.type.startsWith('image/') || file.type === 'image/svg+xml')) throw new Error('Choose a photo, such as a JPG or PNG image.');
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This photo could not be opened. Try another photo.'));
    reader.readAsDataURL(file);
  });
  const picture = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This photo format is not supported here. Try a JPG, PNG or a new camera photo.'));
    image.src = source;
  });
  const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the photo. Try again.');
  // Re-encoding bounds memory/storage use and omits the original file metadata.
  for (const longest of [1600, 1200, 900, 600]) {
    [canvas.width, canvas.height] = photoDimensions(picture.naturalWidth, picture.naturalHeight, longest);
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(picture, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.8);
    if (data.length <= MAX_PHOTO_DATA_LENGTH) return validatePhoto(data)!;
  }
  throw new Error('This photo is too detailed to save. Try a smaller photo.');
}
