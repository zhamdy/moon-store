import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useSettingsStore } from '../store/settingsStore';

function getDateLocale() {
  return useSettingsStore.getState().locale === 'ar' ? { locale: ar } : {};
}

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const locale = useSettingsStore.getState().locale;
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(amount);
  return `${formatted} $`;
}

export function formatDate(date: string | Date): string {
  return format(new Date(date), 'MMM dd, yyyy', getDateLocale());
}

export function formatDateTime(date: string | Date): string {
  return format(new Date(date), "MMM dd, yyyy '\u2013' HH:mm", getDateLocale());
}

export function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, ...getDateLocale() });
}

export function generateOrderNumber(): string {
  const date = format(new Date(), 'yyyyMMdd');
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `DEL-${date}-${rand}`;
}
