import type { ReactNode } from 'react';
import { HeroUIProvider } from '@heroui/react';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useSettingsStore } from '@/shared/store/settingsStore';

interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps): React.JSX.Element {
  const navigate = useNavigate();
  const router = useRouter();
  const locale = useSettingsStore((state) => state.locale);

  return (
    <HeroUIProvider
      locale={locale === 'ar' ? 'ar-EG' : 'en-US'}
      navigate={(to, options) => {
        navigate({ to: to as never, ...options });
      }}
      useHref={(to) => {
        try {
          return router.buildLocation({ to: to as never }).href;
        } catch {
          return to;
        }
      }}
    >
      {children}
    </HeroUIProvider>
  );
}

export default UIProvider;
