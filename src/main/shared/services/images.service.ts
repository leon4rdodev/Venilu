import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Product image storage.
 *
 * Images are NEVER stored in the database — the DB keeps only a file name
 * (e.g. "prod_ab12cd34ef.webp"). Files live in userData/product-images and are
 * served to the renderer through the custom `venilu://product-images/<file>`
 * protocol, straight from disk (no IPC, no SQLite involved).
 *
 * The renderer converts/compresses images to WebP before uploading, so main
 * only has to validate and persist them.
 */

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024; // 1.5 MB hard cap (post-compression)
const FILE_PATTERN = /^prod_[a-f0-9]{16}\.(webp|png|jpe?g|gif)$/;

export class ImagesService {
    getImagesDir(): string {
        const dir = path.join(app.getPath('userData'), 'product-images');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        return dir;
    }

    /** True when the stored value is a managed image file name (not a legacy data URL). */
    isManagedFileName(value: unknown): value is string {
        return typeof value === 'string' && FILE_PATTERN.test(value);
    }

    /**
     * Persists a data-URL image (sent by the renderer, already WebP-compressed)
     * and returns the generated file name. Validates format, size and magic bytes.
     */
    saveFromDataUrl(dataUrl: string): string {
        const match = /^data:image\/(webp|png|jpeg|gif);base64,(.+)$/.exec(dataUrl);
        if (!match) throw new Error('Formato de imagen no soportado.');

        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const buffer = Buffer.from(match[2], 'base64');
        if (buffer.length === 0) throw new Error('Imagen vacía.');
        if (buffer.length > MAX_IMAGE_BYTES) {
            throw new Error('La imagen es demasiado grande (máx. 1.5 MB).');
        }

        // Magic-byte validation — the declared MIME must match the real content
        if (!this.hasValidMagicBytes(buffer, ext)) {
            throw new Error('El archivo no es una imagen válida.');
        }

        const fileName = `prod_${crypto.randomBytes(8).toString('hex')}.${ext}`;
        fs.writeFileSync(path.join(this.getImagesDir(), fileName), buffer);
        return fileName;
    }

    /** Deletes a managed image file. Silently ignores unknown/legacy values. */
    deleteImage(fileName: unknown): void {
        if (!this.isManagedFileName(fileName)) return;
        const filePath = path.join(this.getImagesDir(), path.basename(fileName));
        try {
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch (err) {
            console.error('[ImagesService] Error deleting image:', err);
        }
    }

    /** Resolves a managed file name to its absolute path, or null if invalid/missing. */
    resolveImagePath(fileName: string): string | null {
        const name = path.basename(fileName);
        if (!FILE_PATTERN.test(name)) return null;
        const filePath = path.join(this.getImagesDir(), name);
        return fs.existsSync(filePath) ? filePath : null;
    }

    private hasValidMagicBytes(buffer: Buffer, ext: string): boolean {
        if (buffer.length < 12) return false;
        switch (ext) {
            case 'webp':
                return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
            case 'png':
                return buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG';
            case 'jpg':
                return buffer[0] === 0xff && buffer[1] === 0xd8;
            case 'gif':
                return buffer.toString('ascii', 0, 3) === 'GIF';
            default:
                return false;
        }
    }
}

export const imagesService = new ImagesService();

/**
 * One-time migration: moves legacy base64 images out of the products table
 * into files on disk. Runs at boot; idempotent (only touches rows whose
 * `image` column still holds a data URL).
 */
export async function migrateLegacyProductImages(): Promise<void> {
    try {
        const { AppDataSource } = await import('@main/config/data-source');
        const rows: Array<{ id: string; image: string }> = await AppDataSource.query(
            `SELECT id, image FROM products WHERE image LIKE 'data:image/%' LIMIT 500`
        );
        if (rows.length === 0) return;

        let migrated = 0;
        for (const row of rows) {
            try {
                const fileName = imagesService.saveFromDataUrl(row.image);
                await AppDataSource.query(`UPDATE products SET image = ? WHERE id = ?`, [fileName, row.id]);
                migrated++;
            } catch {
                // Unparseable/oversized legacy blob — drop it rather than keep bloating the DB
                await AppDataSource.query(`UPDATE products SET image = NULL WHERE id = ?`, [row.id]);
            }
        }
        console.log(`[ImagesService] Migrated ${migrated}/${rows.length} legacy product image(s) to disk.`);
    } catch (err) {
        console.error('[ImagesService] Legacy image migration failed:', err);
    }
}
