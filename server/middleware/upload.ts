import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

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
        .json({ success: false, error: 'File content does not match a supported image format' });
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
      res.status(400).json({
        success: false,
        error: `File extension (${ext}) does not match actual content (${detectedType})`,
      });
      return;
    }

    next();
  } catch {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false, error: 'Failed to validate uploaded file' });
  }
}

// Rate limiter for upload endpoints (10 uploads per 15 minutes)
export const uploadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many uploads. Please try again later.' },
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
