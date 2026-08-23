import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';
import { routeTree } from '../../routeTree.gen';
import { onlineOrderSearchSchema } from '../_authenticated/_admin/online-orders';
import { purchaseOrderSearchSchema } from '../_authenticated/_admin/purchase-orders';
import { deliverySearchSchema } from '../_authenticated/deliveries';

const admin = {
  id: 1,
  name: 'Admin',
  email: 'admin@moon.com',
  role: 'Admin' as const,
};

describe('shareable collection URL state', () => {
  it('normalizes direct-link list params while retaining safe filters', () => {
    expect(
      purchaseOrderSearchSchema.parse({
        page: '3',
        pageSize: '50',
        status: 'received',
        distributorId: '12',
      })
    ).toEqual({ page: 3, pageSize: 50, status: 'received', distributorId: '12' });

    expect(
      onlineOrderSearchSchema.parse({ page: '-2', pageSize: '200', status: 'secret' })
    ).toEqual({
      page: 1,
      pageSize: 25,
      status: undefined,
    });
    expect(deliverySearchSchema.parse({ page: '2', status: 'Shipped' })).toEqual({
      page: 2,
      pageSize: 25,
      status: 'Shipped',
    });
  });

  it('restores pagination and filters through browser Back navigation', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/purchase-orders?page=2&pageSize=25&status=sent&distributorId=4'],
    });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: { isAuthenticated: true, user: admin } },
    });

    await router.load();
    await router.navigate({
      to: '/purchase-orders',
      search: { page: 1, pageSize: 50, status: 'received', distributorId: 'all' },
    });
    expect(router.state.location.search).toMatchObject({
      page: 1,
      pageSize: 50,
      status: 'received',
    });

    history.back();
    expect(history.location.search).toContain('page=2');
    expect(history.location.search).toContain('pageSize=25');
    expect(history.location.search).toContain('status=sent');
    expect(history.location.search).toContain('distributorId=4');
  });
});
