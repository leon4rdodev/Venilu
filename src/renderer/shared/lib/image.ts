/**
 * Product image helpers (renderer side).
 *
 * The renderer converts any selected image to compressed WebP BEFORE sending it
 * to the main process, using the Canvas API (Chromium encodes WebP natively —
 * no extra dependencies). Main stores it as a file on disk; the DB only keeps
 * the file name.
 */

const MAX_DIMENSION = 1000;
const DEFAULT_QUALITY = 0.82;
const FALLBACK_QUALITY = 0.6;
/** ~1MB of base64 ≈ 750KB binary; main enforces a 1.5MB hard cap. */
const MAX_DATAURL_LENGTH = 1_400_000;

/**
 * Converts/compresses an image File to a WebP data URL, resized to fit
 * MAX_DIMENSION. Throws with a user-facing message on failure.
 */
export async function fileToCompressedWebP(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo seleccionado no es una imagen');
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('La imagen es demasiado grande (máx. 15 MB)');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('No se pudo leer la imagen (formato no soportado)');
  }

  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');
    ctx.drawImage(bitmap, 0, 0, width, height);

    let dataUrl = canvas.toDataURL('image/webp', DEFAULT_QUALITY);
    if (dataUrl.length > MAX_DATAURL_LENGTH) {
      dataUrl = canvas.toDataURL('image/webp', FALLBACK_QUALITY);
    }
    if (!dataUrl.startsWith('data:image/webp')) {
      throw new Error('Este sistema no soporta compresión WebP');
    }
    if (dataUrl.length > MAX_DATAURL_LENGTH) {
      throw new Error('La imagen sigue siendo demasiado grande tras comprimirla');
    }
    return dataUrl;
  } finally {
    bitmap.close();
  }
}

/**
 * Resolves the value stored in `product.image` to a usable <img> src.
 * - managed file name → venilu:// URL (served from disk by the main process)
 * - legacy base64 data URL → passthrough
 * - empty → undefined
 */
export function productImageSrc(image?: string | null): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('data:')) return image;
  return `venilu://product-images/${encodeURIComponent(image)}`;
}
