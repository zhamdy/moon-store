import type { ReactNode } from 'react';
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
  /** `section` (`type-section-title`) or `page` (`type-page-title`, the default). */
  size?: 'section' | 'page';
  as?: 'h1' | 'h2' | 'h3';
  className?: string;
}

/**
 * The design system's section header, with no motion of its own: a section that
 * reveals wraps it in a `Reveal` and declares `data-motion` on its own markup. The
 * homepage keeps its own `SectionHeading` (with its choreography) until the homepage
 * phase; new sections use this.
 */
export function SectionHeader({
  id,
  title,
  eyebrow,
  lead,
  action,
  layout = 'commerce',
  size = 'page',
  as: Heading = 'h2',
  className,
}: SectionHeaderProps) {
  const heading = (
    <Heading id={id} className={size === 'section' ? 'type-section-title' : 'type-page-title'}>
      {title}
    </Heading>
  );
  const eyebrowNode = eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null;
  const leadNode = lead ? <p className="type-body-lg measure text-text-secondary">{lead}</p> : null;

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
        {(leadNode || action) && (
          <div className="grid justify-items-start gap-5 lg:col-span-4 lg:col-start-9">
            {leadNode}
            {action}
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
        {action}
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
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/**
 * The eyebrow on its own: `type-eyebrow` in the accent colour behind a short gold
 * rule (the rule is what carries the role in Arabic, where there is no uppercase).
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('type-eyebrow flex items-center gap-3 text-brand', className)}>
      <span aria-hidden="true" className="h-px w-7 shrink-0 bg-metallic" />
      {children}
    </p>
  );
}
