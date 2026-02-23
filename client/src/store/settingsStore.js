import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      locale: 'ar',
      theme: 'light',

      setLocale: (locale) => {
        set({ locale });
        syncDOM(locale, get().theme);
      },

      setTheme: (theme) => {
        set({ theme });
        syncDOM(get().locale, theme);
      },

      toggleLocale: () => {
        const next = get().locale === 'ar' ? 'en' : 'ar';
        set({ locale: next });
        syncDOM(next, get().theme);
      },

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        set({ theme: next });
        syncDOM(get().locale, next);
      },

      hydrate: () => {
        syncDOM(get().locale, get().theme);
      },
    }),
    { name: 'moon-settings' }
  )
);

function syncDOM(locale, theme) {
  const html = document.documentElement;
  html.lang = locale;
  html.dir = locale === 'ar' ? 'rtl' : 'ltr';

  if (theme === 'dark') {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}
