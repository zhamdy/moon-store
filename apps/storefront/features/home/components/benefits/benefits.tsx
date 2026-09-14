import { getTranslations } from 'next-intl/server';
import { ShieldCheck, Truck, Undo2, type LucideIcon } from 'lucide-react';
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

/**
 * 09 — Shopping benefits (guideline §12·09), as centred cream cards (user decision,
 * 2026-09-14; the guideline asked for plain typographic items). Soft cream cards on
 * the ivory page with no border and generous padding: a large gold-brown line icon
 * on top, then the title and one line, all centred. Stacked on mobile, three in a
 * row from 768, equal height.
 *
 * Nothing is interactive, so the cards have no hover state. The list stays a
 * `<ul>`, each title an `h3` under the screen-reader-only `h2`, and the icons are
 * decorative (`aria-hidden`) because the titles say the same thing.
 */
export async function Benefits() {
  const t = await getTranslations('home.benefits');

  return (
    <Container as="section" aria-labelledby="benefits-title" className="pb-(--section-space)">
      <h2 id="benefits-title" className="sr-only">
        {t('heading')}
      </h2>
      <ul className="grid gap-4 md:grid-cols-3 md:gap-6">
        {benefits.map((key) => {
          const { icon: Icon, mirrorInRtl } = benefitIcons[key];
          return (
            <li
              key={key}
              className="flex flex-col items-center rounded-lg bg-surface-soft px-6 py-10 text-center lg:px-10 lg:py-14"
            >
              <Icon
                size={36}
                strokeWidth={1.25}
                aria-hidden="true"
                className={cn('text-brand-dark', mirrorInRtl && 'rtl:-scale-x-100')}
              />
              <h3 className="type-h4 mt-6">{t(`${key}.title`)}</h3>
              <p className="type-small mt-3 max-w-[30ch] text-text-secondary">{t(`${key}.body`)}</p>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
