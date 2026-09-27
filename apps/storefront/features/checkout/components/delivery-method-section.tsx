import { StepHeading } from './step-heading';

/** A delivery option, once real delivery rules exist (CO-18). */
export interface DeliveryMethodOption {
  id: string;
  label: string;
}

export interface DeliveryMethodSectionProps {
  headingId: string;
  heading: string;
  /** Its place in the form's numbered sections. */
  step: number;
  /** Empty in this phase: no delivery rules, fees, couriers or timings exist yet. */
  methods: readonly DeliveryMethodOption[];
  pendingText: string;
}

/**
 * The delivery section's place in the form (CO-18). With no methods it states, neutrally, that
 * options are confirmed later: nothing about timing, coverage, fees or couriers (owner decision
 * 2026-09-15), and the submission's `deliveryMethod` stays null. The required radio group lands
 * with the delivery rules that give it options; it is not built ahead of them.
 */
export function DeliveryMethodSection({
  headingId,
  heading,
  step,
  methods,
  pendingText,
}: DeliveryMethodSectionProps) {
  return (
    <section aria-labelledby={headingId} className="border-t border-border pt-7 pb-8">
      <StepHeading id={headingId} step={step}>
        {heading}
      </StepHeading>
      {methods.length === 0 && <p className="type-body mt-3 text-text-secondary">{pendingText}</p>}
    </section>
  );
}
