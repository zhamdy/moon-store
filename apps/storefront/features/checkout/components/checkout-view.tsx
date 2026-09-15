'use client';

import { useForm } from '@tanstack/react-form';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { showToast } from '@/components/feedback/show-toast';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import { useBagController } from '@/features/cart/components/use-bag-controller';
import type { CartLine } from '@/features/cart/utils/cart-lines';
import {
  checkoutReadiness,
  type CheckoutReadiness,
} from '@/features/cart/utils/checkout-readiness';
import { cartQuoteKey, type BagRow, type BagSummary } from '@/features/cart/utils/reconcile';
import { cn } from '@/lib/utils/cn';
import { checkoutCommerce } from '../commerce';
import { CHECKOUT_DRAFT_DEBOUNCE_MS } from '../constants';
import {
  CHECKOUT_FIELDS,
  EMPTY_CHECKOUT_VALUES,
  checkoutFieldError,
  checkoutFormSchema,
  type CheckoutField,
  type CheckoutFormValues,
} from '../schemas/checkout-form';
import { buildSubmission } from '../utils/build-submission';
import { browserDraftStorage, readDraft, writeDraft } from '../utils/checkout-draft-storage';
import type { CheckoutPageStrings } from '../utils/checkout-strings';
import {
  checkoutNotice,
  checkoutNoticeText,
  fieldErrorText,
  outcomeToast,
  shouldShowFieldError,
} from '../utils/checkout-view-model';
import { firstInvalidField, focusPlan } from '../utils/field-errors';
import {
  INITIAL_SUBMIT_STATE,
  isSubmitBusy,
  transition,
  type SubmitEffect,
  type SubmitEvent,
  type SubmitState,
} from '../utils/submit-machine';
import { CheckoutCartNotice } from './checkout-cart-notice';
import { CheckoutSummary } from './checkout-summary';
import { DeliveryMethodSection, type DeliveryMethodOption } from './delivery-method-section';
import { GovernorateField } from './governorate-field';
import { TextField, type TextFieldProps } from './text-field';

const NO_LINES: readonly CartLine[] = [];

const TEXT_ACTION =
  'type-small inline-flex min-h-11 cursor-pointer items-center text-text underline decoration-text-secondary decoration-1 underline-offset-4 transition-colors duration-fast ease-ui hover:decoration-text';

/** Per-field input semantics (plan *Field Specification*); governorate has its own component. */
const INPUT_PROPS: Record<
  Exclude<CheckoutField, 'governorate'>,
  Pick<TextFieldProps, 'type' | 'autoComplete' | 'inputMode' | 'ltr'>
> = {
  fullName: { type: 'text', autoComplete: 'name' },
  phone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel', ltr: true },
  email: { type: 'email', autoComplete: 'email', inputMode: 'email', ltr: true },
  area: { type: 'text', autoComplete: 'shipping address-level2' },
  street: { type: 'text', autoComplete: 'shipping address-line1' },
  apartment: { type: 'text', autoComplete: 'shipping address-line2' },
  landmark: { type: 'text', autoComplete: 'off' },
};

export interface CheckoutViewProps {
  strings: CheckoutPageStrings;
  locale: AppLocale;
  /** `catalogPath({ kind: 'all' })`, resolved on the server. */
  shopHref: string;
  bagHref: string;
  /** Empty until delivery rules exist (CO-18). */
  deliveryMethods: readonly DeliveryMethodOption[];
}

/**
 * The checkout page island (plan 2026-09-15-002, Unit 7; the eighteenth client boundary). It
 * reads the bag through the Bag's own controller (the quote, reconciliation and its toasts), so
 * the summary is only ever the server's quote. The form renders only once the bag has hydrated
 * (CO-20): an empty bag never flashes a usable form, and nothing can submit before hydration.
 */
export function CheckoutView({
  strings,
  locale,
  shopHref,
  bagHref,
  deliveryMethods,
}: CheckoutViewProps) {
  const { cart, view, fetch, refresh, onRetry, emptyHeading } = useBagController({
    active: true,
    locale,
    strings: strings.bag,
  });
  const lines = cart.hydrated ? cart.lines : NO_LINES;
  const readiness = checkoutReadiness(
    { hydrated: cart.hydrated, lines, view, fetch },
    { strict: true }
  );

  // A bag emptied while the form had focus (another tab, the drawer): focus the empty state
  // rather than leaving it on <body>.
  const empty = cart.hydrated && view.kind === 'empty';
  useEffect(() => {
    if (empty && document.activeElement === document.body) emptyHeading.current?.focus();
  }, [empty, emptyHeading]);

  if (!cart.hydrated) {
    return (
      <div aria-busy="true" className="min-h-[64rem] lg:min-h-[44rem]">
        <p className="sr-only">{strings.bag.summary.updating}</p>
      </div>
    );
  }

  if (empty) {
    return (
      <div className="flex flex-col items-start gap-4 border-t border-border pt-10">
        <h2 ref={emptyHeading} tabIndex={-1} className="type-h4 focus:outline-none">
          {strings.bag.status.emptyTitle}
        </h2>
        <Link href={shopHref} className={TEXT_ACTION}>
          {strings.bag.status.emptyAction}
        </Link>
      </div>
    );
  }

  return (
    <CheckoutForm
      strings={strings}
      locale={locale}
      shopHref={shopHref}
      bagHref={bagHref}
      deliveryMethods={deliveryMethods}
      lines={lines}
      rows={view.kind === 'ready' || view.kind === 'loading' ? view.rows : []}
      summary={view.kind === 'ready' ? view.summary : null}
      readiness={readiness}
      refresh={refresh}
      onRetry={onRetry}
    />
  );
}

interface CheckoutFormProps extends CheckoutViewProps {
  lines: readonly CartLine[];
  rows: readonly BagRow[];
  summary: BagSummary | null;
  readiness: CheckoutReadiness;
  refresh(): Promise<void>;
  onRetry(): void;
}

function CheckoutForm({
  strings,
  locale,
  shopHref,
  bagHref,
  deliveryMethods,
  lines,
  rows,
  summary,
  readiness,
  refresh,
  onRetry,
}: CheckoutFormProps) {
  const ids = useId();
  const fieldId = (field: CheckoutField) => `${ids}-${field}`;
  const noticeHeading = useRef<HTMLHeadingElement>(null);

  // Mounted only on the client after hydration, so the draft is read before the first render
  // and becomes the default values: nothing is filled in after a field is interactive.
  const [storage] = useState(browserDraftStorage);
  const [defaultValues] = useState<CheckoutFormValues>(() => ({
    ...EMPTY_CHECKOUT_VALUES,
    ...readDraft(storage),
  }));

  const [submit, setSubmit] = useState<SubmitState>(INITIAL_SUBMIT_STATE);
  const submitRef = useRef(submit);
  const runEffect = useRef<(effect: SubmitEffect) => void>(() => {});
  const mounted = useRef(true);

  const dispatch = useCallback((event: SubmitEvent) => {
    const next = transition(submitRef.current, event);
    if (next.state !== submitRef.current) {
      submitRef.current = next.state;
      setSubmit(next.state);
    }
    if (next.effect) runEffect.current(next.effect);
  }, []);

  const form = useForm({
    defaultValues,
    validators: { onSubmit: checkoutFormSchema },
    onSubmit: () => dispatch({ type: 'validated', ok: true }),
    onSubmitInvalid: () => dispatch({ type: 'validated', ok: false }),
    listeners: {
      onChange: ({ formApi }) => {
        writeDraft(storage, formApi.state.values);
        dispatch({ type: 'edited' });
      },
      onChangeDebounceMs: CHECKOUT_DRAFT_DEBOUNCE_MS,
    },
  });

  // Effects read the latest render's values through refs, never stale closures.
  const latest = useRef({ lines, refresh, strings });
  useEffect(() => {
    latest.current = { lines, refresh, strings };
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const focusField = (field: CheckoutField) => {
      const element = document.getElementById(fieldId(field));
      if (!element) return;
      if (focusPlan(document.activeElement === element) === 'refocus') {
        element.blur();
        requestAnimationFrame(() => element.focus());
      } else {
        element.focus();
      }
    };

    runEffect.current = (effect) => {
      switch (effect.kind) {
        case 'validate':
          void form.handleSubmit();
          return;
        case 'focusFirstInvalid': {
          const field = firstInvalidField(
            Object.fromEntries(
              CHECKOUT_FIELDS.map((name) => [name, form.getFieldMeta(name)?.errors])
            )
          );
          if (field) focusField(field);
          return;
        }
        case 'refresh':
          void latest.current.refresh().then(() => {
            if (mounted.current) dispatch({ type: 'refreshed' });
          });
          return;
        case 'submit': {
          const submission = buildSubmission(
            form.state.values,
            latest.current.lines,
            effect.quoteKey
          );
          void checkoutCommerce.submit(submission).then((outcome) => {
            if (mounted.current) dispatch({ type: 'outcome', outcome });
          });
          return;
        }
        case 'focusCartNotice':
          requestAnimationFrame(() => noticeHeading.current?.focus());
          return;
        case 'focusEmptyHeading':
          // The view has already switched to the empty state, which focuses its own heading.
          return;
        case 'showOutcome':
          showToast(outcomeToast(effect.outcome, latest.current.strings.outcome));
          return;
      }
    };
  });

  // Feed readiness to the machine while it verifies (it ignores it until the refresh settled).
  const quoteKey = cartQuoteKey(lines);
  useEffect(() => {
    if (submit.phase.kind === 'verifying') {
      dispatch({ type: 'readiness', readiness, currentKey: quoteKey });
    }
  }, [submit.phase, readiness, quoteKey, dispatch]);

  const previousKey = useRef(quoteKey);
  useEffect(() => {
    if (previousKey.current === quoteKey) return;
    previousKey.current = quoteKey;
    dispatch({ type: 'quoteKeyChanged' });
  }, [quoteKey, dispatch]);

  // The debounced listener may not have run yet when the page is left.
  useEffect(() => {
    const flush = () => writeDraft(storage, form.state.values);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [storage, form]);

  const notice = checkoutNotice({
    readiness,
    attempted: submit.attempted,
    rows,
    locale,
    lineStrings: strings.bag.line,
  });
  const busy = isSubmitBusy(submit.phase);
  const outcome = submit.phase.kind === 'outcome' ? submit.phase.outcome : null;

  const renderField = (field: CheckoutField, className?: string) => (
    <form.Field key={field} name={field}>
      {(api) => {
        const errorKey = checkoutFieldError(field, api.state.value);
        const error =
          errorKey && shouldShowFieldError(api.state.meta.isBlurred, submit.attempted)
            ? fieldErrorText(errorKey, field, strings.errors)
            : null;
        const common = {
          id: fieldId(field),
          name: field,
          label: strings.fields[field],
          optionalLabel:
            field === 'email' || field === 'apartment' || field === 'landmark'
              ? strings.optional
              : undefined,
          hint: strings.hints[field],
          error,
          className,
          value: api.state.value,
          enterKeyHint: field === 'landmark' ? ('done' as const) : ('next' as const),
          onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
            api.handleChange(event.target.value),
          onBlur: api.handleBlur,
        };
        return field === 'governorate' ? (
          <GovernorateField {...common} />
        ) : (
          <TextField {...common} {...INPUT_PROPS[field]} />
        );
      }}
    </form.Field>
  );

  return (
    <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-12 xl:gap-x-16">
      <div className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:col-span-4 lg:col-start-9 lg:row-start-1">
        <CheckoutSummary
          rows={rows}
          summary={summary}
          readiness={readiness}
          strings={strings}
          locale={locale}
          bagHref={bagHref}
        />
      </div>

      <div className="mt-12 lg:col-span-7 lg:col-start-1 lg:row-start-1 lg:mt-0">
        {notice && (
          <CheckoutCartNotice
            text={checkoutNoticeText(
              notice,
              { notice: strings.notice, announcements: strings.bag.announcements },
              locale
            )}
            headingRef={noticeHeading}
            bagHref={bagHref}
            labels={{ returnToBag: strings.notice.returnToBag, tryAgain: strings.notice.tryAgain }}
            onRetry={onRetry}
          />
        )}

        <form
          method="post"
          noValidate
          onSubmit={(event) => {
            // First, before anything that can throw: a native POST would carry personal data.
            event.preventDefault();
            dispatch({ type: 'submit' });
          }}
        >
          <section aria-labelledby={`${ids}-contact`} className="border-t border-border pt-8">
            <h2 id={`${ids}-contact`} className="type-h4">
              {strings.sections.contact}
            </h2>
            <div className="mt-6 grid gap-x-6 md:grid-cols-2">
              {renderField('fullName', 'md:col-span-2')}
              {renderField('phone')}
              {renderField('email')}
            </div>
          </section>

          <section aria-labelledby={`${ids}-address`} className="mt-4 border-t border-border pt-8">
            <h2 id={`${ids}-address`} className="type-h4">
              {strings.sections.address}
            </h2>
            <div className="mt-6 grid gap-x-6 md:grid-cols-2">
              {renderField('governorate')}
              {renderField('area')}
              {renderField('street', 'md:col-span-2')}
              {renderField('apartment')}
              {renderField('landmark')}
            </div>
          </section>

          <DeliveryMethodSection
            headingId={`${ids}-delivery`}
            heading={strings.sections.delivery}
            methods={deliveryMethods}
            pendingText={strings.delivery.pending}
          />

          <div className="mt-10 border-t border-border pt-8">
            <Button
              type="submit"
              aria-disabled={busy || undefined}
              className={cn('w-full md:w-auto md:min-w-64', busy && 'cursor-progress')}
            >
              {busy ? strings.action.checking : strings.action.continue}
            </Button>
            <div className="mt-4 min-h-lh">
              {outcome?.kind === 'unavailable' && (
                <div>
                  <p className="type-body">{strings.outcome.unavailablePreview}</p>
                  <div className="mt-1 flex flex-wrap gap-x-6">
                    <Link href={bagHref} className={TEXT_ACTION}>
                      {strings.outcome.backToBag}
                    </Link>
                    <Link href={shopHref} className={TEXT_ACTION}>
                      {strings.outcome.continueShopping}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
