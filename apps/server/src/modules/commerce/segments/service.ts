import { ISegmentsRepository, segmentsRepository as defaultRepo } from './repository';
import { CreateSegmentDTO, SegmentRecord, UpdateSegmentDTO } from './types';

export class SegmentsService {
  constructor(private repo: ISegmentsRepository = defaultRepo) {}

  getRepository(): ISegmentsRepository {
    return this.repo;
  }

  async list(): Promise<SegmentRecord[]> {
    return this.repo.list();
  }

  async findById(id: number | string): Promise<SegmentRecord | null> {
    return this.repo.findById(id);
  }

  async create(data: CreateSegmentDTO): Promise<SegmentRecord> {
    return this.repo.create(data);
  }

  async update(id: number | string, data: UpdateSegmentDTO): Promise<SegmentRecord | null> {
    return this.repo.update(id, data);
  }

  async delete(id: number | string): Promise<boolean> {
    return this.repo.delete(id);
  }
}

export const segmentsService = new SegmentsService();
