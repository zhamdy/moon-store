import type { CSSProperties } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { EditorialLink } from '@/components/ui/editorial-link';
import { cn } from '@/lib/utils/cn';

export interface SectionHeadingProps {
  /** The `h2`'s id, referenced by the section's `aria-labelledby`. */
  id: string;
  /** The `h2`. */
  title: string;
  /** The quiet line under it. */
  description: string;
  link?: { href: string; label: string };
  /** Milliseconds before the heading starts, for a section that shows something else first. */
  offset?: number;
  /** Render without its own Reveal, when an enclosing Reveal already triggers the section. */
  grouped?: boolean;
  className?: string;
}

const offsetStyle = (ms: number) => ({ '--motion-offset': `${ms}ms` }) as CSSProperties;

/**
 * The commerce sections' shared heading row: `h2` and a description line at
 * inline-start, an optional editorial link at inline-end. No eyebrow (owner decision,
 * 2026-09-14: the former eyebrow copy is the title, the former title the description).
 * Deliberately quiet (AD-11, 2026-09-14): the title rises once as a whole, the
 * description fades just after it, the link fades in last. The
 * word-masked rise belongs to the signature moments (promo banner, featured
 * collection, campaign) so it stays distinct; Shop and Collections inherit this
 * quieter heading. The link sits in its own wrapper because its underline
 * transition would otherwise replace the reveal's.
 */
export function SectionHeading({
  id,
  title,
  description,
  link,
  offset = 0,
  grouped = false,
  className,
}: SectionHeadingProps) {
  const layout = cn('flex flex-wrap items-end justify-between gap-x-8 gap-y-4', className);
  const content = (
    <>
      <div>
        <h2
          id={id}
          data-motion="rise"
          style={offsetStyle(offset + 120)}
          className="type-h2 [--motion-rise:24px]"
        >
          {title}
        </h2>
        <p
          data-motion="fade"
          style={offsetStyle(offset + 240)}
          className="type-body-lg mt-3 text-text-secondary"
        >
          {description}
        </p>
      </div>
      {link && (
        <div data-motion="fade" style={offsetStyle(offset + 450)} className="mb-1">
          <EditorialLink href={link.href}>{link.label}</EditorialLink>
        </div>
      )}
    </>
  );

  return grouped ? (
    <header className={layout}>{content}</header>
  ) : (
    <Reveal as="header" className={layout}>
      {content}
    </Reveal>
  );
}
