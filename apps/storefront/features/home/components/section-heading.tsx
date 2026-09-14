import type { CSSProperties } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { EditorialLink } from '@/components/ui/editorial-link';
import { cn } from '@/lib/utils/cn';

export interface SectionHeadingProps {
  /** The `h2`'s id, referenced by the section's `aria-labelledby`. */
  id: string;
  eyebrow: string;
  title: string;
  link?: { href: string; label: string };
  /** Milliseconds before the heading starts, for a section that shows something else first. */
  offset?: number;
  /** Render without its own Reveal, when an enclosing Reveal already triggers the section. */
  grouped?: boolean;
  className?: string;
}

const offsetStyle = (ms: number) => ({ '--motion-offset': `${ms}ms` }) as CSSProperties;

/**
 * The commerce sections' shared heading row: eyebrow and `h2` at inline-start, an
 * optional editorial link at inline-end. Plays as a sequence: the eyebrow wipes
 * in, the title's words rise through their masks, the link fades in last. The
 * link sits in its own wrapper because its underline transition would otherwise
 * replace the reveal's.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  link,
  offset = 0,
  grouped = false,
  className,
}: SectionHeadingProps) {
  const layout = cn('flex flex-wrap items-end justify-between gap-x-8 gap-y-4', className);
  const content = (
    <>
      <div>
        <p
          data-motion="wipe"
          style={offsetStyle(offset)}
          className="type-label w-fit text-text-secondary"
        >
          {eyebrow}
        </p>
        <TextReveal as="h2" id={id} text={title} offset={offset + 120} className="type-h2 mt-3" />
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
