---
date: 2026-08-20
topic: full-ui-refactor
---

# Full UI Refactor: Soft & Airy Dashboard

## Problem Frame
The current UI is unsatisfying. The previous attempt at a flat monochrome identity felt too stark. The application needs a complete visual and structural rethink to feel clean, approachable, and highly usable for a retail management and POS system. 

## Requirements

**Layout & App Shell**
- R1. **Management Dashboard:** The main application shell must follow a modern dashboard layout featuring a collapsible left sidebar for navigation and a top header (for search, profile, and global actions).
- R2. **POS View:** The Point of Sale (POS) screen must use a specialized, full-screen layout optimized for fast checkout, hiding the standard management sidebar to maximize screen real estate.

**Visual Style (Soft & Airy)**
- R3. The visual language must be "Soft & Airy" — emphasizing generous whitespace, soft gray backgrounds for contrast, gentle rounded corners (e.g., `rounded-xl` or `rounded-2xl`), and subtle drop shadows for elevation.
- R4. The color palette should be approachable and clean, avoiding stark black/white contrasts in favor of softer tones.

**Component Library**
- R5. The project will continue using **HeroUI**, but its theme and default configurations must be heavily customized to match the new Soft & Airy visual style (re-enabling shadows, adjusting border radii, and tweaking colors).

## Success Criteria
- The application feels cohesive, modern, and pleasant to use without feeling rigidly corporate or overly stark.
- Users can navigate the management features easily via the new sidebar shell.
- The POS screen remains highly functional and uncluttered.

## Scope Boundaries
- This refactor touches layout and styling (CSS, Tailwind config, and structural React components like sidebars/headers). It should not alter the underlying business logic or data fetching mechanisms.
- Focus on the app shell, global theme, and POS layout first before tweaking every individual internal page.

## Key Decisions
- **HeroUI Retention:** Decided to stick with HeroUI rather than migrating to shadcn/ui, avoiding a massive rewrite of form controls and interactive components, instead focusing on deep theme customization.
- **Dedicated POS Layout:** Kept the POS screen separate from the main dashboard shell to ensure cashiers have an optimized, distraction-free environment.

## Outstanding Questions

### Resolve Before Planning
- None

### Deferred to Planning
- [Technical] What specific Tailwind shadow (`boxShadow`) and radius (`borderRadius`) values will best achieve the "Soft & Airy" look within HeroUI's theme configuration?
- [Technical] How to structure the TanStack Router layout routes to seamlessly support both the dashboard shell (`_admin`) and the full-screen POS shell (`pos`)?

## Next Steps
`/dev:plan` for structured implementation planning.
