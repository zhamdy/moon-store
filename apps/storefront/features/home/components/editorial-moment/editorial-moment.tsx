import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Parallax } from '@/components/motion/parallax';
import { Reveal } from '@/components/motion/reveal';
import { Container } from '@/components/ui/container';
import { editorialImages } from '@/lib/editorial/images';

/**
 * 04 — Editorial brand moment (guideline §12·04). One large portrait in a
 * parallax frame across columns 7–12; the statement, which is the section's
 * heading, spans columns 1–7 and overlaps the image by one column, block-end
 * aligned. Below 1024 the image comes first, full width, and the statement is
 * pulled up over its bottom edge so the overlap survives. No link: the
 * guideline's "Explore the story →" is an About-shaped destination (R6).
 */
export async function EditorialMoment() {
  const t = await getTranslations('home.moment');

  return (
    <Container as="section" aria-labelledby="moment-title" className="section-y">
      <div className="grid-editorial items-end">
        <Parallax className="col-span-4 aspect-4/5 bg-surface-soft lg:col-start-7 lg:col-end-13 lg:row-start-1">
          <Image
            src={editorialImages.moment.src}
            alt={t('imageAlt')}
            fill
            sizes="(min-width: 1440px) 660px, (min-width: 1024px) 48vw, 100vw"
            placeholder="blur"
            className="object-cover"
          />
        </Parallax>
        <Reveal
          as="h2"
          id="moment-title"
          effect="mask"
          className="type-display relative z-10 col-span-4 -mt-16 pe-6 text-balance lg:col-start-1 lg:col-end-8 lg:row-start-1 lg:mt-0 lg:pb-10 lg:pe-0"
        >
          <span className="block">{t('line1')}</span>
          <span className="block">{t('line2')}</span>
          <span className="block">{t('line3')}</span>
        </Reveal>
      </div>
    </Container>
  );
}
