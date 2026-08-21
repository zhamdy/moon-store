---
title: "feat: Shared Components Design System"
type: feature
status: completed
date: 2026-08-21
origin: docs/brainstorms/2026-08-21-shared-components-design-system-requirements.md
---

# feat: Shared Components Design System

## Overview

This plan defines the architectural implementation of the Moon Store Shared Components Design System. Built on top of `@heroui/react`, `@tanstack/react-table`, `@tanstack/react-router`, `react-hook-form`, `zod`, `lucide-react`, and `recharts`, this suite provides a cohesive set of reusable building blocks for forms, data display, overlays, tables, and navigation across all application features with first-class RTL, accessibility (WCAG 2.2 AA), strict boundary stability, and keyboard navigation support.

## Problem Frame

Features across the client (Inventory, Purchasing, Sales, POS, Analytics, Fulfillment, Admin) currently implement forms, filters, tables, modal dialogues, and metrics with varying levels of duplication and styling inconsistencies. By establishing a layered, opinionated shared component library in `client/src/shared/components/`, we eliminate presentation duplication across feature modules, unify interactive ergonomics, and guarantee consistent RTL, accessibility, and public API stability.

## The Golden Rule of Ownership
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

### Folder Organization Layout
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

## Requirements Trace

- **Unit 0: Foundation & Contracts**
  - **R0**: `DirectionProvider`, `useDirection()`, accessible id/aria utilities, standardized variants/tokens, and test utilities.
- **Unit 1: Forms & Inputs Suite**
  - **R1**: `FormField` Container with react-hook-form/zod binding, `onBlur` trigger, `onChange` re-validation, and full A11y contract (`label htmlFor`, `aria-invalid`, `aria-describedby`, `aria-required`).
  - **R2**: Atomic Form Primitives (`FormInput`, `FormSelect`, `FormTextarea`, `FormSwitch`) with CSS logical properties and visible focus rings.
  - **R3**: `SearchInput` with debounce, clear button (`aria-label`), search icon (`aria-hidden`), and shortcut badge.
  - **R4**: `DateRangePicker` with half-open interval `[startOfDay, startOfNextDay)` contract, keyboard navigation, and locale awareness.
  - **R5**: `ImageUploader` / `Dropzone` supporting single-image and multi-image gallery with drag reordering and `aria-live` state announcements.
- **Unit 2: Data Display & Feedback Suite**
  - **R6**: `StatCard` / `MetricCard` with value, subtitle, trend indicator (`aria-label`), icon, and optional Recharts sparkline (`aria-hidden`).
  - **R7**: `SkeletonLoader` suite (`ContentSkeleton`, `CardSkeleton`, `TableSkeleton`, `FormSkeleton`) with `aria-busy` and `aria-live`.
  - **R8**: `StatusBadge` token standardization and dot variant support with WCAG 2.2 AA contrast.
- **Unit 3: Overlays & Panels Suite**
  - **R9**: `ActionModal` / `ModalWrapper` with blurred backdrop, standardized responsive widths, focus trap, initial focus, focus restore, and Escape key listener.
  - **R10**: `SlideOverDrawer` responsive panel using `useDirection()` with complete modal a11y guarantees.
  - **R11**: `ConfirmDialog` standardizations (`role="alertdialog"`, default cancel focus, semantic action variants).
- **Unit 4: Enterprise DataTable Suite**
  - **R12**: Explicit `DataTableMode` contract (`mode: 'client' | 'server'`) with strictly separated state ownership and zero hidden data fetching.
  - **R13**: Bulk action toolbar triggered by row selection (`role="toolbar"`).
  - **R14**: Column visibility toggle & row density selector (compact vs standard).
  - **R15**: Composable `toolbar` slot for custom action injection (e.g. Export buttons, filters) decoupled from table core.
  - **R16**: Hero UI minimalist table styling with `aria-sort` headers and accessible row checkboxes.
- **Unit 5: Navigation & Global Utilities Suite**
  - **R17**: `Breadcrumbs` component with `<nav aria-label="Breadcrumbs">` and `aria-current="page"`.
  - **R18**: `PageHeader` enhancement integrating breadcrumbs, titles (`<h1>`), descriptions, and action groups.
  - **R19**: `TabsNav` modern pill/underlined tab navigation (`role="tablist"` / `role="tab"` with arrow key navigation).
  - **R20**: Extensible `CommandPalette` (`role="combobox"` / `role="listbox"`, `aria-activedescendant`, `aria-live`) & Command Registry.

## Scope Boundaries

- **In Scope**:
  - `DirectionProvider` & `useDirection()` in `client/src/shared/providers/DirectionProvider.tsx`.
  - Extensible `CommandRegistry` in `client/src/shared/lib/commandRegistry.ts` / `useCommandRegistry.ts`.
  - Implementation of shared components in `client/src/shared/components/<category>/`.
  - Reusable hooks and utilities in `client/src/shared/hooks/` and `client/src/shared/lib/`.
  - Unit and integration tests in `client/src/shared/components/__tests__/`.
- **Out of Scope**:
  - Importing any feature code into `client/src/shared/` (strict unidirectional boundary).
  - Hardcoding domain export logic (CSV/Excel/PDF) into `DataTable` (handled via composable `toolbar` action slots and external utils).
  - Coupling pure UI components to translation dictionaries.
  - Hardcoding domain action lists into `CommandPalette`.
  - Mass migration of every single feature page in this initial core PR.
  - Backend schema or API endpoint modifications.
  - Domain-specific calculations (pricing rules, tax calculations).

---

## Implementation Units

### [x] Unit 0: Foundation & Contracts
- **Goal**: Establish the core shared contracts, direction provider, accessibility/ID helpers, design tokens, and testing utilities before any visual components are built.
- **Files**:
  - `client/src/shared/providers/DirectionProvider.tsx`
  - `client/src/shared/hooks/useDirection.ts`
  - `client/src/shared/lib/idUtils.ts`
  - `client/src/shared/tests/testUtils.tsx`
  - `client/src/shared/index.ts`
  - `client/src/shared/__tests__/Foundation.test.tsx`
- **Approach**:
  - `DirectionProvider`: Provides `{ direction: 'ltr' | 'rtl', isRtl: boolean }` context with document root `dir` synchronization, completely decoupled from i18n stores.
  - `idUtils`: Standardized accessible unique ID generator (`useId` wrapper with prefixing for helper text and error message element IDs).
  - `testUtils`: Standardized `renderWithProviders` wrapping tests with `DirectionProvider` and theme providers for consistent testing.
  - Establish root barrel `client/src/shared/index.ts` re-exporting modules cleanly.
- **Test Scenarios**:
  - `DirectionProvider` correctly toggles and propagates `dir="rtl"` vs `dir="ltr"` and `isRtl` boolean.
  - `idUtils` produces stable, collision-free accessible IDs for form fields.
  - ESLint / boundary checks verify zero reverse imports from `features/` to `shared/`.

### [x] Unit 1: Forms & Inputs Suite
- **Goal**: Provide unified form wrappers with automatic react-hook-form validation, error messaging, debounced search, half-open interval date picking, and image dropzones with complete WAI-ARIA accessibility.
- **Files**:
  - `client/src/shared/components/forms/FormField.tsx`
  - `client/src/shared/components/forms/FormInput.tsx`
  - `client/src/shared/components/forms/FormSelect.tsx`
  - `client/src/shared/components/forms/FormTextarea.tsx`
  - `client/src/shared/components/forms/SearchInput.tsx`
  - `client/src/shared/components/forms/DateRangePicker.tsx`
  - `client/src/shared/components/forms/ImageUploader.tsx`
  - `client/src/shared/components/forms/types.ts`
  - `client/src/shared/components/forms/index.ts`
  - `client/src/shared/components/__tests__/Forms.test.tsx`
- **Approach**:
  - `FormField`: Generates unique ID, renders `<label htmlFor={id}>`, binds `aria-invalid`, `aria-describedby={`${id}-helper ${id}-error`}`, and `aria-required`.
  - `SearchInput`: Wraps Hero UI `Input` with `useDebouncedValue` (300ms), `aria-label="Clear search"` on clear button, search icon (`aria-hidden="true"`), and shortcut badge.
  - `DateRangePicker`: Presets and calendar popover with keyboard navigation (`ArrowKeys`, `Tab`, `Enter`, `Escape`) and `[startOfDay, startOfNextDay)` contract.
  - `ImageUploader`: Drag-and-drop zone with keyboard activation (`Space`/`Enter`), `aria-live="polite"` status announcements, and thumbnail previews.
- **Test Scenarios**:
  - `FormField` links label to input ID and sets `aria-invalid="true"` with `aria-describedby` when validation fails.
  - `SearchInput` debounces user input, fires `onChange`, and clear button resets input with accessible label.
  - `DateRangePicker` preset "Today" outputs exact `startOfDay` and `startOfTomorrow` ISO boundaries.
  - `ImageUploader` announces file upload progress/status and handles keyboard file selection.

### [x] Unit 2: Data Display & Feedback Suite
- **Goal**: Create standardized KPI metric cards with sparkline charts, status badges, and shimmer skeleton loaders with accessible labels and live regions in `client/src/shared/components/data-display/`.
- **Files**:
  - `client/src/shared/components/data-display/StatCard.tsx`
  - `client/src/shared/components/data-display/SkeletonLoader.tsx`
  - `client/src/shared/components/data-display/StatusBadge.tsx`
  - `client/src/shared/components/data-display/index.ts`
  - `client/src/shared/components/__tests__/DataDisplay.test.tsx`
- **Approach**:
  - `StatCard`: Accepts `title`, `value`, `delta` with `aria-label` describing trend (e.g. "Increased by 12%"), `icon`, and optional `sparklineData` (with `aria-hidden="true"`).
  - `SkeletonLoader`: Provides `CardSkeleton`, `TableSkeleton`, `FormSkeleton`, and `ContentSkeleton` with `aria-busy="true"` and `aria-live="polite"`.
  - `StatusBadge`: Enhance existing component to support dot indicator variants with WCAG 2.2 AA contrast compliance.
- **Test Scenarios**:
  - `StatCard` renders accessible trend descriptions and fallback text.
  - `StatCard` renders shimmer skeleton with `aria-busy="true"` when `isLoading=true`.
  - `SkeletonLoader` renders specified number of rows/cards with live region attributes.

### [x] Unit 3: Overlays & Panels Suite (Dialog & Focus Trap A11y)
- **Goal**: Build standardized modal wrappers, responsive slide-over drawers, and confirm dialogs in `client/src/shared/components/overlays/` with strict focus trap, initial focus, focus restoration, and Escape dismissal.
- **Files**:
  - `client/src/shared/components/overlays/ActionModal.tsx`
  - `client/src/shared/components/overlays/SlideOverDrawer.tsx`
  - `client/src/shared/components/overlays/ConfirmDialog.tsx`
  - `client/src/shared/components/overlays/index.ts`
  - `client/src/shared/components/__tests__/Overlays.test.tsx`
- **Approach**:
  - `ActionModal`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, focus trap, auto-focus on first interactive element, focus restoration on close, Escape key handler.
  - `SlideOverDrawer`: Off-canvas panel sliding from inline-end (consuming `useDirection()`), transforming into a bottom sheet on mobile (<640px) with identical modal a11y guarantees.
  - `ConfirmDialog`: `role="alertdialog"`, initial focus on cancel button for destructive operations, `aria-labelledby`, `aria-describedby`.
- **Test Scenarios**:
  - `ActionModal` traps keyboard focus inside dialog and restores focus to trigger element upon dismissal.
  - `ActionModal` and `SlideOverDrawer` dismiss on `Escape` key press and backdrop click.
  - `ConfirmDialog` places initial focus on cancel button for dangerous actions.

### [x] Unit 4: Enterprise DataTable Suite
- **Goal**: Build a clean, decoupled `DataTable` in `client/src/shared/components/data-table/` supporting explicit client and server modes, floating bulk action bar, column visibility dropdown, and composable toolbar slots with accessible table semantics.
- **Files**:
  - `client/src/shared/components/data-table/DataTable.tsx`
  - `client/src/shared/components/data-table/TableBulkActions.tsx`
  - `client/src/shared/components/data-table/TableColumnVisibility.tsx`
  - `client/src/shared/components/data-table/types.ts`
  - `client/src/shared/components/data-table/index.ts`
  - `client/src/shared/components/__tests__/DataTable.test.tsx`
- **Approach**:
  - Discriminated union props (`mode: 'client' | 'server'`).
  - Table accessibility: `aria-sort` ("ascending" | "descending" | "none") on headers, accessible checkboxes (`aria-label={`Select row ${id}`}`), `aria-busy={isLoading}`, and `role="toolbar"` for bulk actions.
  - Composable `toolbar` slot and floating `TableBulkActions` toolbar.
- **Test Scenarios**:
  - `client` mode performs local in-memory sorting, global search filtering, and pagination.
  - `server` mode disables local filter/sort engines, renders external `pageCount`, and triggers `onPaginationChange` / `onSortingChange` without local mutation.
  - Table headers announce sort state changes via `aria-sort`.
  - Selecting rows renders the bulk action toolbar with accessible label and count.

### [x] Unit 5: Navigation & Global Utilities Suite
- **Goal**: Implement route breadcrumbs, enhanced page headers, sub-navigation tabs, and an extensible Command Registry & Command Palette (`Ctrl+K`) in `client/src/shared/components/navigation/`.
- **Files**:
  - `client/src/shared/lib/commandRegistry.ts`
  - `client/src/shared/hooks/useCommandRegistry.ts`
  - `client/src/shared/components/navigation/Breadcrumbs.tsx`
  - `client/src/shared/components/navigation/TabsNav.tsx`
  - `client/src/shared/components/navigation/CommandPalette.tsx`
  - `client/src/shared/components/navigation/PageHeader.tsx`
  - `client/src/shared/components/navigation/index.ts`
  - `client/src/shared/components/__tests__/Navigation.test.tsx`
- **Approach**:
  - `Breadcrumbs`: `<nav aria-label="Breadcrumbs">` with `<ol>` and `aria-current="page"` on current route leaf.
  - `PageHeader`: Enhanced with optional `breadcrumbs` slot, title, description, badge, action button group, and sub-tabs using CSS logical properties (`me-*`, `ms-*`).
  - `TabsNav`: `role="tablist"` / `role="tab"` with `aria-selected` and left/right arrow key navigation.
  - `CommandPalette`: `role="combobox"`, `aria-expanded="true"`, `aria-controls="command-list"`, `aria-activedescendant` linking to focused option in `role="listbox"`, `aria-live="polite"` result count announcements.
- **Test Scenarios**:
  - `Breadcrumbs` renders accessible list with `aria-current="page"` on current leaf.
  - `TabsNav` supports keyboard navigation with ArrowLeft / ArrowRight keys.
  - `CommandPalette` manages `aria-activedescendant` during ArrowUp / ArrowDown navigation and executes action on Enter.

---

## Risks & Unknowns

- **Focus Restoration in React 18**: Ensure trigger element ref is preserved when modals or drawers unmount so focus restoration does not target stale DOM nodes.
- **Strict Boundary Check**: Run madge/boundary checks to guarantee zero reverse dependencies (`shared ↛ features`).

## Verification Plan

1. **Automated Unit & Component Tests**:
   - Run `npm run test` in `client/` to verify all component test suites pass with 100% test scenario coverage including a11y attributes and keyboard navigation.
2. **Lint & Cycle Checks**:
   - Run `npm run lint` and `npm run lint:cycles` to ensure zero circular dependencies and clean ESLint boundaries.
3. **Visual, RTL & A11y Check**:
   - Inspect components in both English (LTR) and Arabic (RTL) locales to verify mirroring, focus rings (`focus-visible`), and screen-reader announcements.
