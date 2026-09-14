import Image from 'next/image';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { Link } from '@/i18n/navigation';
import type { AppLocale } from '@/i18n/routing';
import type { LocalizedText } from '@/features/products/utils/localized-name';

export interface PageIntroProps {
  locale: AppLocale;
  /**
   * The only breadcrumb (KD-16): a quiet link on category, New In and collection
   * pages ("Shop" -> `/shop`, "Collections" -> `/collections`), plain text on
   * `/shop` and `/collections` themselves (omit `href`).
   */
  eyebrow: { label: string; href?: string };
  title: LocalizedText;
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
 * The catalog page intro (KD-16): calm and typographic, no hero. Eyebrow, `h1` in
 * the display face, optional metadata and description, then 64-96px of air before
 * the category/utility rows.
 *
 * Motion is the commerce entrance (AD-11): the eyebrow fades and the title rises
 * once; no word mask. The optional image band only fades, with no parallax, scrim
 * or copy on it, so an unknown upload never carries a contrast dependency. As an
 * intro it is normally in view at mount, where Reveal leaves it visible.
 *
 * The eyebrow link's hover lives on the link, the fade on its parent `p`, so the
 * two transitions never share an element.
 */
export function PageIntro({ locale, eyebrow, title, meta, description, image }: PageIntroProps) {
  const text = (
    <div className={image ? 'lg:col-span-5 lg:row-start-1' : 'max-w-3xl'}>
      <p data-motion="fade" className="type-label text-text-secondary">
        {eyebrow.href ? (
          <Link
            href={eyebrow.href}
            className="-my-3 inline-block py-3 underline-offset-4 transition-colors duration-fast ease-ui hover:text-text hover:underline"
          >
            {eyebrow.label}
          </Link>
        ) : (
          eyebrow.label
        )}
      </p>
      <h1
        {...langProps(title, locale)}
        data-motion="rise"
        className="type-h1 mt-4 text-balance [--motion-offset:120ms] [--motion-rise:24px]"
      >
        {title.text}
      </h1>
      {meta && (
        <p
          data-motion="fade"
          dir="auto"
          className="type-label mt-5 text-text-secondary [--motion-offset:240ms]"
        >
          {meta}
        </p>
      )}
      {description && (
        <p
          {...langProps(description, locale)}
          data-motion="fade"
          className="type-body-lg mt-5 max-w-[38rem] text-text-secondary [--motion-offset:300ms]"
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
