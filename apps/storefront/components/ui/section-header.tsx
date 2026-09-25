import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SectionHeaderProps {
  /** The heading's id, for the section's `aria-labelledby`. */
  id?: string;
  title: ReactNode;
  /** Uppercase label above the title (English), a weighted line in Arabic. Optional. */
  eyebrow?: ReactNode;
  /** One line under the title (or beside it in `split`). */
  lead?: ReactNode;
  /** An `EditorialLink` or similar, at the inline end (`commerce`) or under the lead. */
  action?: ReactNode;
  /**
   * - `commerce` (default): title and action on one baseline; the calm listing header.
   * - `split`: editorial — title in columns 1–7, lead and action in 9–12 from 1024.
   * - `center`: a quiet centred chapter heading.
   */
  layout?: 'commerce' | 'split' | 'center';
  /**
   * `page` (`type-page-title`, the default), `section` (`type-section-title`) or
   * `display` (`type-display`, an editorial chapter opening — homepage Phase 2).
   */
  size?: 'section' | 'page' | 'display';
  /**
   * Entrance hooks for an enclosing `Reveal` (homepage Phase 2, additive). `none` (the
   * default) renders no motion attribute at all, so every existing caller is unchanged.
   * `calm`: the title rises 16px, the lead and action fade after it — the commerce
   * register. `editorial`: the same sequence, a longer rise and later offsets.
   */
  motion?: 'none' | 'calm' | 'editorial';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

const SIZE_CLASS = {
  page: 'type-page-title',
  section: 'type-section-title',
  display: 'type-display',
} as const;

interface MotionHooks {
  title?: 'rise';
  fade?: 'fade';
  titleClass?: string;
  eyebrowClass?: string;
  leadClass?: string;
  actionClass?: string;
}

/** Attribute sets per register; `none` is empty so the markup is byte-identical. */
const MOTION: Record<NonNullable<SectionHeaderProps['motion']>, MotionHooks> = {
  none: {},
  calm: {
    title: 'rise',
    fade: 'fade',
    titleClass: '[--motion-rise:16px] [--motion-offset:60ms]',
    eyebrowClass: '[--motion-offset:0ms]',
    leadClass: '[--motion-offset:180ms]',
    actionClass: '[--motion-offset:280ms]',
  },
  editorial: {
    title: 'rise',
    fade: 'fade',
    titleClass: '[--motion-rise:28px] [--motion-offset:160ms] [--motion-duration:900ms]',
    eyebrowClass: '[--motion-offset:40ms]',
    leadClass: '[--motion-offset:420ms]',
    actionClass: '[--motion-offset:560ms]',
  },
};

/**
 * The design system's section header, with no motion of its own: a section that
 * reveals wraps it in a `Reveal` and passes `motion`, which only sets `data-motion`
 * attributes and offsets on the header's own parts (the homepage retired its local
 * `SectionHeading` for this in Phase 2).
 */
export function SectionHeader({
  id,
  title,
  eyebrow,
  lead,
  action,
  layout = 'commerce',
  size = 'page',
  motion = 'none',
  as: Heading = 'h2',
  className,
}: SectionHeaderProps) {
  const m = MOTION[motion];
  const heading = (
    <Heading id={id} data-motion={m.title} className={cn(SIZE_CLASS[size], m.titleClass)}>
      {title}
    </Heading>
  );
  const eyebrowNode = eyebrow ? (
    <Eyebrow data-motion={m.fade} className={m.eyebrowClass}>
      {eyebrow}
    </Eyebrow>
  ) : null;
  const leadNode = lead ? (
    <p data-motion={m.fade} className={cn('type-body-lg measure text-text-secondary', m.leadClass)}>
      {lead}
    </p>
  ) : null;
  const actionNode = action ? (
    <div data-motion={m.fade} className={cn('shrink-0', m.actionClass)}>
      {action}
    </div>
  ) : null;

  if (layout === 'split') {
    return (
      <header
        className={cn(
          'grid gap-4 lg:grid-cols-12 lg:items-end lg:gap-x-6',
          'mb-10 lg:mb-14',
          className
        )}
      >
        <div className="grid gap-4 lg:col-span-7">
          {eyebrowNode}
          {heading}
        </div>
        {(leadNode || actionNode) && (
          <div className="grid justify-items-start gap-5 lg:col-span-4 lg:col-start-9">
            {leadNode}
            {actionNode}
          </div>
        )}
      </header>
    );
  }

  if (layout === 'center') {
    return (
      <header className={cn('mb-10 grid justify-items-center gap-4 text-center', className)}>
        {eyebrowNode}
        {heading}
        {leadNode}
        {actionNode}
      </header>
    );
  }

  return (
    <header
      className={cn('mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4', className)}
    >
      <div className="grid gap-3">
        {eyebrowNode}
        {heading}
        {leadNode}
      </div>
      {actionNode}
    </header>
  );
}

/**
 * The eyebrow on its own: `type-eyebrow` in the accent colour behind a short gold
 * rule (the rule is what carries the role in Arabic, where there is no uppercase).
 */
export function Eyebrow({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & Omit<
  HTMLAttributes<HTMLParagraphElement>,
  'children' | 'className'
>) {
  return (
    <p {...rest} className={cn('type-eyebrow flex items-center gap-3 text-brand', className)}>
      <span aria-hidden="true" className="h-px w-7 shrink-0 bg-metallic" />
      {children}
    </p>
  );
}
