# Moon Fashion — editorial image brief

The homepage (`apps/storefront`) composes 45 image slots. Every slot is a file in
`apps/storefront/assets/editorial/<slot>.jpg`, bound by `apps/storefront/lib/editorial/images.ts`.
Every slot holds a generated photograph (Codex image generation, 2026-09-13 and 14).
The generator's native output is about 1.5–1.9k px on the long edge, so files are
centre-cropped to the exact ratio and upscaled to the minimums below with a Lanczos filter
and light sharpening; regenerate at a higher native size when one is available. To replace
a photograph, **swap the file at the same path, at the same ratio** — no code change is
needed. A wrong-shape file is not rejected; it crops inside its CSS frame, so
check the page after a swap.

After swapping the hero or campaign, re-check that the ivory copy and the header still read
(see *Contrast zones* below). The code scrims are the guarantee; this brief is the first line
of defence.

## Asset classes

Three classes, never mixed:

- **Production** — `apps/storefront/assets/editorial/*.jpg`. Exactly the 45 files named by
  `editorialSlots` + `catalogSlots` in `apps/storefront/lib/editorial/slots.ts`, nothing more,
  nothing less. Guarded mechanically by `apps/storefront/lib/editorial/assets.test.ts`
  (`checkEditorialAssets`), which fails the storefront test gate on an orphan file, a missing
  slot or a non-`.jpg` extension.
- **Original/reference** — `docs/design/brand/`. The original logo artwork only; never
  editorial photography.
- **Source generations** — native-resolution outputs before the crop/upscale described above.
  **Pending (AD-10):** where these live is not yet decided. They do not belong in
  `apps/storefront/assets/editorial/` (that directory is production only) and are not
  currently tracked anywhere in the repository.

## Category tile direction

**Pending (AD-8):** the five `category-*.jpg` files are editorial (a model or styled still
life), not the studio/neutral look this section originally specified. Until decided, this
brief's *Slots* table below still states the original studio direction; treat it as aspirational
until AD-8 resolves, either by regenerating the tiles or by rewriting this section to describe
the editorial direction actually shipped.

## Shared art direction (guideline §10)

Warm, editorial, feminine, confident, tactile, natural light. Palette inside the frame:
ivory, cream, stone, black, warm brown, muted gold, one subtle seasonal colour at most.
Single consistent light source across the whole set; the set should read as one shoot.
The clothing is the subject: Egyptian luxury womenswear — dresses, knitwear, bags, abayas,
blouses, jackets — in the register of the seed catalogue (silk, linen, cashmere, velvet,
leather).

Negative constraints for every slot: no text, no logos, no watermarks, no HDR, no heavy
filters, no stock-photo posing, no busy or random backgrounds, no mirrored/flipped versions
of another slot (RTL is handled in layout, never by flipping photography).

Minimum pixel sizes below are the smallest acceptable; larger at the same ratio is fine.
Output as JPEG, sRGB, quality 82–90.

## Slots

| Slot | Ratio | Min px | Role | Subject / crop | Light & palette |
| --- | --- | --- | --- | --- | --- |
| `hero-desktop` | 16:10 | 2400×1500 | hero | **Evening slide.** Full-length figure in a **black velvet column gown with long sleeves**, small and centred in the middle ~16–20% of the width, feet no lower than 68%; left and right 38% calm, bottom 30% empty floor | Dark marble hall, one warm lamp; **dark overall** |
| `hero-mobile` | 4:5 | 1200×1500 | hero | Evening slide, same look: figure centred-high, bottom 45% empty floor | As above, dark overall |
| `hero-linen-desktop` | 16:10 | 2400×1500 | hero | **Linen slide.** A woman in an ivory linen dress walking through a stone courtyard, near the centre; bottom 45% empty paving across the full width | Late sun, but a **deep-shadowed** courtyard so ivory text reads; warm stone, olive, ivory; darker than the lookbook linen shots |
| `hero-linen-mobile` | 4:5 | 1200×1500 | hero | Linen slide, tighter: figure centred-high, bottom 45% empty | As above |
| `hero-abaya-desktop` | 16:10 | 2400×1500 | hero | **Abaya slide.** A woman in a flowing black abaya over a brown dress, standing by a lattice (mashrabiya) window, near the centre; bottom 45% empty floor | Dim interior lit only through the lattice; ink, warm brown, gold; **dark overall** |
| `hero-abaya-mobile` | 4:5 | 1200×1500 | hero | Abaya slide, tighter: figure centred-high, bottom 45% empty | As above |
| `hero-knitwear-desktop` | 16:10 | 2400×1500 | hero | **Knitwear slide.** A woman in a cream cashmere sweater and wide trousers, standing in window light, near the centre; bottom 45% empty floor | Low warm light with dark surroundings so the cream knit glows; cream, brown, stone; **dark overall** |
| `hero-knitwear-mobile` | 4:5 | 1200×1500 | hero | Knitwear slide, tighter: figure centred-high, bottom 45% empty | As above |
| `strip-01`…`strip-04` | 3:4 | 900×1200 | editorial | Four details from the shoot: fabric close-up, a hand with a bag, a hem in motion, a knit texture | Ivory/cream/stone; light, airy |
| `moment` | 4:5 | 1600×2000 | editorial | **Promo banner, mobile.** The current campaign (The Silk Edit): ivory silk blouse with full sleeves and a long brown linen skirt, seated, centred-high; the bottom 40% calm and not bright, because the banner copy sits there | Warm afternoon light, limestone |
| `moment-wide` | 16:9 | 2560×1440 | editorial | **Promo banner, desktop**, same look. The model in the right half, face between 60% and 75% of the width; the left 45% calm wall, because the banner copy sits there in **both** languages (never mirrored). Repurposing the banner means editing `apps/storefront/features/home/data/promo-banner.ts` (href, slots, crop position), `home.banner` copy, and replacing both banner files together — no component change | As above |
| `featured-large` | 3:2 | 2400×1600 | editorial | **The Evening Edit.** One figure in a **champagne satin bias-cut gown with long sleeves**, seated on lamplit limestone steps, in the left 60%. Must not repeat the hero or campaign garments | Night, lantern glow, champagne and stone |
| `featured-small` | 4:5 | 1200×1500 | editorial | Detail from the same moment: hands holding a **black velvet clutch with a gold clasp** against the champagne satin; no face | Same light as `featured-large` |
| `category-dresses` | 3:4 | 1200×1600 | category | Dress on model, full length, neutral background | Ivory/stone |
| `category-tops` | 3:4 | 1200×1600 | category | Blouse, mid-length crop | Ivory/stone |
| `category-knitwear` | 3:4 | 1200×1600 | category | **Chunky camel cable-knit cardigan**, shoulder-to-hip crop, texture sharp; must read differently from the Tops tile and the Knitwear hero | Warm window light, camel |
| `category-bags` | 3:4 | 1200×1600 | category | Leather bag held or on a surface | Stone/black |
| `category-abayas` | 3:4 | 1200×1600 | category | **Sand-beige crepe abaya seen from behind**, walking a limestone corridor; lower third plain for the label; must read differently from the black Abaya hero | Golden corridor light |
| `campaign` | 21:9 | 2520×1080 | editorial | "Dressed for the night." Wide dusk colonnade; the figure small in the **right third (64–80% of the width)** in a flowing umber silk dress; the **left 55% calm** for the line, bottom 15% empty paving. Mobile crops a 4:5 window centred at 72% of the width, so the figure stays in frame and the line sits at the bottom | Dusk, dark overall, warm lamps |
| `lookbook-01` | 4:5 | 1200×1500 | lookbook | Street or interior look, full length | Warm daylight |
| `lookbook-02` | 1:1 | 1200×1200 | lookbook | Detail: bag, shoe or jewellery | Warm daylight |
| `lookbook-03` | 3:4 | 1200×1600 | lookbook | Half-length portrait: **camel coat over the shoulders, black top**, leaning in a carved doorway | Soft side daylight |
| `lookbook-04` | 4:5 | 1200×1500 | lookbook | Movement: **wide black silk trousers and an ivory shirt**, climbing limestone stairs | Bright daylight, lattice shadows |
| `lookbook-05` | 1:1 | 1200×1200 | lookbook | Texture close-up | Warm daylight |
| `product-01-a` … `product-09-a` | 4:5 | 1200×1500 | catalog | Front view of each product on a model or ghost mannequin, ivory background | Even studio light, consistent across all nine |
| `product-01-b` … `product-09-b` | 4:5 | 1200×1500 | catalog | Alternate: back/side angle or a detail of the same product | Identical setup to the `a` view |

The nine products map to the mock data in `apps/storefront/features/products/data/home-products.ts`
(01 silk midi dress, 02 embroidered evening dress, 03 linen summer dress, 04 cashmere
pullover, 05 long wool cardigan, 06 cross-body leather bag, 07 velvet evening bag, 08 silk
blouse, 09 wool tailored jacket).

## Contrast zones

Ivory text (`#faf8f4`) and the gold logo sit directly on these images. Code applies a soft
ink scrim behind each text zone, tuned to be near-invisible on a correctly dark image; if
the scrim becomes visible after a swap, the image is too light there.

- Every hero desktop crop (`hero-desktop`, `hero-*-desktop`): the figure inside the middle
  ~25% of the width; the **top 30%** (header band) and the **bottom 45% across the full
  width** (copy and collection tabs) at or below ~35% luminance. The copy column covers
  roughly the left 35% in English and the right 35% in Arabic, and the photo is never
  mirrored, so the figure must not stand where either language puts the text.
- Every hero mobile crop (`hero-mobile`, `hero-*-mobile`): the top 25% and the bottom 45%
  should stay at or below ~35% luminance.
- `moment-wide`: nothing bright (window glare, lit wall) in the left 45% or the right 40%. The code
  scrim is strong, 0.72 ink at the text edge, and measured ≥5.7:1 on the current photo.
- `moment`: the bottom 40% calm; same scrim, rising from the bottom edge.
- `campaign`: the left 55% at or below ~35% luminance (the line sits there from 768), and
  the bottom 40% of the mobile 4:5 window centred at 72% of the width (the line sits there
  on phones).

Re-check after any swap: load `/en` and `/ar` at 1440 and 375, confirm nav text and the
hero copy pass 4.5:1 against what is actually behind them.

## Repetition rule

No dominant editorial image, outfit or near-identical pose repeats across the hero, promo
banner, featured collection, campaign or lookbook. This extends to **sets and props, not just
garments**: the same room, backdrop, lattice, vase, bench or other recognisable prop must not
recur across two of those sections, even in different outfits — a repeated set reads as the
same shoot reused, the same way a repeated garment does. Product-card photography may show a
garment that also appears in an editorial image, and category tiles must read clearly
differently from each other and from the hero slide of the same collection.

## Generation prompt (base)

> Editorial fashion photograph for a luxury Egyptian womenswear brand. [subject from the
> table]. Natural light, [light words from the table], palette of ivory, cream, stone,
> black, warm brown and muted gold. Calm, confident, feminine. Shot on medium format, soft
> film grain, shallow depth of field. No text, no logos, no HDR, no heavy filters, no
> watermark. Aspect ratio [ratio].
