# Moon Fashion — editorial image brief

The homepage (`apps/storefront`) composes 38 image slots. Every slot is a file in
`apps/storefront/assets/editorial/<slot>.jpg`, bound by `apps/storefront/lib/editorial/images.ts`.
The files shipped today are flat toned placeholders at the exact ratios below. To deliver
the real photography, **replace each file at the same path, at the same ratio** — no code
change is needed. A wrong-shape file is not rejected; it crops inside its CSS frame, so
check the page after a swap.

After swapping the hero or campaign, re-check that the ivory copy and the header still read
(see *Contrast zones* below). The code scrims are the guarantee; this brief is the first line
of defence.

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
| `hero-desktop` | 16:10 | 2400×1500 | hero | Full-length figure in an evening dress, standing, placed in the **upper inline-end** third; large negative space at inline-start and bottom for the copy | Dusk interior or blue-hour exterior; charcoal/ink shadows, warm skin, muted gold highlights; **dark overall** |
| `hero-mobile` | 4:5 | 1200×1500 | hero | Same shoot, tighter: figure centred-high, bottom third empty | As above, dark overall |
| `strip-01`…`strip-04` | 3:4 | 900×1200 | editorial | Four details from the shoot: fabric close-up, a hand with a bag, a hem in motion, a knit texture | Ivory/cream/stone; light, airy |
| `moment` | 4:5 | 1600×2000 | editorial | Portrait, three-quarter length, seated or leaning, quiet expression | Warm window light, cream wall |
| `featured-large` | 3:2 | 2400×1600 | editorial | Two figures or one figure in an evening look, wide environmental frame | Evening, warm lamplight, stone/gold |
| `featured-small` | 4:5 | 1200×1500 | editorial | Detail from the same evening look: jewellery, clutch, embroidery | Same light as `featured-large` |
| `category-dresses` | 3:4 | 1200×1600 | category | Dress on model, full length, neutral background | Ivory/stone |
| `category-tops` | 3:4 | 1200×1600 | category | Blouse, mid-length crop | Ivory/stone |
| `category-knitwear` | 3:4 | 1200×1600 | category | Cashmere or wool knit, texture visible | Cream/warm brown |
| `category-bags` | 3:4 | 1200×1600 | category | Leather bag held or on a surface | Stone/black |
| `category-abayas` | 3:4 | 1200×1600 | category | Abaya, full length, fabric drape emphasised | Ink/warm brown |
| `campaign` | 21:9 | 2520×1080 | editorial | Wide cinematic frame, figure small in a large environment; **left/right thirds and the vertical centre must stay dark** so a single ivory line reads across it. Mobile crops this to 4:5 around the horizontal centre — keep the figure central | Dusk, ink/charcoal dominant, muted gold accents; **dark overall** |
| `lookbook-01` | 4:5 | 1200×1500 | lookbook | Street or interior look, full length | Warm daylight |
| `lookbook-02` | 1:1 | 1200×1200 | lookbook | Detail: bag, shoe or jewellery | Warm daylight |
| `lookbook-03` | 3:4 | 1200×1600 | lookbook | Half-length portrait | Warm daylight |
| `lookbook-04` | 4:5 | 1200×1500 | lookbook | Movement: walking, fabric in motion | Warm daylight |
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

- `hero-desktop`: the **top 30%** (header band) and the **bottom-start 45% × 55%** (copy
  block) should stay at or below ~35% luminance.
- `hero-mobile`: the top 25% and the bottom 45% should stay at or below ~35% luminance.
- `campaign`: a horizontal band across the vertical centre, full width, at or below ~35%
  luminance; the mobile 4:5 crop uses the central 43% of the width.

Re-check after any swap: load `/en` and `/ar` at 1440 and 375, confirm nav text and the
hero copy pass 4.5:1 against what is actually behind them.

## Generation prompt (base)

> Editorial fashion photograph for a luxury Egyptian womenswear brand. [subject from the
> table]. Natural light, [light words from the table], palette of ivory, cream, stone,
> black, warm brown and muted gold. Calm, confident, feminine. Shot on medium format, soft
> film grain, shallow depth of field. No text, no logos, no HDR, no heavy filters, no
> watermark. Aspect ratio [ratio].
