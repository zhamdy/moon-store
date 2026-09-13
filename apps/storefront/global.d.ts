import type { routing } from '@/i18n/routing';
import type messages from './messages/en.json';

// en.json is the key authority; messages.test.ts holds every other catalogue to its shape.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
