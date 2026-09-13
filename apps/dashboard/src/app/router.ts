import { createRouter } from '@tanstack/react-router';
import { routeTree } from '../routeTree.gen';
import type { RouterContext } from '../routes/__root';

export type { RouterContext };

export const router = createRouter({
  routeTree,
  context: {
    auth: {
      isAuthenticated: false,
      user: null,
    },
  },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
