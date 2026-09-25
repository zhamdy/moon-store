import { getTranslations } from 'next-intl/server';
import { Gem, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';
import { benefits, type BenefitKey } from '../../data/benefits';

/** One icon per benefit, keyed so a new benefit fails to compile until it has one. */
const benefitIcons: Record<BenefitKey, { icon: LucideIcon; mirrorInRtl?: boolean }> = {
  // The truck points along the reading direction, so it turns with it.
  delivery: { icon: Truck, mirrorInRtl: true },
  // Neutral while B-2 is open: the key stays `returns` so a confirmed policy can
  // restore its copy, but a return arrow would imply a service nobody has promised.
  returns: { icon: Gem },
  payment: { icon: ShieldCheck },
};

/**
 * 09 - Shopping benefits (homepage Phase 2, 2026-09-25: the Claude Design board). A
 * quiet Sand band: the heading, now visible, in the first of four columns from 1024,
 * then the three items, each opened by an inline-start hairline (a logical border, so
 * it sits correctly in RTL). Below 1024 the heading comes first and the items stack
 * between hairlines. A small line icon in the text colour (no Bronze), the title in
 * the UI face, one line of supporting copy. No boxes, no cards, no shadows.
 *
 * Still: one fade for the whole row, nothing else moves (the calm register).
 *
 * Nothing is interactive, so there is no hover state. Each title is an `h3` under the
 * section's `h2`; the icons are decorative (`aria-hidden`). The wording is generic on
 * purpose and still awaits confirmation against the real delivery and payment policy
 * (see `features/home/data/benefits.ts`).
 */
export async function Benefits() {
  const t = await getTranslations('home.benefits');

  return (
    <section aria-labelledby="benefits-title" data-surface="sand" className="bg-bg text-text">
      <Container as="div" className="section-y-commerce">
        <Reveal
          effect="fade"
          amount={0.3}
          className="grid gap-y-8 lg:grid-cols-4 lg:items-center lg:gap-x-6"
        >
          <h2 id="benefits-title" className="type-title">
            {t('heading')}
          </h2>
          <ul role="list" className="grid md:grid-cols-3 lg:col-span-3">
            {benefits.map((key) => {
              const { icon: Icon, mirrorInRtl } = benefitIcons[key];
              return (
                <li
                  key={key}
                  className="grid content-start gap-2.5 border-t border-border py-6 first:border-t-0 first:pt-0 md:border-s md:border-t-0 md:px-6 md:py-2 md:first:border-s md:first:pt-2 lg:px-10"
                >
                  <Icon
                    size={20}
                    strokeWidth={1.3}
                    aria-hidden="true"
                    className={cn('text-text', mirrorInRtl && 'rtl:-scale-x-100')}
                  />
                  <h3 className="type-product-title text-text">{t(`${key}.title`)}</h3>
                  <p className="type-supporting max-w-[34ch] text-text-secondary">
                    {t(`${key}.body`)}
                  </p>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
