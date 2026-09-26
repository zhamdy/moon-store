import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { buttonClassName } from '@/components/ui/button';
import { Eyebrow } from '@/components/ui/section-header';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { currentPromotion } from '@/lib/promotion/current-promotion';

/**
 * 04 — The running promotion, as the film's intermission (homepage "Shop the Film",
 * 2026-09-26; before that the Phase 2 full-bleed campaign). Its whole job is still to tell
 * a shopper what is on right now and where to spend it: the offer is **named** and it
 * **has a destination** (`currentPromotion.href`). Every string lives in the `promotion`
 * namespace; the slot, crop and destination in `lib/promotion/current-promotion.ts`,
 * which the shop bar reads too, so the two can never announce different offers.
 *
 * A compact Midnight split (`data-surface="navy"`, still the page's one nocturnal
 * moment): the copy — eyebrow, display title, body, the terms as small print, an Ivory
 * button — beside the photograph from 1024, the photograph above it below. The figure
 * stands in the photograph's right half, so the photograph is on the **physical right in
 * both languages** (the grid is `direction: ltr`, the copy restores the page direction)
 * and is never mirrored.
 */
export async function PromotionBanner() {
  const t = await getTranslations('promotion');

  return (
    <section aria-labelledby="promotion-title" data-surface="navy" className="bg-bg text-text">
      <Reveal amount={0.25} className="grid lg:grid-cols-2 lg:[direction:ltr]">
        <div
          data-motion="image"
          className="relative h-[22rem] w-full overflow-hidden md:h-[30rem] lg:order-2 lg:h-auto lg:min-h-[36rem]"
        >
          <Image
            src={editorialImages[currentPromotion.image].src}
            alt={t('imageAlt')}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            placeholder="blur"
            className={`object-cover ${currentPromotion.imageClassName}`}
          />
        </div>
        {/* The copy's inline start lines up with the page container's content edge. */}
        <div className="flex flex-col justify-center px-(--page-gutter) py-12 md:py-16 lg:order-1 lg:py-20 lg:ps-[max(var(--page-gutter),calc((100vw-var(--container-max))/2+var(--page-gutter)))] lg:pe-16 rtl:[direction:rtl] lg:rtl:ps-16 lg:rtl:pe-[max(var(--page-gutter),calc((100vw-var(--container-max))/2+var(--page-gutter)))]">
          <div data-motion="fade" className="[--motion-offset:120ms]">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
          </div>
          <h2
            id="promotion-title"
            data-motion="rise"
            className="type-display mt-5 max-w-[14ch] [--motion-offset:200ms] [--motion-rise:16px]"
          >
            {t('title')}
          </h2>
          <p data-motion="fade" className="type-body-lg mt-6 max-w-[36ch] [--motion-offset:360ms]">
            {t('body')}
          </p>
          {/* The conditions read as small print on purpose: they qualify the offer. */}
          <p
            data-motion="fade"
            className="type-caption mt-3 max-w-[44ch] text-text-secondary [--motion-offset:420ms]"
          >
            {t('terms')}
          </p>
          <div data-motion="fade" className="mt-8 [--motion-offset:520ms]">
            <Link
              href={currentPromotion.href}
              className={buttonClassName({ variant: 'primary', className: 'w-full md:w-auto' })}
            >
              {t('cta')}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
