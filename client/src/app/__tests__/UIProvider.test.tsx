import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocale } from '@react-aria/i18n';
import { useSettingsStore } from '@/shared/store/settingsStore';
import { renderWithRouter } from '@/shared/tests/routerTestUtils';
import { UIProvider } from '../providers/UIProvider';

function LocaleProbe() {
  const { locale, direction } = useLocale();
  return (
    <div>
      <span data-testid="probe-locale">{locale}</span>
      <span data-testid="probe-direction">{direction}</span>
    </div>
  );
}

describe('UIProvider integration', () => {
  beforeEach(() => {
    localStorage.clear();
    useSettingsStore.getState().setLocale('en');
  });

  it('provides en-US locale and ltr direction when locale is en', async () => {
    useSettingsStore.getState().setLocale('en');

    renderWithRouter(
      <UIProvider>
        <LocaleProbe />
      </UIProvider>
    );

    const localeElement = await screen.findByTestId('probe-locale');
    expect(localeElement.textContent).toBe('en-US');
    expect(screen.getByTestId('probe-direction').textContent).toBe('ltr');
  });

  it('provides ar-EG locale and rtl direction when locale is ar', async () => {
    useSettingsStore.getState().setLocale('ar');

    renderWithRouter(
      <UIProvider>
        <LocaleProbe />
      </UIProvider>
    );

    const localeElement = await screen.findByTestId('probe-locale');
    expect(localeElement.textContent).toBe('ar-EG');
    expect(screen.getByTestId('probe-direction').textContent).toBe('rtl');
  });
});
