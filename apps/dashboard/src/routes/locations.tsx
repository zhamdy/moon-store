import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/locations')({
  beforeLoad: () => {
    throw redirect({
      to: '/branches',
      replace: true,
    });
  },
});
