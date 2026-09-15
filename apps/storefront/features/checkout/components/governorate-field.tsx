import { TextField, type TextFieldProps } from './text-field';

/**
 * The governorate (CO-7; owner decision 2026-09-15): free text for this UI phase. Delivery
 * coverage is not approved, and a select of every governorate would suggest Moon Fashion
 * delivers everywhere. When real zones exist, this is the one component that becomes a select
 * of the supported list; the value stays a string, so the draft and submission do not change.
 */
export function GovernorateField(props: Omit<TextFieldProps, 'type' | 'autoComplete'>) {
  return <TextField {...props} type="text" autoComplete="shipping address-level1" />;
}
