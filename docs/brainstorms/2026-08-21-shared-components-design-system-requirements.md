---
date: 2026-08-21
topic: shared-components-design-system
---

# Shared Components Design System

## Problem Frame
As Moon Store expands across multiple features (Inventory, Purchasing, Sales, POS, Analytics, Fulfillment, Admin), UI patterns such as forms, metric displays, data tables, modals, and navigation elements have been implemented with varying degrees of ad-hoc styling and repetition. A cohesive, opinionated shared component design system built on top of Hero UI, Tailwind CSS, TanStack Table, React Hook Form, and TanStack Router is needed to ensure consistent UX, streamline feature development, eliminate duplicate code, and guarantee full RTL/accessibility compliance.

## Golden Rule of Ownership
> [!IMPORTANT]
> **The Golden Rule**: Shared components own presentation and reusable interaction mechanics. Features own business rules, data fetching, domain state, and workflows.

## Component Stack Architecture

```
                    ┌────────────────────────┐
                    │        HeroUI          │
                    └───────────┬────────────┘
                                │
                    ┌───────────▼────────────┐
                    │ Unit 0: Foundation &   │
                    │ Contracts & Direction  │
                    └───────────┬────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
     ┌────▼─────┐         ┌─────▼────┐          ┌─────▼─────┐
     │  Unit 1  │         │  Unit 2  │          │  Unit 3   │
     │  Forms   │         │ Display  │          │ Overlays  │
     └────┬─────┘         └─────┬────┘          └─────┬─────┘
          │                     │                     │
          └─────────────────────┼─────────────────────┘
                                │
                       ┌────────▼────────┐
                       │     Unit 4      │
                       │    DataTable    │
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │     Unit 5      │
                       │  Navigation &   │
                       │ CommandRegistry │
                       └────────┬────────┘
                                │
                       ┌────────▼────────┐
                       │  Feature Pages  │
                       │ Inventory, POS, │
                       │ Sales, Admin... │
                       └─────────────────┘
```

## Architectural Boundaries & Dependency Rules

### Strict Dependency Direction
```
Feature Modules (Inventory, Sales, Purchasing, Admin)
                      ↓ (imports from)
              Shared Layer (client/src/shared/)
                      ↓ (imports from)
     Third-Party Primitives (Hero UI, TanStack, React Hook Form)
```
> [!IMPORTANT]
> **Strict Boundary Rule**: `Feature → Shared`, but `Shared ↛ Feature`. Code in `client/src/shared/` must NEVER import anything from `client/src/features/`.

### Public API Stability Rules
- **Explicit TypeScript Props**: Every shared component must define explicit prop types with clear docstrings; avoid loose `any` or open-ended untyped bags.
- **Composition over Flag Bloat**: Expose composition slots (`toolbar`, `children`, `actionSlots`, `bulkActions`) rather than creating endless Boolean flags for custom behavior.
- **Feature & Fetching Independence**: Zero knowledge of domain entities (e.g. `Product`, `Sale`) or network calls in UI primitives.

## Folder Organization Architecture

```
client/src/shared/
├── components/
│   ├── forms/          # FormField, FormInput, FormSelect, FormTextarea, SearchInput, DateRangePicker, ImageUploader
│   ├── data-display/   # StatCard, SkeletonLoader, StatusBadge
│   ├── data-table/     # DataTable, TableBulkActions, TableColumnVisibility
│   ├── overlays/       # ActionModal, SlideOverDrawer, ConfirmDialog
│   ├── navigation/     # Breadcrumbs, PageHeader, TabsNav, CommandPalette
│   └── feedback/       # EmptyState, ErrorBoundary
├── providers/          # DirectionProvider
├── hooks/              # useDirection, useCommandRegistry, useDebouncedValue
├── lib/                # exportUtils, commandRegistry, idUtils
└── index.ts            # Public barrel export
```

## Requirements

### Phase 0: Foundation & Contracts (Unit 0)
- R0. **Foundational Contracts & Token Standards**:
  - Implement `DirectionProvider` & `useDirection()` decoupling layout direction from translation stores.
  - Standardize common size variants (`sm`, `md`, `lg`), semantic colors (`primary`, `danger`, `warning`, `success`, `neutral`), and accessible focus ring tokens (`focus-visible:ring-2`).
  - Establish accessible ID and description generators (`idUtils`).
  - Standardize shared component test utilities (`renderWithProviders`).
  - Enforce strict dependency boundaries with zero circular imports and zero `shared ↛ feature` imports.

### Phase 1: Forms & Inputs Suite (Unit 1)
- R1. **`FormField` Container & Accessibility Contract**: Automatically binds to `react-hook-form` / `zod` contexts with unique field ID binding, `<label htmlFor={id}>`, `aria-invalid`, `aria-describedby`, and `onBlur` trigger with `onChange` re-validation.
- R2. **Atomic Form Primitives**: Provide pre-configured wrappers (`FormInput`, `FormSelect`, `FormTextarea`, `FormSwitch`) in `shared/components/forms/` utilizing CSS logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`).
- R3. **`SearchInput`**: Reusable debounced search input component featuring an instant clear button (`aria-label`), magnifying glass icon (`aria-hidden`), keyboard shortcut badge (`/`), and 300ms debounce delay.
- R4. **`DateRangePicker` & Half-Open Interval Contract**: Fast preset chips ("Today", "Last 7 Days", etc.) adhering to `[startOfDay, startOfNextDay)` query boundaries with keyboard navigation and localized calendars.
- R5. **`ImageUploader` / `Dropzone`**: Drag-and-drop file uploader supporting single and multi-image gallery with drag reordering, keyboard file selection, and `aria-live="polite"` status announcements.

### Phase 2: Data Display & Feedback Suite (Unit 2)
- R6. **`StatCard` / `MetricCard`**: In `shared/components/data-display/`, provides KPI metric card with title, primary value, trend percentage indicator (`aria-label`), optional Recharts mini sparkline (`aria-hidden`), and shimmer loading state.
- R7. **`SkeletonLoader` Suite**: Standardized shimmer primitives (`ContentSkeleton`, `CardSkeleton`, `TableSkeleton`, `FormSkeleton`) with `aria-busy="true"`.
- R8. **`StatusBadge` Alignment**: Standardized badge color tokens and status mappings with WCAG 2.2 AA contrast.

### Phase 3: Overlays & Panels Suite (Unit 3)
- R9. **`ActionModal` / `ModalWrapper` & Dialog A11y**: Frosted glass / blurred backdrop modals with strict `role="dialog"`, `aria-modal="true"`, focus trap, initial focus, focus restore, and `Escape` key listener.
- R10. **`SlideOverDrawer`**: Slide-over panel (sliding from inline-end via `useDirection()`), adapting into a mobile bottom sheet (<640px) with modal a11y guarantees.
- R11. **`ConfirmDialog`**: Standard confirm/cancel alert dialogs (`role="alertdialog"`, default cancel button focus).

### Phase 4: Enterprise DataTable Suite (Unit 4)
- R12. **Explicit `DataTableMode` Contract in `shared/components/data-table/`**: Strict `mode: "client" | "server"` discriminated union with zero hidden data fetching.
- R13. **Bulk Action Toolbar (`TableBulkActions`)**: Floating/sticky bulk action bar (`role="toolbar"`).
- R14. **Column Visibility & Density (`TableColumnVisibility`)**: Built-in column visibility and row density controls.
- R15. **Composable Toolbar & Action Slots**: Flexible `toolbar` slot allowing callers to inject `<ExportButton>` or custom controls with access to table selection.
- R16. **Minimalist Aesthetics & Table A11y**: Hero UI borderless table styling with `aria-sort` headers and accessible selection checkboxes.

### Phase 5: Navigation & Global Utilities Suite (Unit 5)
- R17. **`Breadcrumbs`**: Located in `shared/components/navigation/`, renders `<nav aria-label="Breadcrumbs">` with `<ol>` and `aria-current="page"`.
- R18. **`PageHeader` Enhancement**: Combines breadcrumbs, page titles (`<h1>`), descriptions, and responsive action button groups.
- R19. **`TabsNav`**: Modern pill/underlined tab navigation wrapping `role="tablist"` / `role="tab"` with arrow key navigation.
- R20. **Extensible `CommandPalette` & Command Registry**: Extensible registry (`CommandItem`) and combobox modal (`Ctrl+K` / `Cmd+K`) with full keyboard navigation and live search announcements.

## Success Criteria
- **Repeated UI Patterns Replaced**: Core recurring patterns across features (forms, cards, tables, dialogs, drawers, headers) consume standardized shared components.
- **Domain Logic Separation**: Feature components contain purely domain logic and data fetching, eliminating presentation and validation boilerplate duplication.
- **Public API Stability**: All shared components expose typed, documented, and backward-compatible prop interfaces.
- **Consistent RTL/LTR Behavior**: Layout and interaction directions behave consistently and automatically across English and Arabic locales.
- **Universal Accessibility Compliance**: Every interactive shared component strictly fulfills WCAG 2.2 AA standards.
- **Strict Boundary Integrity**: Zero circular dependencies and zero imports from `client/src/features/` into `client/src/shared/`.

## Next Steps
`/dev:plan` for structured implementation planning.
