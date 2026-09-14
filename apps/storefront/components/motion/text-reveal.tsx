import type { CSSProperties, HTMLAttributes } from 'react';

export interface TextRevealProps extends Omit<HTMLAttributes<HTMLHeadingElement>, 'children'> {
  /** Headings only: they are the elements allowed to take the `aria-label` that names the split text. */
  as?: 'h2' | 'h3';
  text: string;
  /** Delay before the first word, in ms, on top of any inherited stagger. */
  offset?: number;
  /** Delay between words, in ms. */
  step?: number;
  /** Each word's rise, in ms; the stylesheet's default when omitted. */
  duration?: number;
}

/**
 * A masked headline for a `<Reveal>`: each word rises through its own mask, one
 * after another. A Server Component; it only emits markup, and the parent
 * Reveal's state plays it ("Scroll reveal" in app/globals.css).
 *
 * Split by word rather than by rendered line, because where a line breaks depends
 * on the locale, the font and the viewport, and measuring it would need client JS.
 * A short step makes the words of one line read as a line arriving. Splitting at
 * spaces never breaks Arabic joining, which happens only inside a word.
 *
 * The heading is named by `aria-label` and the word spans are `aria-hidden`, so a
 * screen reader hears one heading rather than a list of fragments.
 */
export function TextReveal({
  as: Component = 'h2',
  text,
  offset = 0,
  step = 70,
  duration,
  ...props
}: TextRevealProps) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <Component {...props} aria-label={text}>
      {words.map((word, index) => (
        <span key={index}>
          {index > 0 && ' '}
          <span data-motion-mask="" aria-hidden="true">
            <span
              data-motion="word"
              style={
                {
                  '--motion-i': index,
                  '--motion-offset': `${offset}ms`,
                  '--word-step': `${step}ms`,
                  ...(duration ? { '--motion-duration': `${duration}ms` } : {}),
                } as CSSProperties
              }
            >
              {word}
            </span>
          </span>
        </span>
      ))}
    </Component>
  );
}
