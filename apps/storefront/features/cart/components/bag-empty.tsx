import type { ReactNode, RefObject } from 'react';

export interface BagEmptyProps {
  /** Focused when the last line leaves (the controller's hand-off), so it takes `tabIndex=-1`. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  title: string;
  body: string;
  /** The category photographs, server-rendered by the page; absent, the state still reads. */
  directory?: ReactNode;
  /** One way forward: Continue shopping. */
  action: ReactNode;
}

/**
 * The empty bag on `/bag` and `/checkout` ("Directory", owner decision 2026-09-27): under a
 * hairline, the title, "Start with a category.", the five categories as photographs with
 * their piece counts, then Continue shopping. The drawer says the same with rows. A dead end
 * becomes a way into the shop; nothing on it is a product claim.
 */
export function BagEmpty({ headingRef, title, body, directory, action }: BagEmptyProps) {
  return (
    <div className="border-t border-border pt-8 md:pt-10">
      <h2 ref={headingRef} tabIndex={-1} className="type-title text-balance focus:outline-none">
        {title}
      </h2>
      <p className="type-body mt-2 text-text-secondary">{body}</p>
      {directory && <div className="mt-6 max-w-3xl md:mt-8">{directory}</div>}
      <div className="mt-8">{action}</div>
    </div>
  );
}
