---
date: 2026-08-21
topic: layout-and-components-redesign
---

# Layout and Components Redesign

## Problem Frame
The application's UI needs a refresh to achieve a "simple and modern" aesthetic, heavily utilizing components from the existing Hero UI library. The redesign replaces the current structure and touches the core layout (navigation and header) as well as primary data and interaction components (tables and modals).

## Requirements

**Layout Structure**
- R1. Implement a persistent side navigation menu (sidebar) for main routing.
- R2. Implement a separate top header containing a user profile and notification bell.
- R3. On mobile screens, the sidebar must collapse into a hamburger menu button located in the top header.

**Hero UI Components**
- R4. **Tables**: Must be minimalist and clean. Configure the Hero UI Table to have no vertical borders, subtle row hover effects, and basic integrated pagination.
- R5. **Table Empty States**: When empty, tables must display an illustration/icon with a clear call-to-action button to add data.
- R6. **Modals**: Must be centered on the screen and utilize a blurred backdrop (Hero UI's frosted glass effect) to emphasize modern design.

## Success Criteria
- The application layout successfully uses the new Sidebar + Top Header structure across all main routes.
- Tables and Modals strictly utilize Hero UI components configured with the specified minimalist aesthetics.
- The UI feels cohesive, modern, and uncluttered.

## Scope Boundaries
- This is a UI/UX layout and styling redesign; no underlying business logic or API data structures should be modified.
- The previous design's constraint on layout changes (from the `ui-identity-simplification` brainstorm) is explicitly overridden by this document.
- The color palette will introduce a single subtle accent color for primary actions/links, moving away from the previous strict monochrome constraint.

## Key Decisions
- **Layout**: Chose a Sidebar + Top Header approach to support a clean dashboard feel, with a standard mobile hamburger fallback. Header keeps it simple with just profile and notifications.
- **Tables**: Selected a minimal styling approach, including illustrative empty states to guide users.
- **Modals**: Chose centered modals with blurred backdrops to leverage modern Hero UI capabilities.
- **Color**: Opted for a single subtle accent color to add life to the modern aesthetic without losing the clean feel.

## Outstanding Questions

### Resolve Before Planning
- None

### Deferred to Planning
- [Technical] How to structure the layout routes in TanStack Router to effectively support the persistent sidebar, header, and the mobile drawer state?
- [Technical] What specific Hero UI table configurations and variants will best achieve the requested minimalist look?

## Next Steps
`/dev:plan` for structured implementation planning.
