import { useId, type ReactNode } from 'react';
import { Minus, Plus } from 'lucide-react';
import type { QuantityControlState } from '../utils/quantity-control';

export interface QuantityStepperLabels {
  /** "Quantity, {name}" */
  group: string;
  decrease: string;
  increase: string;
  /** The + description at the limit ("Only 2 available" or the capped notice), else null. */
  limit: string | null;
}

export interface QuantityStepperProps {
  value: number;
  control: Pick<QuantityControlState, 'decrementDisabled' | 'incrementDisabled'>;
  labels: QuantityStepperLabels;
  onStep(delta: 1 | -1): void;
  /**
   * `line` (default): a 44px control for the bag. `action`: a 52px control, level with
   * `Button`'s default `--size-control` beside Add to Bag on the product page.
   */
  size?: 'line' | 'action';
}

const STEP_BUTTON =
  'flex cursor-pointer items-center justify-center text-text transition-colors duration-fast ease-ui hover:bg-surface-soft aria-disabled:cursor-not-allowed aria-disabled:text-disabled aria-disabled:hover:bg-transparent';

// `line`: 42px cells inside the 1px frame, a 44px control. `action`: 50px cells, a 52px
// control level with `Button`'s default height beside Add to Bag.
const STEP_SIZE = { line: 'h-[42px] w-11', action: 'h-[50px] w-12' } as const;

function StepButton({
  label,
  disabled,
  describedBy,
  size,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  describedBy?: string;
  size: 'line' | 'action';
  onPress(): void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      // Never `disabled`: the button stays focusable and its description stays reachable.
      aria-disabled={disabled || undefined}
      aria-describedby={describedBy}
      onClick={() => {
        if (!disabled) onPress();
      }}
      className={`${STEP_BUTTON} ${STEP_SIZE[size]}`}
    >
      {children}
    </button>
  );
}

/**
 * The bag's quantity stepper (Unit 6 *Stepper*): a labelled group of two 44px buttons around
 * the value as text. Rules come from `lineStepper`; this renders them. Client-bundled
 * without a directive: only boundary islands import it.
 */
export function QuantityStepper({
  value,
  control,
  labels,
  onStep,
  size = 'line',
}: QuantityStepperProps) {
  const limitId = `${useId()}-limit`;

  return (
    <div role="group" aria-label={labels.group} className="stepper">
      <StepButton
        label={labels.decrease}
        disabled={control.decrementDisabled}
        size={size}
        onPress={() => onStep(-1)}
      >
        <Minus size={16} strokeWidth={1.5} aria-hidden="true" />
      </StepButton>
      <span className="type-price min-w-9 text-center font-medium">{value}</span>
      <StepButton
        label={labels.increase}
        disabled={control.incrementDisabled}
        size={size}
        describedBy={labels.limit ? limitId : undefined}
        onPress={() => onStep(1)}
      >
        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
      </StepButton>
      {labels.limit && (
        <span id={limitId} hidden>
          {labels.limit}
        </span>
      )}
    </div>
  );
}
