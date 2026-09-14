import { getTranslations } from 'next-intl/server';
import { ShieldCheck, Truck, Undo2, type LucideIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';
import { benefits, type BenefitKey } from '../../data/benefits';

/** One icon per benefit, keyed so a new benefit fails to compile until it has one. */
const benefitIcons: Record<BenefitKey, { icon: LucideIcon; mirrorInRtl?: boolean }> = {
  // The truck and the return arrow point along the reading direction, so they turn with it.
  delivery: { icon: Truck, mirrorInRtl: true },
  returns: { icon: Undo2, mirrorInRtl: true },
  payment: { icon: ShieldCheck },
};

/** 0, 120 and 240ms: the calmest stagger on the page. */
const ITEM_STAGGER = ['', '[--motion-stagger:1]', '[--motion-stagger:2]'];

/**
 * 09 - Shopping benefits, kept restrained: a full-width cream band, three items
 * separated by fine rules, a small line icon, a title and one line each. No
 * boxes, no rounded cards, no shadows. The rules run between columns from 768 and
 * between rows below it; they are logical borders, so they sit correctly in RTL.
 *
 * Motion is equally quiet: the three items rise 32px one after another and each
 * icon fades in just after its text. No bounce, no scale.
 *
 * Nothing is interactive, so there is no hover state. The list is a `<ul>`, each
 * title an `h3` under the screen-reader-only `h2`, and the icons are decorative
 * (`aria-hidden`) because the titles say the same thing. The wording is generic on
 * purpose and still awaits confirmation against the real delivery and returns
 * policy (see `features/home/data/benefits.ts`).
 */
export async function Benefits() {
  const t = await getTranslations('home.benefits');

  return (
    <section aria-labelledby="benefits-title" className="bg-surface-soft">
      <Container as="div" className="py-16 lg:py-20">
        <h2 id="benefits-title" className="sr-only">
          {t('heading')}
        </h2>
        <Reveal
          as="ul"
          amount={0.2}
          className="grid divide-y divide-border [--motion-rise:32px] [--motion-step:120ms] md:grid-cols-3 md:divide-x md:divide-y-0"
        >
          {benefits.map((key, index) => {
            const { icon: Icon, mirrorInRtl } = benefitIcons[key];
            return (
              <li
                key={key}
                data-motion="rise"
                className={cn(
                  'flex flex-col items-center px-6 py-8 text-center first:pt-0 last:pb-0 md:py-2 md:first:pt-2 md:last:pb-2 lg:px-10',
                  ITEM_STAGGER[index % ITEM_STAGGER.length]
                )}
              >
                <Icon
                  size={26}
                  strokeWidth={1.25}
                  aria-hidden="true"
                  data-motion="fade"
                  className={cn(
                    'text-brand-dark [--motion-offset:200ms]',
                    mirrorInRtl && 'rtl:-scale-x-100'
                  )}
                />
                <h3 className="type-h4 mt-5">{t(`${key}.title`)}</h3>
                <p className="type-small mt-2 max-w-[30ch] text-text-secondary">
                  {t(`${key}.body`)}
                </p>
              </li>
            );
          })}
        </Reveal>
      </Container>
    </section>
  );
}
