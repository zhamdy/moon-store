/**
 * Upload intake for driver-backed media.
 *
 * The disk-backed intake in `middleware/upload.ts` writes the file, then validates it, then
 * unlinks it if it was a lie — which only works because the destination is a local path. A
 * driver may be a remote store, where "write then maybe delete" is a network round trip and
 * a window in which a rejected file is publicly readable. So the buffer stays in memory and
 * nothing reaches the store until it has passed every check.
 *
 * The checks themselves are the ones that were already enforced and must stay enforced: a
 * size ceiling (multer's, before the buffer is complete), an extension allowlist, and magic
 * bytes that must agree with the extension. Authorization is unchanged and still lives on
 * the route.
 */
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { errorResponse } from '../http/errors';

export const DEFAULT_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

const EXTENSIONS_FOR_TYPE: Record<AllowedImageType, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

const MIME_FOR_EXTENSION: Record<string, AllowedImageType> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Content type implied by the first bytes of the file, or null if it is not an image we accept. */
export function detectImageType(buffer: Buffer): AllowedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export interface ImageUploadOptions {
  maxSize?: number;
  allowedTypes?: readonly AllowedImageType[];
}

/** Multer instance that keeps the file in memory for the driver to write. */
export function createImageUpload(options: ImageUploadOptions = {}) {
  const { maxSize = DEFAULT_MAX_UPLOAD_BYTES, allowedTypes = ALLOWED_IMAGE_TYPES } = options;
  const allowedExts = allowedTypes.flatMap((t) => EXTENSIONS_FOR_TYPE[t] ?? []);

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxSize, files: 1 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
      }
    },
  });
}

/**
 * Rejects a file whose bytes disagree with its name, and pins the *detected* type onto
 * `req.file.mimetype` so everything downstream keys off the content rather than off
 * anything the client said.
 */
export function validateImageBytes(req: Request, res: Response, next: NextFunction): void {
  const file = req.file;
  if (!file) {
    next();
    return;
  }

  if (!file.buffer || file.buffer.length === 0) {
    res.status(400).json(errorResponse('VALIDATION_ERROR', 'Uploaded file is empty'));
    return;
  }

  const detected = detectImageType(file.buffer);
  if (!detected) {
    res
      .status(400)
      .json(
        errorResponse('VALIDATION_ERROR', 'File content does not match a supported image format')
      );
    return;
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const declared = MIME_FOR_EXTENSION[ext];
  if (declared && declared !== detected) {
    res
      .status(400)
      .json(
        errorResponse(
          'VALIDATION_ERROR',
          `File extension (${ext}) does not match actual content (${detected})`
        )
      );
    return;
  }

  file.mimetype = detected;
  next();
}
