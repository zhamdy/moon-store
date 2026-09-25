/** Which desktop nav panel is open, by item key; `null` when none is. */
export type NavPanelKey = string | null;

/**
 * A trigger was activated (click, Enter, Space): its panel toggles, and any other open
 * panel gives way to it — one panel at a time.
 */
export function navPanelAfterKey(current: NavPanelKey, key: string): NavPanelKey {
  return current === key ? null : key;
}
