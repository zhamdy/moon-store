import type { CSSProperties } from 'react';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { EditorialLink } from '@/components/ui/editorial-link';
import { SectionHeader } from '@/components/ui/section-header';
import { CategoryTile } from '@/features/collections/components/category-tile';
import { homeCategories } from '@/features/collections/data/home-categories';
import { Link } from '@/i18n/navigation';
import { editorialImages } from '@/lib/editorial/images';

const HEADING_ID = 'categories-title';
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * 06 - Shop by category (homepage Phase 2, 2026-09-25: the Claude Design board). A
 * lead photograph and an index, not a grid of five equal tiles: the first category
 * opens as a large `CategoryTile`, and the other four are rows — a small 4:5
 * thumbnail, the index number, the name in display type and an arrow — between
 * hairlines. From 1024 the two sit side by side and the four rows share the lead
 * tile's height; below it the tile comes first and the rows follow, so there is no
 * sideways rail any more and nothing to scroll past.
 *
 * Commerce register, so the motion is calm: the header rises 16px, the lead tile's
 * photograph wipes open once, the rows fade in 70ms apart. Hover on a row scales its
 * thumbnail to 1.04 inside the frame and slides the arrow 4px along the reading
 * direction; hover and entrance never share an element. No Bronze anywhere.
 *
 * The section opens under a hairline rule, because it follows the Featured collection
 * on the same Ivory ground.
 */
export async function CategoryGrid() {
  const t = await getTranslations('home.categories');
  const tc = await getTranslations('categories');
  const [lead, ...rest] = homeCategories;

  return (
    <Container as="section" aria-labelledby={HEADING_ID} className="pb-(--section-space-commerce)">
      <Reveal className="border-t border-border pt-(--section-space-commerce) [--motion-step:70ms]">
        <SectionHeader
          id={HEADING_ID}
          title={t('eyebrow')}
          lead={t('title')}
          motion="calm"
          action={
            <EditorialLink href="/shop" underline="always">
              {t('link')}
            </EditorialLink>
          }
          className="lg:mb-16"
        />
        <div className="grid gap-6 lg:grid-cols-2">
          <CategoryTile
            category={lead}
            label={tc(lead.messageKey)}
            index={pad(1)}
            cta={t('shopCategory', { category: tc(lead.messageKey) })}
            sizes="(min-width: 1440px) 660px, (min-width: 1024px) 48vw, 100vw"
            className="aspect-4/5 md:aspect-3/2 lg:aspect-[66/76]"
          />
          <ul role="list" className="grid border-t border-border lg:grid-rows-4">
            {rest.map((category, index) => (
              <li
                key={category.key}
                data-motion="fade"
                className="border-b border-border"
                style={{ '--motion-stagger': index + 1 } as CSSProperties}
              >
                <Link
                  href={category.href}
                  className="group grid h-full min-h-28 grid-cols-[4rem_2rem_1fr_auto] items-center gap-4 py-3 md:grid-cols-[6rem_3rem_1fr_auto] lg:grid-cols-[8.5rem_3.5rem_1fr_auto] lg:gap-6"
                >
                  <span className="relative isolate block aspect-4/5 overflow-hidden rounded-media bg-surface-media">
                    <Image
                      src={editorialImages[category.image].src}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 136px, 96px"
                      placeholder="blur"
                      className="object-cover transition-transform duration-base ease-ui group-hover:scale-[1.04]"
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="type-caption tabular-nums text-text-secondary"
                    dir="ltr"
                  >
                    {pad(index + 2)}
                  </span>
                  <span className="type-page-title">{tc(category.messageKey)}</span>
                  <ArrowRight
                    aria-hidden="true"
                    size={20}
                    strokeWidth={1.5}
                    className="transition-transform duration-fast ease-ui group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </Container>
  );
}
