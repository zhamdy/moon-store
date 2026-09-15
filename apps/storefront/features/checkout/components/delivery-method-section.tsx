/** A delivery option, once real delivery rules exist (CO-18). */
export interface DeliveryMethodOption {
  id: string;
  label: string;
}

export interface DeliveryMethodSectionProps {
  headingId: string;
  heading: string;
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
  methods,
  pendingText,
}: DeliveryMethodSectionProps) {
  return (
    <section aria-labelledby={headingId} className="mt-4 border-t border-border pt-8">
      <h2 id={headingId} className="type-h4">
        {heading}
      </h2>
      {methods.length === 0 && <p className="type-body mt-3 text-text-secondary">{pendingText}</p>}
    </section>
  );
}
