import db from '../db';
import { Request } from 'express';
import { AuthRequest } from './auth';

interface AuditEntry {
  userId?: number;
  userName?: string;
  action: string;
  entityType: string;
  entityId?: string | number;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

export function logAudit(entry: AuditEntry): void {
  try {
    db.db
      .prepare(
        `INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.userId || null,
        entry.userName || null,
        entry.action,
        entry.entityType,
        entry.entityId != null ? String(entry.entityId) : null,
        JSON.stringify(entry.details || {}),
        entry.ipAddress || null
      );
  } catch {
    // Audit logging should never crash the app
  }
}

export function logAuditFromReq(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string | number,
  details?: Record<string, unknown>
): void {
  const authReq = req as AuthRequest;
  logAudit({
    userId: authReq.user?.id,
    userName: authReq.user?.name,
    action,
    entityType,
    entityId,
    details,
    ipAddress: req.ip || req.socket.remoteAddress,
  });
}
