import { ICategoriesRepository, categoriesRepository as defaultRepo } from './repository';
import { CreateCategoryDTO, UpdateCategoryDTO, CategoryRecord } from './types';
import { withTransaction } from '../../../database/transaction';
import { assertSlugAvailable, assignGeneratedSlug, rethrowSlugViolation } from '../shared/slug';

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

  /** An explicit slug is checked; an absent one is generated from `name_en`, then `code`. */
  create(data: CreateCategoryDTO): Promise<CategoryRecord> {
    return withTransaction(async (client) => {
      if (data.slug) await assertSlugAvailable(client, 'categories', data.slug);
      let created: CategoryRecord;
      try {
        created = await this.repo.create(data, client);
      } catch (error) {
        rethrowSlugViolation(error, 'categories');
      }
      if (created.slug) return created;
      return assignGeneratedSlug<CategoryRecord>(client, 'categories', created.id, [
        data.name_en,
        data.code,
      ]);
    });
  }

  /** An explicit slug held by another category is a 409; an absent one is left alone. */
  update(id: number | string, data: UpdateCategoryDTO): Promise<CategoryRecord | null> {
    return withTransaction(async (client) => {
      if (data.slug) {
        await assertSlugAvailable(client, 'categories', data.slug, {
          column: 'id',
          value: Number(id),
        });
      }
      try {
        return await this.repo.update(id, data, client);
      } catch (error) {
        rethrowSlugViolation(error, 'categories');
      }
    });
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
