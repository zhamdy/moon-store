export interface StepHeadingProps {
  id: string;
  /** The step's place in the form, drawn as a Bronze numeral before the title. */
  step: number;
  children: string;
}

/**
 * A checkout section's heading ("Fitting room", 2026-09-27): a Bronze numeral, then the title
 * in the display face. The numeral is `aria-hidden`, so the heading is named by its title alone
 * and a screen reader's heading list reads "Contact", not "1 Contact".
 */
export function StepHeading({ id, step, children }: StepHeadingProps) {
  return (
    <h2 id={id} className="flex items-baseline gap-3.5">
      <span aria-hidden="true" className="type-supporting font-semibold text-brand tabular-nums">
        {step}
      </span>
      <span className="type-title">{children}</span>
    </h2>
  );
}
