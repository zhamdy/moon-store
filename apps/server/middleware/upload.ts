import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { errorResponse } from '../src/http/errors';
import { rateLimitKey } from '../src/http/rateLimits';

function validateMagicBytes(buffer: Buffer): string | null {
  // JPEG: starts with FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: starts with 89 50 4E 47
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  // WebP: RIFF at offset 0, WEBP at offset 8
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

interface UploadOptions {
  maxSize?: number; // bytes, default 2MB
  allowedTypes?: string[]; // MIME types, default JPEG/PNG/WebP
  destination?: string; // relative to server/, default 'uploads/products'
}

export function createUpload(options: UploadOptions = {}) {
  const {
    maxSize = 2 * 1024 * 1024,
    allowedTypes = ['image/jpeg', 'image/png', 'image/webp'],
    destination = 'uploads/products',
  } = options;

  const extMap: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/webp': ['.webp'],
  };

  const allowedExts = allowedTypes.flatMap((t) => extMap[t] || []);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      const dir = path.join(__dirname, '..', destination);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxSize },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
      }
    },
  });

  return upload;
}

// Middleware: validate uploaded file's magic bytes match its extension
export function validateMagic(req: Request, res: Response, next: NextFunction): void {
  if (!req.file) {
    next();
    return;
  }

  const filePath = req.file.path;
  try {
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    fs.closeSync(fd);

    const detectedType = validateMagicBytes(header);
    if (!detectedType) {
      fs.unlinkSync(filePath);
      res
        .status(400)
        .json(
          errorResponse('VALIDATION_ERROR', 'File content does not match a supported image format')
        );
      return;
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
    };

    if (extToMime[ext] && extToMime[ext] !== detectedType) {
      fs.unlinkSync(filePath);
      res
        .status(400)
        .json(
          errorResponse(
            'VALIDATION_ERROR',
            `File extension (${ext}) does not match actual content (${detectedType})`
          )
        );
      return;
    }

    next();
  } catch {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json(errorResponse('INTERNAL_ERROR'));
  }
}

/**
 * Upload budget, keyed on the **authenticated user** like the global limiter.
 *
 * It predated that decision and kept express-rate-limit's default IP key, which made it
 * a per-shop budget: several admins behind one shop router shared it, and proven live,
 * the same token kept uploading against 127.0.0.1 after ::1 was exhausted (MED-10 in
 * `docs/audits/2026-09-22-shop-cart-fullstack-audit.md`). The reasoning is the one in
 * `apps/server/CLAUDE.md` -> *Rate-limit bucketing*; this limiter simply never received it.
 *
 * The ceiling was 10 against a product that holds 1 primary + 8 gallery images, and
 * *rejected* attempts spend the budget too — so two mistyped files, or two phone photos
 * over the size limit, locked an operator out mid-product for 15 minutes. A limit should
 * bound abuse, not ordinary authoring of one product, so it is now comfortably above a
 * full gallery while still far below anything a person does by hand.
 */
export const UPLOAD_RATE_LIMIT_MAX = 60;
const UPLOAD_RATE_WINDOW_MINUTES = 15;

export const uploadRateLimit = rateLimit({
  windowMs: UPLOAD_RATE_WINDOW_MINUTES * 60 * 1000,
  max: UPLOAD_RATE_LIMIT_MAX,
  keyGenerator: rateLimitKey,
  message: errorResponse(
    'RATE_LIMITED',
    `Too many uploads. Please try again in ${UPLOAD_RATE_WINDOW_MINUTES} minutes.`
  ),
  standardHeaders: true,
  legacyHeaders: false,
});

// Cleanup orphaned files in uploads directory that don't match any DB record
export async function cleanupOrphanedFiles(
  uploadsDir: string,
  getActiveFiles: () => string[]
): Promise<{ removed: string[]; errors: string[] }> {
  const removed: string[] = [];
  const errors: string[] = [];

  const dir = path.join(__dirname, '..', uploadsDir);
  if (!fs.existsSync(dir)) return { removed, errors };

  const activeFiles = new Set(getActiveFiles().map((f) => path.basename(f)));
  const diskFiles = fs.readdirSync(dir);

  for (const file of diskFiles) {
    if (!activeFiles.has(file)) {
      try {
        fs.unlinkSync(path.join(dir, file));
        removed.push(file);
      } catch (err) {
        errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return { removed, errors };
}
