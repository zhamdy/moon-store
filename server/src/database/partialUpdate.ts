/**
 * Builds the SET clause of a PATCH-style UPDATE from the columns a caller actually named.
 *
 * The bug this exists to stop (#78) is not a typo, it is a shape. An update endpoint that
 * parses a body with an all-optional schema and then writes every column from it treats a
 * missing field as "set to default" rather than "leave alone". The request succeeds, the
 * response is a 200, and a field nobody mentioned is quietly gone. `is_featured` on
 * collections is the field that exposed it; an audit found the same shape in a dozen other
 * update paths.
 *
 * So the rule is stated once, here, instead of being re-derived at each repository:
 *
 * - `undefined` means the body did not mention the column. It is not written.
 * - `null` means the body asked for the column to be cleared. It is written.
 *
 * That distinction is the whole point, which is why the guard is `!== undefined` and never
 * a truthiness test.
 */
export interface PartialUpdate {
  /** e.g. `name = $1, is_featured = $2` — never empty; see `alwaysSet`. */
  setClause: string;
  /** Positional parameters for `setClause`, in order, starting at `$1`. */
  params: unknown[];
  /** How many parameters `setClause` consumed, so the caller can number its WHERE. */
  nextIndex: number;
}

export interface PartialUpdateOptions {
  /**
   * Raw SQL fragments appended to every SET clause, whatever the caller named — an
   * `updated_at = NOW()` belongs here. They take no parameters, so nothing user-supplied
   * reaches them.
   *
   * They also guarantee the clause is non-empty: a body that named no columns at all (a
   * collection edit that only changed its product set) still produces valid SQL and still
   * touches the row, rather than making every caller special-case zero assignments.
   */
  alwaysSet?: readonly string[];
  /** First positional parameter to use. Defaults to 1. */
  startIndex?: number;
}

export function buildPartialUpdate(
  columns: Readonly<Record<string, unknown>>,
  { alwaysSet = ['updated_at = NOW()'], startIndex = 1 }: PartialUpdateOptions = {}
): PartialUpdate {
  const assignments: string[] = [];
  const params: unknown[] = [];

  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    params.push(value);
    assignments.push(`${column} = $${startIndex + params.length - 1}`);
  }

  assignments.push(...alwaysSet);

  return {
    setClause: assignments.join(', '),
    params,
    nextIndex: startIndex + params.length,
  };
}

/**
 * Carries "the body did not mention this" through a nullable text column.
 *
 * These columns have always stored NULL for an empty string — a cleared form field and an
 * absent one used to be indistinguishable because both ended up NULL anyway. Now that they
 * differ, `''` keeps meaning NULL and `undefined` keeps meaning untouched. Changing what a
 * *present* empty string does is a separate decision from fixing what an *absent* field
 * does, and this fix is only the second one.
 */
export function orNull<T>(value: T | null | undefined): T | null | undefined {
  return value === undefined ? undefined : value || null;
}
