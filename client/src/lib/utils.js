import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow } from "date-fns";
import { useSettingsStore } from "../store/settingsStore";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
  const locale = useSettingsStore.getState().locale;
  const formatted = new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: "latn",
  }).format(amount);
  return `${formatted} $`;
}

export function formatDate(date) {
  return format(new Date(date), "MMM dd, yyyy");
}

export function formatDateTime(date) {
  return format(new Date(date), "MMM dd, yyyy '\u2013' HH:mm");
}

export function formatRelative(date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function generateOrderNumber() {
  const date = format(new Date(), "yyyyMMdd");
  const rand = String(Math.floor(Math.random() * 999) + 1).padStart(3, "0");
  return `DEL-${date}-${rand}`;
}
