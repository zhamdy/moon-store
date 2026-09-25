import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { TextReveal } from '@/components/motion/text-reveal';
import { buttonClassName } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { Eyebrow } from '@/components/ui/section-header';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';
import { currentPromotion } from '@/lib/promotion/current-promotion';

/**
 * 07 - The running promotion, in the homepage's campaign slot (user decisions,
 * 2026-09-21; kept in homepage Phase 2, plan D2). Its whole job is to tell a shopper
 * what is on right now and where to spend it: the offer is **named** ("Buy one, get
 * one free") and it **has a destination** (`currentPromotion.href`, reasoned there).
 * Everything it says lives in the `promotion` namespace in both catalogues; the slot,
 * crop and destination live in `lib/promotion/current-promotion.ts`, which the shop
 * bar reads too, so the two surfaces can never announce different offers.
 *
 * **Phase 2 (2026-09-25, the Claude Design board): the page's one nocturnal moment.**
 * On Midnight (`data-surface="navy"`, plan D6) so it is never read as a twin of the
 * Silk Edit's Espresso four sections earlier. The photograph runs full-bleed across the
 * top and fades into the Midnight ground; the offer's eyebrow and oversized title
 * (`type-display` / `type-display-xl`) rise across that edge from 1024, and the body,
 * the conditions and an Ivory button sit in the right-hand columns below. Below 1024
 * nothing covers the photograph: it fades out and the copy follows on Midnight.
 *
 * Composition follows the photograph, which is never mirrored: the figure stands in
 * the right half, so the title block stays on the **physical left in both languages**
 * (the grid is laid out `direction: ltr` and each block restores the page direction),
 * and the wash that carries it is physical too.
 *
 * `w-full` beside the height cap is load-bearing (CLAUDE.md → Learnings, 2026-09-21),
 * and `sizes` is height-driven below 768, where a wide source covers a tall frame.
 */
export async function PromotionBanner() {
  const t = await getTranslations('promotion');

  return (
    <section
      aria-labelledby="promotion-title"
      data-surface="navy"
      className="relative isolate overflow-hidden bg-bg pb-16 text-text md:pb-20 lg:pb-28"
    >
      <Reveal amount={0.25}>
        <div className="relative">
          <Parallax travel={0.06} className="relative h-[27.5rem] w-full md:h-[34rem] lg:h-[40rem]">
            <div
              data-motion-zoom=""
              className="absolute inset-0 [--motion-duration:2000ms] [--motion-zoom:1.05]"
            >
              <Image
                src={editorialImages[currentPromotion.image].src}
                alt={t('imageAlt')}
                fill
                sizes="(min-width: 768px) 100vw, max(100vw, 120svh)"
                placeholder="blur"
                className={`object-cover ${currentPromotion.imageClassName}`}
              />
            </div>
          </Parallax>
          {/* 1024+: a wash from the physical left, where the title rises. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 hidden w-2/3 bg-linear-to-r from-bg/85 from-0% via-bg/40 via-60% to-transparent lg:block"
          />
          {/* Every width: the photograph fades into the Midnight ground. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-2/5 bg-linear-to-t from-bg to-transparent"
          />
        </div>

        <Container
          as="div"
          className="relative z-20 grid-editorial gap-y-6 pt-4 lg:-mt-80 lg:pt-0 rtl:[direction:ltr]"
        >
          <div className="col-span-4 md:col-span-8 lg:col-span-8 rtl:[direction:rtl] lg:rtl:text-left">
            <div
              data-motion="fade"
              className="[--motion-offset:180ms] lg:rtl:flex lg:rtl:justify-end"
            >
              <Eyebrow>{t('eyebrow')}</Eyebrow>
            </div>
            <TextReveal
              as="h2"
              id="promotion-title"
              text={t('title')}
              offset={320}
              step={120}
              duration={1000}
              className="type-display lg:type-display-xl mt-5 max-w-[12ch] text-text lg:mt-6 lg:rtl:ms-auto lg:rtl:max-w-[14ch]"
            />
          </div>
          <div className="col-span-4 md:col-span-6 lg:col-span-4 lg:col-start-9 lg:row-start-2 lg:mt-4 rtl:[direction:rtl]">
            <p data-motion="fade" className="type-body-lg text-text [--motion-offset:760ms]">
              {t('body')}
            </p>
            {/* The conditions read as small print on purpose: they qualify the offer,
                they do not sell it. */}
            <p
              data-motion="fade"
              className="type-caption mt-4 text-text-secondary [--motion-offset:860ms]"
            >
              {t('terms')}
            </p>
            <div data-motion="fade" className="mt-8 [--motion-offset:960ms]">
              <Link
                href={currentPromotion.href}
                className={buttonClassName({ variant: 'primary', className: 'w-full md:w-auto' })}
              >
                {t('cta')}
              </Link>
            </div>
          </div>
        </Container>
      </Reveal>
    </section>
  );
}
