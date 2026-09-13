import { Reveal } from '@/components/motion/reveal';
import { EditorialLink } from '@/components/ui/editorial-link';
import { cn } from '@/lib/utils/cn';

export interface SectionHeadingProps {
  /** The `h2`'s id, referenced by the section's `aria-labelledby`. */
  id: string;
  eyebrow: string;
  title: string;
  link?: { href: string; label: string };
  className?: string;
}

/**
 * The commerce sections' shared heading row: eyebrow and `h2` at inline-start,
 * an optional editorial link at inline-end. Reveals as one unit (the cards below
 * never animate — guideline §12·03 "avoid over-animating every card").
 */
export function SectionHeading({ id, eyebrow, title, link, className }: SectionHeadingProps) {
  return (
    <Reveal
      as="header"
      className={cn('flex flex-wrap items-end justify-between gap-x-8 gap-y-4', className)}
    >
      <div>
        <p className="type-label text-text-secondary">{eyebrow}</p>
        <h2 id={id} className="type-h2 mt-3">
          {title}
        </h2>
      </div>
      {link && (
        <EditorialLink href={link.href} className="mb-1">
          {link.label}
        </EditorialLink>
      )}
    </Reveal>
  );
}
