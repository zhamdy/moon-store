# Moon Fashion — Website Design Guideline

> **Purpose:** This file is the visual and interaction reference for the Moon Fashion storefront.  
> **Brand name:** Moon Fashion  
> **Project/codebase name:** Moon Store  
> **Primary goal:** Build a fashion-first e-commerce experience that feels elegant, editorial, feminine, modern, and alive through motion without becoming visually noisy.

---

## 1. Reference Hierarchy

Use the references for **direction**, not for pixel-for-pixel copying.

### Primary motion reference
**Modévo**  
https://modevo-fashion.webflow.io/

Use it mainly for:
- bold entrance choreography
- scroll-based image movement
- text/image reveals
- marquee-style motion
- overlapping editorial compositions
- transitions that make the homepage feel alive
- strong pacing between large visual sections

**Important:** Moon Fashion should borrow the *energy and motion language*, not copy Modévo's layout, colors, typography, or exact animations.

### Secondary visual / commerce references

**Astral Threads**  
https://astral-threads.webflow.io/

Use it for:
- modern fashion editorial layout
- confident typography
- strong product storytelling
- full-width visual moments
- collections and featured product presentation
- restrained luxury styling

**Bella**  
https://bella-template.webflow.io/

Use it for:
- clear e-commerce hierarchy
- category browsing
- bestsellers / promotions / newsletter structure
- simple and familiar shopping UX

**Vessa**  
https://vessa-template.webflow.io/

Use it for:
- spacious product presentation
- asymmetrical fashion compositions
- clean section rhythm
- premium but approachable layout
- image-led category and campaign sections

---

# 2. Brand Personality

Moon Fashion should feel:

- feminine
- elegant
- modern
- warm
- premium
- confident
- editorial
- clean
- fashion-first
- polished without feeling inaccessible

The design should **not** feel:

- like a SaaS dashboard
- like a generic Shopify theme
- overly glamorous or wedding-oriented
- overloaded with gold
- overly rounded
- glassmorphic
- neon
- crowded
- template-like

A useful mental model:

> **Editorial fashion magazine + modern online boutique + subtle cinematic motion.**

---

# 3. Core Design Principles

## 3.1 Let photography lead

Fashion photography should occupy a large portion of the visual hierarchy.

Do not place every image inside a card.

Use:
- full-bleed campaign imagery
- large portrait product photography
- editorial crops
- image pairs
- asymmetric compositions
- occasional overlapping images
- intentional negative space

---

## 3.2 Use gold as jewelry, not wallpaper

The logo has a warm gold identity. Keep it special.

Gold should appear in:
- logo
- small accents
- fine rules
- active indicators
- decorative icons
- subtle hover states
- occasional highlighted copy

Do **not** use gold as the background of every button, card, heading, or section.

---

## 3.3 Fewer components, stronger composition

Avoid repeating:

`heading + paragraph + 4 rounded cards`

for every section.

Prefer changing visual rhythm:

- full-width image
- split editorial section
- oversized typography
- product grid
- horizontal marquee
- campaign panel
- image with floating copy
- restrained text-only section

---

## 3.4 Motion should support the fashion story

Animation should feel smooth, deliberate, and luxurious.

It should never make shopping harder.

Motion hierarchy:

1. Hero / campaign motion
2. Section reveal motion
3. Image movement
4. Product hover motion
5. Micro-interactions

Do not animate everything equally.

---

# 4. Color System

The palette is built around the current Moon Fashion logo.

## Core brand colors

```css
:root {
  --moon-ink: #171513;
  --moon-charcoal: #2D2925;

  --moon-ivory: #FAF8F4;
  --moon-cream: #F4EFE8;
  --moon-white: #FFFFFF;

  --moon-gold: #B79564;
  --moon-gold-light: #D8C09D;
  --moon-gold-soft: #EEE3D2;
  --moon-gold-dark: #7A5B34;

  --moon-stone-100: #F1EEEA;
  --moon-stone-200: #E3DED8;
  --moon-stone-400: #AAA39C;
  --moon-stone-600: #6D6660;
}
```

The primary gold `#B79564` is close to the visual gold used in the current Moon Fashion logo.

## Recommended usage

| Role | Color |
|---|---|
| Main page background | `#FAF8F4` |
| Clean product areas | `#FFFFFF` |
| Main text | `#171513` |
| Secondary text | `#6D6660` |
| Borders | `#E3DED8` |
| Decorative gold | `#B79564` |
| Gold text on light backgrounds | `#7A5B34` |
| Soft highlighted sections | `#F4EFE8` |

### Approximate visual ratio

- **65–75%** ivory / white
- **20–25%** ink / neutral
- **5–10%** gold

Do not use metallic CSS gradients for normal UI.

Metallic treatments are acceptable only in:
- logo artwork
- campaign artwork
- decorative brand moments

---

# 5. Typography

The typography should combine an editorial fashion serif with a clean UI sans-serif.

## English

### Display / editorial
**Bodoni Moda**

Use for:
- hero titles
- major campaign statements
- collection titles
- editorial quotations
- large numbers

### UI / body
**Manrope**

Use for:
- navigation
- buttons
- body copy
- prices
- product names
- filters
- forms
- checkout

## Arabic, if Arabic is supported

### Display
**Noto Serif Arabic**

### UI / body
**IBM Plex Sans Arabic**

Do not force the English serif style onto Arabic if it hurts readability.

---

## Type scale

### Desktop

```text
Display XL      80–112px
Display         64–80px
H1              52–64px
H2              40–52px
H3              28–36px
H4              22–26px
Body Large      18–20px
Body            16px
Small           14px
Caption         12px
```

### Mobile

```text
Display         48–64px
H1              40–48px
H2              32–40px
H3              24–30px
Body            16px
Small           14px
```

### Typography rules

- Keep large editorial headings relatively tight.
- Use generous line-height for body copy.
- Uppercase may be used for small labels, navigation, and collection metadata.
- Use letter spacing carefully on uppercase labels.
- Avoid using serif fonts for dense UI or long product information.

---

# 6. Grid, Width and Spacing

## Main grid

Use a **12-column desktop grid**.

```css
--container-max: 1440px;
```

Recommended page padding:

```text
≥ 1440px        64px
1024–1439px     40–48px
768–1023px      28–32px
< 768px         18–20px
```

Some campaign sections may intentionally break the container and go full bleed.

---

## Section spacing

```text
Desktop      112–176px
Tablet       88–128px
Mobile       64–96px
```

Do not compress sections just to fit more content above the fold.

Whitespace is part of the brand.

---

## Spacing scale

```text
4
8
12
16
24
32
40
48
64
80
96
128
160
```

---

# 7. Shape Language

Moon Fashion should use restrained geometry.

## Border radius

```css
--radius-xs: 2px;
--radius-sm: 4px;
--radius-md: 8px;
--radius-lg: 12px;
--radius-pill: 999px;
```

Rules:
- Product imagery: `0–8px`
- Buttons: `2–6px`
- Inputs: `4–8px`
- Tags/chips: pill radius is acceptable
- Avoid giant `24–32px` rounded cards everywhere

---

## Borders

Prefer:

```css
1px solid #E3DED8;
```

over heavy shadows.

---

## Shadows

Keep shadows nearly invisible.

Use shadows only for:
- floating navigation
- cart drawer
- modal
- image overlap when needed

Avoid large blurry SaaS-style shadows.

---

# 8. Navigation

## Desktop

Keep the header minimal.

Suggested structure:

```text
Shop   New In   Collections        MOON FASHION        Search   Account   Bag
```

or:

```text
MOON FASHION

Shop   New In   Collections   About               Search   Account   Bag
```

Recommended height:

```text
72–84px
```

### Homepage behavior

Preferred:

1. Header begins transparent over the hero.
2. Text/icons switch depending on hero contrast.
3. After scrolling, header becomes ivory/white.
4. Add a subtle bottom border.
5. Use a smooth but fast transition.

No oversized navigation chrome.

---

## Mobile

Use:

```text
Menu      Logo / Symbol      Search      Bag
```

The menu should open with a refined full-screen or large-sheet transition.

Avoid a tiny generic dropdown.

---

# 9. Buttons and Links

## Primary button

Use dark ink rather than gold by default.

```css
background: #171513;
color: #FFFFFF;
min-height: 48px;
padding-inline: 28px;
border-radius: 4px;
```

Hover:
- slight background lift toward charcoal
- optional arrow movement
- no bouncing

## Secondary button

```css
background: transparent;
border: 1px solid #171513;
color: #171513;
```

## Editorial text link

```text
Explore Collection →
```

Use:
- underline reveal
- arrow shift
- subtle gold accent when appropriate

Avoid having many different button styles.

---

# 10. Image Direction

## Mood

Photography should feel:
- warm
- editorial
- feminine
- confident
- clean
- tactile
- natural

Preferred palette inside photography:
- ivory
- cream
- stone
- black
- warm brown
- muted gold
- subtle seasonal color

Avoid:
- obvious stock-photo styling
- oversaturated HDR
- random backgrounds
- inconsistent lighting
- excessive filters

---

## Product photography

Preferred catalog ratio:

```text
4:5
```

Secondary:

```text
3:4
```

Keep the catalog consistent.

Use a second image on hover where useful:

```text
product front → model / alternate angle / detail
```

---

# 11. Product Cards

Product cards should feel lightweight.

Structure:

```text
[ large product image ]

Product Name
1,250 EGP

optional color swatches
```

Optional elements:
- New
- Limited
- Sale
- wishlist icon

Avoid:
- giant permanent Add to Cart buttons
- multiple badges at once
- large shadows
- dense metadata
- stock quantities
- SKU on listing cards

The image is the star.

---

# 12. Homepage Direction

The homepage should be strongly image-led and motion-led.

Recommended structure:

## 01 — Hero

Large cinematic fashion hero.

Possible formats:
- full viewport image
- split-screen editorial image + statement
- image composition with 2–3 controlled layers

Content should stay minimal:

```text
NEW COLLECTION

Moonlight, redefined.

A refined wardrobe for modern femininity.

[ Explore Collection ]
```

### Hero motion

On page load:

```text
0ms       background / image appears
100ms     image gently scales from ~1.05 → 1
200ms     label reveals
300ms     title reveals line-by-line
450ms     body copy reveals
550ms     CTA reveals
```

Total sequence should generally finish within **900–1200ms**.

Do not make users wait through an intro animation before they can interact.

---

## 02 — Moving editorial / collection strip

Inspired by the energy of Modévo.

Possible treatment:
- continuous horizontal marquee
- moving image strip
- collection names crossing the screen
- image and oversized typography moving at slightly different speeds

Keep movement slow and elegant.

---

## 03 — New Arrivals

Full-width heading with the collection link and arrow controls, above a uniform
portrait product rail. Keep the existing ivory, ink and bronze palette.

- Desktop: three equal cards and a glimpse, capped at 355px per card so wider
  screens reveal more of the next product instead of enlarging the photographs.
- Tablet: two cards and a glimpse; phone: one generous card and a glimpse.
- Stack product name and price; keep Add to Bag visible below each caption.
- Manual swipe/drag and arrows, no autoplay. Progress rule below the products.
- Use the existing shared entrance and image hover motion.

---

## 04 — Editorial Brand Moment

Use one large fashion image plus oversized statement text.

Example composition:

```text
                  [ LARGE PORTRAIT IMAGE ]

Designed for the
moments between
ordinary and unforgettable.

                         Explore the story →
```

This section should not look like a card.

---

## 05 — Featured Collection

Use a more experimental editorial layout.

Example:

```text
[ large image              ]

             The Evening Edit

             [ smaller image ]

                           Discover →
```

Allow overlap on desktop, but simplify on mobile.

---

## 06 — Shop by Category

Use image-led categories.

Examples:
- Dresses
- Tops
- Bottoms
- Outerwear
- Accessories

Do not use generic icon cards.

---

## 07 — Campaign / Full-Bleed Image

Large full-width fashion visual.

Minimal overlay text.

This section creates a visual pause between commerce-heavy sections.

---

## 08 — Best Sellers / Trending

Simple product presentation.

No duplicate visual treatment if New Arrivals already uses a standard grid. Consider:
- horizontal product rail
- editorial 3-column composition
- one featured item + smaller products

---

## 09 — Brand Values / Shopping Benefits

Use only real business benefits.

Examples:
- Easy returns
- Secure payment
- Fast delivery
- Customer support

Keep this visually restrained.

---

## 10 — Social / Lookbook

Prefer fashion imagery over generic social cards.

Possible:
- horizontal reel
- 3–5 image mosaic
- draggable image strip

---

## 11 — Newsletter

Large editorial closing statement.

Example:

```text
Stay in the Moonlight.

New arrivals, private offers,
and seasonal edits.

[ Email address                       → ]
```

---

## 12 — Footer

Keep it spacious.

Include:
- logo
- shop links
- customer care
- social links
- policies
- newsletter if not already above
- copyright

Use ivory or deep ink background.

---

# 13. Motion System

## Primary principle

**Motion should feel cinematic, not playful.**

Use movement to create:
- depth
- pace
- reveal
- continuity
- editorial drama

---

## Page-load motion

Allowed:
- masked text reveal
- image scale-in
- subtle opacity reveal
- clip-path / overflow reveal
- controlled stagger

Avoid:
- loaders longer than necessary
- spinning logos
- bouncy entrances
- dramatic 3D flips

---

## Scroll reveal

Typical reveal:

```text
opacity: 0 → 1
translateY: 24–40px → 0
duration: 500–800ms
```

For editorial headings:
- line-by-line mask reveal
- stagger `60–120ms`

Use sparingly.

---

## Image parallax

Use subtle parallax:

```text
~4–8% visual travel
```

Do not create huge image movement.

The image should feel alive while still staying anchored to the layout.

---

## Image scale on scroll

For campaign images:

```text
scale: 1.04 → 1
```

or

```text
scale: 1 → 1.03
```

Keep it nearly imperceptible.

---

## Marquee

Use marquee for:
- collection names
- seasonal statements
- campaign imagery
- editorial labels

Speed should be calm.

Pause or reduce movement when appropriate for hover/focus.

Do not place multiple marquees back-to-back.

---

## Product hover

Desktop:

```text
primary image
→ crossfade / reveal second image

image scale:
1 → 1.02

wishlist:
fade in

title / link:
subtle underline or opacity response
```

Duration:

```text
220–350ms
```

---

## Button hover

Preferred:

- arrow shifts `3–5px`
- underline grows
- dark button subtly lightens
- label transition stays crisp

Avoid scale/bounce effects.

---

## Section transitions

Transitions should connect sections visually.

Examples:
- image carries into next section
- oversized heading crosses a section boundary
- background changes from ivory → cream
- marquee acts as divider
- image overlap creates continuity

Do not add a hard divider line after every section.

---

# 14. Motion Guardrails

Do not:
- hijack scrolling
- make the entire site smooth-scroll dependent
- use long pinned sections for basic content
- animate critical controls away from the pointer
- delay product browsing for visual effects
- run heavy canvas/WebGL effects unless they serve a specific campaign
- animate checkout heavily

Commerce flows should get calmer as the user approaches purchase.

### Motion intensity by page

```text
Homepage             High
Collection page      Medium
Product page         Medium / Low
Cart                  Low
Checkout              Very Low
Account               Very Low
```

---

# 15. Reduced Motion

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

For reduced motion:
- remove parallax
- stop auto marquees or present static equivalents
- disable large scale transforms
- replace masked/staggered reveals with simple opacity
- keep navigation immediate

The content must never depend on animation to become usable.

---

# 16. Responsive Rules

## Product grid

```text
Mobile        2 columns
Tablet        2–3 columns
Desktop       3–4 columns
Wide          4 columns
```

Do not automatically make every desktop editorial composition a stacked card list on mobile.

Instead, redesign the composition for the smaller viewport.

---

## Mobile motion

Reduce:
- parallax distance
- simultaneous animations
- image overlap
- large text movement

Keep:
- clean reveal
- image crossfade
- tasteful marquee if performance is good
- button/link micro-interactions

---

# 17. E-Commerce UX Rules

Fashion aesthetics must not damage usability.

Always keep:
- visible product prices
- easy size selection
- obvious selected color
- clear Add to Bag action
- straightforward cart
- accessible filters
- clear shipping / return information
- predictable navigation
- useful empty states
- loading and error states

Never hide basic commerce behavior purely to achieve a minimalist look.

---

# 18. Accessibility

Target **WCAG 2.2 AA**.

Requirements:
- visible keyboard focus
- sufficient text contrast
- minimum practical touch target around `44×44px`
- alt text for meaningful fashion images
- labels for icon-only controls
- semantic headings
- no essential information conveyed only by color
- reduced-motion support
- keyboard-accessible drawers, menus, filters, and modals

### Gold accessibility rule

`#B79564` is primarily decorative.

For important text on light backgrounds, prefer:

```text
#7A5B34
```

or use the normal dark text color.

---

# 19. Design Tokens

Suggested base tokens:

```css
:root {
  /* Brand */
  --color-bg: #FAF8F4;
  --color-surface: #FFFFFF;
  --color-surface-soft: #F4EFE8;

  --color-text: #171513;
  --color-text-secondary: #6D6660;

  --color-brand: #B79564;
  --color-brand-dark: #7A5B34;
  --color-brand-soft: #EEE3D2;

  --color-border: #E3DED8;

  /* Radius */
  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;

  /* Layout */
  --container-max: 1440px;

  /* Motion */
  --motion-fast: 180ms;
  --motion-base: 300ms;
  --motion-slow: 650ms;

  --ease-ui: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-editorial: cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

# 20. Implementation Direction

The current storefront stack already supports a modern motion-driven implementation.

Prefer:
- CSS transforms and transitions for simple interactions
- `motion` for component/scroll animation
- `IntersectionObserver`-style visibility patterns where sufficient

Do not add GSAP by default.

Only introduce a heavier animation dependency if a specific approved interaction genuinely requires it.

Performance rules:
- animate primarily `transform` and `opacity`
- avoid layout-thrashing animation
- lazy-load below-the-fold imagery
- optimize campaign photography
- avoid autoplay background video on mobile unless compressed and justified
- preserve smooth scrolling on mid-range phones

---

# 21. Agent Rules

When an AI coding/design agent works on Moon Fashion, it should follow these rules:

1. Treat this document as the default visual direction.
2. Use Modévo primarily as the motion/pacing reference.
3. Use Astral, Bella, and Vessa as secondary layout and e-commerce references.
4. Do not copy any reference site pixel-for-pixel.
5. Keep Moon Fashion's own gold/ivory/ink identity.
6. Prefer editorial composition over generic cards.
7. Keep motion strongest on the homepage and calmer during purchase flows.
8. Do not introduce unrelated colors without a design reason.
9. Do not use giant rounded containers by default.
10. Keep product imagery visually dominant.
11. Ensure every motion effect has a reduced-motion fallback.
12. Prioritize mobile performance and shopping usability.
13. Maintain consistent spacing, typography, image ratio, and interaction behavior across pages.
14. When uncertain, choose the cleaner and quieter option.

---

# 22. One-Line Creative Direction

> **Moon Fashion is a warm, editorial fashion boutique where ivory space, deep ink, muted gold, strong photography, and cinematic motion create a refined shopping experience.**
