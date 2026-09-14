/**
 * `{name}` substitution for the few templates a client island formats with client-side
 * values (islands never receive the message catalogue or an ICU formatter). An unknown
 * placeholder is left as written.
 */
export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}
