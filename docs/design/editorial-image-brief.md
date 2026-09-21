# Moon Fashion — editorial image brief

The homepage (`apps/storefront`) composes 45 image slots. Every slot is a file in
`apps/storefront/assets/editorial/<slot>.jpg`, bound by `apps/storefront/lib/editorial/images.ts`.
Every slot holds a generated photograph (Codex image generation, 2026-09-13 and 14).
The generator's native output is about 1.5–1.9k px on the long edge. The first round was
centre-cropped to the exact ratio and upscaled to the minimums below with a Lanczos filter
and light sharpening. The 16 files of the 2026-09-14 regeneration round (see below) are
**not** upscaled: they ship at native resolution, some below the minimums, which the user
accepted for that round. Regenerate at a higher native size when one is available. To replace
a photograph, **swap the file at the same path, at the same ratio** — no code change is
needed. A wrong-shape file is not rejected; it crops inside its CSS frame, so
check the page after a swap.

After swapping the hero or campaign, re-check that the ivory copy and the header still read
(see *Contrast zones* below). The code scrims are the guarantee; this brief is the first line
of defence.

## Current hero images (2026-09-20)

The four heroes now use closer editorial photography: Evening against charcoal plaster,
Linen in a sunlit courtyard, Abaya in a sandstone arcade, and Knitwear seated on a bench.
This supersedes the historical hero settings, tiny figures and empty-floor rules below.
Desktop JPEGs are 1584x990; mobile centre crops are 792x990, with no upscaling.
These native generations remain below the historical target sizes. Images are top-aligned
without the former 125% zoom; existing overlays support the bilingual copy.

## Asset classes

Three classes, never mixed:

- **Production** — `apps/storefront/assets/editorial/*.jpg`. Exactly the 45 files named by
  `editorialSlots` + `catalogSlots` in `apps/storefront/lib/editorial/slots.ts`, nothing more,
  nothing less. Guarded mechanically by `apps/storefront/lib/editorial/assets.test.ts`
  (`checkEditorialAssets`), which fails the storefront test gate on an orphan file, a missing
  slot or a non-`.jpg` extension.
- **Original/reference** — `docs/design/brand/`. The original logo artwork only; never
  editorial photography.
- **Source generations** — native-resolution outputs and rejected variants. They live in the
  user's art-direction archive **outside the repository** (AD-10, 2026-09-14): never in git,
  never in `apps/storefront/assets/editorial/`. Native masters would add tens of MB to history
  for no build value; only the final crop at the path below is committed.

## Category tile direction

Category tiles are **editorial**, not studio (AD-8, 2026-09-14): a model shot or a styled
still life that names its category at a glance, each tile in **its own setting** — never the
lattice room used by the Abaya hero — and each reading clearly differently from its
neighbours and from the hero slide of the same collection. The lower third stays calm enough
for the ivory label on its scrim.

## Regeneration round, 2026-09-14

Approved in `docs/plans/2026-09-14-001-feat-storefront-homepage-polish-freeze-plan.md`
(*Decision Outcomes*). Replace each file at its existing path, same ratio. Every file below is
delivered at or above its minimum **natively**, with no upscaling (AD-7).

Rules for every regenerated image with a model (AD-5): same model for continuity; vary the
pose (toward camera, looking down, in motion, seated or leaning) rather than the head turned
to the viewer's left; **no gold cuff** (other fine jewellery or none). No regenerated image
uses the lattice room (window screen, dark bronze vase, bench on steps), which now belongs
to the Abaya hero alone.

| File(s) | Decision | Direction |
| --- | --- | --- |
| `category-dresses.jpg`, `product-01-a.jpg`, `product-01-b.jpg` | AD-1, AD-2 | One garment across all three: an **ivory silk midi dress** (keeps the name "Silk midi dress"), feminine, premium, evening; refined neckline, no spaghetti straps, no deep V; a light sleeve (short, cap or draped). Category tile in its own setting; product views on the standard ivory studio setup |
| `hero-linen-desktop.jpg`, `hero-linen-mobile.jpg` | AD-2 | The **same ivory linen dress** as `product-03` (wide straps, square neck). Deep-shadowed stone courtyard, walking with natural movement, warm architecture, softer summer mood; clearly unlike the Evening hall, Abaya lattice room and Knitwear room |
| `hero-knitwear-desktop.jpg`, `hero-knitwear-mobile.jpg` | AD-2 | The **same cream sweater and brown wide trousers**. A darker room, low directional window light, deeper shadow, intimate autumn/winter mood |
| `lookbook-01.jpg` | AD-2 | Full-length look in warm daylight: street, terrace or a clearly different interior; natural editorial pose, not hand-in-pocket |
| `lookbook-04.jpg`, `category-tops.jpg` | AD-3 | `lookbook-04`: movement shot with a **different top** (not the ivory balloon-sleeve shirt), in a setting that is not sunlit limestone. `category-tops`: an ivory blouse is fine, in its own setting |
| `lookbook-02.jpg`, `category-bags.jpg` | AD-4 | `lookbook-02`: a **footwear detail on stone**, no bag, no cuff. `category-bags`: a **different leather bag** from `product-06` (e.g. structured top-handle, tan or brown), in its own setting |
| `moment.jpg`, `moment-wide.jpg` | AD-6 | The Silk Edit outfit stays (ivory balloon-sleeve silk shirt, long brown linen skirt). Wide: left 45% calm, shadowed, not bright. Portrait: bottom 40% calm and not patterned (the skirt must not sit behind the copy) |
| `product-05-b.jpg`, `product-09-b.jpg` | AD-9 | Clean back/alternate views: no pocket showing through the cardigan back (05), correct pocket placement on the jacket (09) |

Hero regenerations keep the hero rules below: figure centred with empty floor, clear of the
copy column in English (bottom-left) and Arabic (bottom-right), dark header band and lower
zone, both crops composed on their own rather than rescued by scrims. After they land, U4
re-checks composition and contrast at 1024 and 1440 in both locales.

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
| `moment` | Full-height portrait cover | Shared campaign source | editorial | **Silk Edit, portrait screens.** Use `silk-edit-campaign.png`, cropped at 82% horizontally to retain the model. Copy overlays a bottom espresso scrim. | Ivory silk blouse, warm brown tailored trousers, limestone |
| `moment-wide` | 16:9 | 1672 x 941 | editorial | **Silk Edit, landscape screens.** Use `silk-edit-campaign.png`: model at right, centered copy within the quiet left portion. A horizontal scrim shades only the copy area. | Warm afternoon light, natural silk sheen |
| `featured-large` | 3:2 | 2400×1600 | editorial | **The Evening Edit.** One figure in a **champagne satin bias-cut gown with long sleeves**, seated on lamplit limestone steps, in the left 60%. Must not repeat the hero or campaign garments | Night, lantern glow, champagne and stone |
| `featured-small` | 4:5 | 1200×1500 | editorial | Detail from the same moment: hands holding a **black velvet clutch with a gold clasp** against the champagne satin; no face | Same light as `featured-large` |
| `category-dresses` | 3:4 | 1200×1600 | category | Dress on model, full length, neutral background | Ivory/stone |
| `category-tops` | 3:4 | 1200×1600 | category | Blouse, mid-length crop | Ivory/stone |
| `category-knitwear` | 3:4 | 1200×1600 | category | **Chunky camel cable-knit cardigan**, shoulder-to-hip crop, texture sharp; must read differently from the Tops tile and the Knitwear hero | Warm window light, camel |
| `category-bags` | 3:4 | 1200×1600 | category | Leather bag held or on a surface | Stone/black |
| `category-abayas` | 3:4 | 1200×1600 | category | **Sand-beige crepe abaya seen from behind**, walking a limestone corridor; lower third plain for the label; must read differently from the black Abaya hero | Golden corridor light |
| `campaign` | 21:9 | 2520×1080 | editorial | "Dressed for the night." Wide dusk colonnade; the figure small in the **right third (64–80% of the width)** in a flowing umber silk dress; the **left 55% calm** for the line, bottom 15% empty paving. Mobile crops a 4:5 window centred at 72% of the width, so the figure stays in frame and the line sits bottom-left in both languages, never across the figure | Dusk, dark overall, warm lamps |
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
- `moment-wide`: keep the model at right and the left copy area calm; a horizontal
  espresso scrim provides contrast without dimming the blouse.
- `moment`: crop around the model at 82% horizontally; the image fills the mobile
  section and a bottom scrim protects the overlaid copy.
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
