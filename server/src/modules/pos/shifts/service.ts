import { IShiftsRepository, shiftsRepository as defaultRepo } from './repository';
import { ShiftRow, ClockInDTO, ClockOutDTO, ShiftFilters, ShiftListResult } from './types';

export interface IShiftsService {
  getCurrentShift(userId: number): Promise<ShiftRow | null>;
  clockIn(userId: number, data: ClockInDTO): Promise<ShiftRow>;
  clockOut(userId: number, data: ClockOutDTO): Promise<ShiftRow>;
  startBreak(userId: number): Promise<ShiftRow>;
  endBreak(userId: number): Promise<ShiftRow>;
  listShifts(
    userRole: string,
    currentUserId: number,
    filters: ShiftFilters
  ): Promise<ShiftListResult>;
}

export class ShiftsService implements IShiftsService {
  constructor(private repo: IShiftsRepository = defaultRepo) {}

  getRepository(): IShiftsRepository {
    return this.repo;
  }

  async getCurrentShift(userId: number): Promise<ShiftRow | null> {
    return this.repo.getCurrentShift(userId);
  }

  async clockIn(userId: number, data: ClockInDTO): Promise<ShiftRow> {
    const active = await this.repo.findActiveShift(userId);
    if (active) {
      throw new Error('Already clocked in');
    }

    return this.repo.clockIn(userId, data.branch_id, data.notes);
  }

  async clockOut(userId: number, data: ClockOutDTO): Promise<ShiftRow> {
    const shift = await this.repo.findActiveShift(userId);
    if (!shift) {
      throw new Error('No active shift found');
    }

    // End active break if any
    if (shift.status === 'on_break' && shift.break_start) {
      await this.repo.endBreak(shift.id);
    }

    return this.repo.clockOut(shift.id, data.notes);
  }

  async startBreak(userId: number): Promise<ShiftRow> {
    const shift = await this.repo.findActiveShift(userId);
    if (!shift || shift.status !== 'active') {
      throw new Error('No active shift to start break');
    }

    return this.repo.startBreak(shift.id);
  }

  async endBreak(userId: number): Promise<ShiftRow> {
    const shift = await this.repo.findActiveShift(userId);
    if (!shift || shift.status !== 'on_break') {
      throw new Error('Not currently on break');
    }

    return this.repo.endBreak(shift.id);
  }

  async listShifts(
    userRole: string,
    currentUserId: number,
    filters: ShiftFilters
  ): Promise<ShiftListResult> {
    const { user_id, from, to, page = '1', limit = '20' } = filters;
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const targetUserId =
      userRole === 'Admin' ? (user_id ? Number(user_id) : undefined) : currentUserId;

    const result = await this.repo.listShifts({
      targetUserId,
      from,
      to,
      limit: limitNum,
      offset,
    });

    return {
      rows: result.rows,
      meta: {
        total: result.total,
        page: pageNum,
        limit: limitNum,
      },
    };
  }
}

export const shiftsService = new ShiftsService();
