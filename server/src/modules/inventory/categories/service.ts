import { ICategoriesRepository, categoriesRepository as defaultRepo } from './repository';
import { CreateCategoryDTO, UpdateCategoryDTO, CategoryRecord } from './types';

export class CategoriesService {
  constructor(private repo: ICategoriesRepository = defaultRepo) {}

  getRepository(): ICategoriesRepository {
    return this.repo;
  }

  findAll(): Promise<CategoryRecord[]> {
    return this.repo.findAll();
  }

  findById(id: number | string): Promise<CategoryRecord | null> {
    return this.repo.findById(id);
  }

  create(data: CreateCategoryDTO): Promise<CategoryRecord> {
    return this.repo.create(data);
  }

  update(id: number | string, data: UpdateCategoryDTO): Promise<CategoryRecord | null> {
    return this.repo.update(id, data);
  }

  countProducts(id: number | string): Promise<number> {
    return this.repo.countProducts(id);
  }

  async delete(id: number | string): Promise<{ success: boolean; error?: string }> {
    const productCount = await this.repo.countProducts(id);
    if (productCount > 0) {
      return { success: false, error: 'Cannot delete category with associated products' };
    }
    const deleted = await this.repo.delete(id);
    if (!deleted) {
      return { success: false, error: 'Category not found' };
    }
    return { success: true };
  }
}

export const categoriesService = new CategoriesService();
