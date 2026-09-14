import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { LocalizedText } from '@/features/products/utils/localized-name';
import { introDescription } from '../utils/intro-heading';

export interface PageIntroProps {
  locale: AppLocale;
  /**
   * The `h1`, and the only breadcrumb (KD-16): a link on category, New In and
   * collection pages ("Shop" -> `/shop`, "Collections" -> `/collections`), plain text
   * on `/shop` and `/collections` themselves (omit `href`).
   */
  heading: { label: string; href?: string };
  /**
   * The line under the `h1`: the page's own name (the category, the collection,
   * "All pieces"). Dropped when it only repeats the heading (`introDescription`).
   */
  lead: LocalizedText;
  /** Season · year on a collection page. Uppercased by `type-label` in English only. */
  meta?: string | null;
  /** One restrained line on categories; a readable measure on collections. */
  description?: LocalizedText | null;
  /** A collection's authored image: a band beside the text from 1024, above it below. */
  image?: { url: string } | null;
}

/** Only set `lang`/`dir` when the text is not in the page's language (KD-13). */
function langProps(text: LocalizedText, locale: AppLocale) {
  return text.lang === locale ? {} : { lang: text.lang, dir: 'auto' as const };
}

/**
 * The catalog page intro (KD-16): calm and typographic, no hero. No eyebrow (owner
 * decision, 2026-09-14): the former eyebrow is the `h1` in the display face, the
 * former title the line under it, then optional metadata and description and 64-96px
 * of air before the category/utility rows.
 *
 * Motion is the commerce entrance (AD-11): the title rises once and the lines under
 * it fade; no word mask. The optional image band only fades, with no parallax, scrim
 * or copy on it, so an unknown upload never carries a contrast dependency. As an
 * intro it is normally in view at mount, where Reveal leaves it visible.
 *
 * The heading link's hover lives on the link, the rise on its parent `h1`, so the
 * two transitions never share an element.
 */
export function PageIntro({ locale, heading, lead, meta, description, image }: PageIntroProps) {
  const subtitle = introDescription(heading.label, lead);
  const text = (
    <div className={image ? 'lg:col-span-5 lg:row-start-1' : 'max-w-3xl'}>
      <h1
        data-motion="rise"
        className="type-h1 text-balance [--motion-offset:120ms] [--motion-rise:24px]"
      >
        {heading.href ? (
          <Link
            href={heading.href}
            className="decoration-1 underline-offset-[0.18em] hover:underline"
          >
            {heading.label}
          </Link>
        ) : (
          heading.label
        )}
      </h1>
      {subtitle && (
        <p
          {...langProps(subtitle, locale)}
          data-motion="fade"
          className="type-body-lg mt-4 text-text-secondary [--motion-offset:240ms]"
        >
          {subtitle.text}
        </p>
      )}
      {meta && (
        <p
          data-motion="fade"
          dir="auto"
          className="type-label mt-5 text-text-secondary [--motion-offset:300ms]"
        >
          {meta}
        </p>
      )}
      {description && (
        <p
          {...langProps(description, locale)}
          data-motion="fade"
          className="type-body-lg mt-5 max-w-[38rem] text-text-secondary [--motion-offset:360ms]"
        >
          {description.text}
        </p>
      )}
    </div>
  );

  return (
    <Container as="header" className="pt-10 pb-16 md:pt-14 md:pb-20 lg:pt-16 lg:pb-24">
      {image ? (
        <Reveal className="grid gap-y-8 md:gap-y-10 lg:grid-cols-12 lg:items-end lg:gap-x-8">
          <div
            data-motion="fade"
            className="relative aspect-video max-h-[28rem] w-full overflow-hidden rounded-media bg-surface-soft [--motion-duration:900ms] lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:aspect-4/5 lg:max-h-[560px] lg:max-w-[448px] lg:justify-self-end"
          >
            {/* Decorative: the h1 beside it names the collection. Usually the
                page's largest above-the-fold image, so it loads first. */}
            <Image
              src={image.url}
              alt=""
              fill
              sizes="(min-width: 1024px) 448px, (min-width: 768px) calc(100vw - 64px), calc(100vw - 40px)"
              loading="eager"
              fetchPriority="high"
              className="object-cover"
            />
          </div>
          {text}
        </Reveal>
      ) : (
        <Reveal>{text}</Reveal>
      )}
    </Container>
  );
}
