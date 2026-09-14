import { getTranslations } from 'next-intl/server';
import { ShieldCheck, Truck, Undo2, type LucideIcon } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { cn } from '@/lib/utils/cn';
import { benefits, type BenefitKey } from '../../data/benefits';

/** One icon per benefit, keyed so a new benefit fails to compile until it has one. */
const benefitIcons: Record<BenefitKey, { icon: LucideIcon; mirrorInRtl?: boolean }> = {
  // The truck faces the direction of travel, so it turns around with the text.
  delivery: { icon: Truck, mirrorInRtl: true },
  returns: { icon: Undo2, mirrorInRtl: true },
  payment: { icon: ShieldCheck },
};

/**
 * 09 — Shopping benefits (guideline §12·09), as three cards with icons (user
 * decision, 2026-09-14; the guideline asked for plain typographic items). Each
 * card is white on the ivory page with a hairline, and its icon sits in a soft
 * gold circle, the only gold here. Cards stack on mobile with the icon beside the
 * text, and sit in a row of three from 768 with the icon above.
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
              className="flex gap-5 rounded-md border border-border bg-surface p-6 md:flex-col md:gap-6 lg:p-8"
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-dark">
                <Icon
                  size={22}
                  strokeWidth={1.5}
                  aria-hidden="true"
                  className={cn(mirrorInRtl && 'rtl:-scale-x-100')}
                />
              </span>
              <div>
                <h3 className="type-h4">{t(`${key}.title`)}</h3>
                <p className="type-small mt-2 text-text-secondary">{t(`${key}.body`)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
