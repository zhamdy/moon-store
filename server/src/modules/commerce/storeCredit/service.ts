import { Queryable, withTransaction } from '../../../database/transaction';
import { PublicError } from '../../../http/errors';
import { IStoreCreditRepository, storeCreditRepository as defaultRepo } from './repository';
import { CreditBalance, CreditEntry, IssueCreditInput } from './types';

export class StoreCreditService {
  constructor(private repo: IStoreCreditRepository = defaultRepo) {}

  getRepository(): IStoreCreditRepository {
    return this.repo;
  }

  async getBalance(customerId: number): Promise<CreditBalance | null> {
    if (!(await this.repo.customerExists(customerId))) return null;

    return {
      customer_id: customerId,
      balance: await this.repo.getBalance(customerId),
      entries: await this.repo.listEntries(customerId),
    };
  }

  /**
   * Credits a customer.
   *
   * @param client joins an existing transaction instead of opening one, so credit issued
   *   by an exchange commits or rolls back with the exchange itself. Issuing credit for
   *   an exchange that then failed would be inventing money.
   */
  async issue(input: IssueCreditInput, client?: Queryable): Promise<CreditEntry> {
    if (!(input.amount > 0)) {
      throw new PublicError('VALIDATION_ERROR', 'Credit amount must be greater than zero');
    }

    const run = async (queryable: Queryable): Promise<CreditEntry> => {
      if (!(await this.repo.customerExists(input.customer_id, queryable))) {
        throw new PublicError('VALIDATION_ERROR', `Customer not found: ID ${input.customer_id}`);
      }
      return this.repo.addEntry(
        {
          customer_id: input.customer_id,
          delta: input.amount,
          reason: input.reason,
          source_type: input.source_type,
          source_id: input.source_id ?? null,
          created_by: input.created_by ?? null,
        },
        queryable
      );
    };

    return client ? run(client) : withTransaction(run);
  }

  /**
   * Spends a customer's credit, refusing to overdraw.
   *
   * The balance is locked before it is read, so two tills redeeming at once cannot both
   * see the same balance and both spend it.
   */
  async redeem(
    input: {
      customer_id: number;
      amount: number;
      sale_id?: number | null;
      created_by?: number | null;
    },
    client?: Queryable
  ): Promise<{ entry: CreditEntry; new_balance: number }> {
    if (!(input.amount > 0)) {
      throw new PublicError('VALIDATION_ERROR', 'Redemption amount must be greater than zero');
    }

    const run = async (queryable: Queryable) => {
      if (!(await this.repo.customerExists(input.customer_id, queryable))) {
        throw new PublicError('NOT_FOUND', `Customer not found: ID ${input.customer_id}`);
      }

      const balance = await this.repo.lockBalance(input.customer_id, queryable);
      if (input.amount > balance) {
        throw new PublicError('CONFLICT', `Insufficient store credit. Available: ${balance}`);
      }

      const entry = await this.repo.addEntry(
        {
          customer_id: input.customer_id,
          delta: -input.amount,
          reason: input.sale_id ? `Redeemed on sale ${input.sale_id}` : 'Redeemed',
          source_type: 'sale',
          source_id: input.sale_id ? String(input.sale_id) : null,
          created_by: input.created_by ?? null,
        },
        queryable
      );

      return { entry, new_balance: balance - input.amount };
    };

    return client ? run(client) : withTransaction(run);
  }
}

export const storeCreditService = new StoreCreditService();
