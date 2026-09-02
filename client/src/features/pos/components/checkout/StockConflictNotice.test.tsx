import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSettingsStore } from '../../../../shared/store/settingsStore';
import type { StockConflictRecovery } from '../../hooks/useStockConflictRecovery';
import StockConflictNotice from './StockConflictNotice';

function recovery(overrides: Partial<StockConflictRecovery> = {}): StockConflictRecovery {
  return {
    shortfalls: [],
    isChecking: false,
    check: vi.fn(),
    resolve: vi.fn(),
    clear: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  useSettingsStore.setState({ locale: 'en' });
});

describe('StockConflictNotice', () => {
  it('shows nothing at all when there is no conflict', () => {
    const { container } = render(<StockConflictNotice conflict={recovery()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('says it is checking while the stock re-read is in flight', () => {
    render(<StockConflictNotice conflict={recovery({ isChecking: true })} />);

    expect(screen.getByText('Checking current stock...')).toBeInTheDocument();
  });

  it('names each short line with what was asked for and what is left', () => {
    render(
      <StockConflictNotice
        conflict={recovery({
          shortfalls: [
            { productId: 7, name: 'Silk Dress', requested: 4, available: 1 },
            { productId: 9, name: 'Cashmere Scarf', requested: 2, available: 0 },
          ],
        })}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Silk Dress: 4 in cart, 1 left')).toBeInTheDocument();
    expect(screen.getByText('Cashmere Scarf: 2 in cart, 0 left')).toBeInTheDocument();
  });

  it('offers the adjustment as an explicit action, never applying it on render', () => {
    const resolve = vi.fn();
    render(
      <StockConflictNotice
        conflict={recovery({
          resolve,
          shortfalls: [{ productId: 7, name: 'Silk Dress', requested: 4, available: 1 }],
        })}
      />
    );

    expect(resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Adjust cart to available stock' }));
    expect(resolve).toHaveBeenCalledTimes(1);
  });
});
