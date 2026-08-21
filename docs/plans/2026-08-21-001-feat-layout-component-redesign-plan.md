---
title: feat: UI Redesign and HeroUI Migration
type: refactor
status: active
date: 2026-08-21
origin: docs/brainstorms/2026-08-21-layout-and-components-redesign-requirements.md
---

# feat: UI Redesign and HeroUI Migration

## Overview

The application is undergoing a comprehensive UI redesign to establish a simple, modern, and consistent aesthetic. This transition involves fully adopting HeroUI as the primary component library and completely removing the existing Shadcn UI/Radix-based wrappers. The end goal is to import HeroUI primitives directly into feature components, utilizing custom shared components only for genuine application-level patterns (like `ConfirmDialog` or `DataTable`).

## Problem Frame

The current codebase utilizes Shadcn-style wrappers in `client/src/shared/ui/` that either wrap HeroUI components or emulate Radix APIs. This adds unnecessary indirection and maintenance overhead without providing application-specific value. Additionally, the existing layout relies on older patterns (like a mobile bottom nav) and native HTML tables. This plan orchestrates a complete migration to a clean HeroUI-driven architecture without altering existing business logic, routing behavior, or API contracts.

## Requirements Trace

- **R1**: A simple, modern, consistent UI using HeroUI as the primary component library.
- **R2**: No Shadcn UI components or unnecessary wrappers remaining in `client/src/shared/ui/`.
- **R3**: Existing business logic, API contracts, and data structures remain entirely unchanged.
- **R4**: TanStack Table logic is retained, with HeroUI handling the visual presentation.
- **R5**: Lucide React is retained for icons.
- **R6**: Responsive layout featuring a persistent desktop sidebar and a mobile drawer (removing the bottom nav).
- **R7**: A separate top header containing navigation, user, and notification controls.
- **R8**: A unified design foundation featuring a single subtle accent color used strictly for primary actions, active navigation, links, and selected/focus states.
- **R9**: Consistent, clean styling across modals, forms, tables, cards, dropdowns, selects, tabs, popovers, etc.

## Scope Boundaries

- **In Scope**: Visual design, layout structure, CSS variables, Tailwind configuration, component library migration, creation of high-level shared patterns (e.g., `EmptyState`).
- **Out of Scope**: Changes to API contracts, backend behavior, data models, business rules, authentication logic, and routing logic (unless required to support the new layout).

## Key Architectural Decisions

- **Direct Imports**: HeroUI primitives (e.g., `Button`, `Input`) will be imported directly from `@heroui/react` in feature components. 
- **Application Patterns**: We will only maintain shared components for reusable application-level behavior (e.g., `PageHeader`, `EmptyState`, `DataTable`, `FilterBar`, `ConfirmDialog`). We will *not* maintain 1:1 wrappers like `shared/ui/button.tsx`.
- **DataTable Architecture**: The `@tanstack/react-table` headless logic will be preserved in `DataTable.tsx`, but its internal rendering will be completely refactored to use HeroUI's `<Table>` components.
- **Modal Design**: Modals will feature centered placement, a clean modern surface, and a subtle blurred backdrop, achieving the visual requirement without hardcoding a specific Tailwind utility if HeroUI provides it natively.

## Implementation Plan

### [ ] Unit 1: UI Foundation & Design Tokens
- **Goal**: Establish the visual foundation for the redesign.
- **Files**: `client/src/app/index.css`, `client/tailwind.config.js`
- **Approach**: 
  - Update CSS variables for background, surface/card, border, foreground, and muted text to match the clean, modern aesthetic.
  - Define a single subtle accent color (`--accent` and `--accent-foreground`) and ensure it's mapped correctly in Tailwind.
  - Define semantic colors (destructive, success, warning).
  - Standardize border radius, shadows, typography, and dark mode compatibility.
- **Test expectation**: The app renders with the new color palette; primary elements use the subtle accent color appropriately.

### [ ] Unit 2: Application Layout (Header & Sidebar)
- **Goal**: Implement the responsive layout structure.
- **Files**: `client/src/app/Layout.tsx`, `client/src/app/Sidebar.tsx`
- **Approach**: 
  - Restructure `Layout.tsx` to include the persistent desktop Sidebar, Top Header, and Main Content.
  - In `Sidebar.tsx`, remove the mobile bottom navigation and the "More" sheet.
  - Update the Header to include a hamburger menu for mobile.
  - Wire the hamburger menu to control the Sidebar's off-canvas drawer state on mobile screens.
- **Test scenarios**:
  - Happy path: Sidebar is persistent on desktop.
  - Happy path: On mobile, the hamburger menu toggles the off-canvas sidebar drawer.

### [ ] Unit 3: Component Migration Inventory
- **Goal**: Create a concrete migration map by inventorying every Shadcn component and usage.
- **Files**: `client/src/shared/ui/*` and all features.
- **Approach**: 
  - Execute a codebase-wide search to catalog every existing Shadcn component (e.g. Button, Dialog, Select).
  - Document the usage count, intended HeroUI replacement, and the specific files they appear in.
  - Record this inventory as a markdown table to guide the subsequent migration phases.
- **Test expectation**: A complete inventory exists so that "migrate all Shadcn" is not an open-ended task.

### [ ] Unit 4: Core HeroUI Component Migration
- **Goal**: Migrate basic Shadcn/Radix components to HeroUI primitives.
- **Files**: Feature components using `Button`, `Input`, `Card`, `Badge`, `Checkbox`, `RadioGroup`, `Switch`, `Textarea`, `Label`, `Separator`, `Skeleton`.
- **Approach**: 
  - Identify all usages of these components from `client/src/shared/ui/`.
  - Refactor imports in feature files to pull directly from `@heroui/react`. Do not assume a 1:1 HeroUI equivalent exists. Inspect the installed HeroUI version and choose the simplest appropriate implementation.
  - Adjust props (e.g., `variant="destructive"` to `color="danger"`).
  - Delete the obsolete wrapper files in `shared/ui/`.
- **Test expectation**: Forms and basic UI elements render correctly using native HeroUI components.

### [ ] Unit 5: Shared Application-Level UI Patterns
- **Goal**: Extract meaningful recurring UI patterns into dedicated shared components.
- **Files**: `client/src/shared/components/PageHeader.tsx`, `EmptyState.tsx`, `ConfirmDialog.tsx`, `FilterBar.tsx` (create or update as necessary).
- **Approach**: 
  - Build these patterns composing HeroUI primitives to provide consistent, app-specific behavior (e.g., `EmptyState` accepting an icon, title, description, and CTA).
- **Test expectation**: These patterns can be successfully dropped into any feature page and function correctly.

### [ ] Unit 6: DataTable Migration
- **Goal**: Rebuild the `DataTable` presentation using HeroUI.
- **Files**: `client/src/shared/components/DataTable.tsx`
- **Approach**: 
  - Retain `@tanstack/react-table` for logic.
  - Replace the native `<table>` elements with HeroUI's `<Table>`, `<TableHeader>`, `<TableBody>`, etc.
  - Configure the table for minimal styling (no vertical borders, subtle hover).
  - Integrate loading states, and use the new `EmptyState` pattern for no-results states (allowing feature pages to pass in custom empty content).
  - Verify pagination, sorting, and filtering still function.
- **Test scenarios**:
  - Happy path: Table data renders correctly with sorting/pagination.
  - Edge case: Empty state renders the custom illustration and CTA when data is empty.

### [ ] Unit 7: Dialog, Modal & Overlay Migration
- **Goal**: Migrate `Dialog`, `Sheet`, `Popover`, and `Tooltip`.
- **Files**: Feature components using these UI wrappers.
- **Approach**: 
  - Replace `Dialog` usages with HeroUI's `<Modal>`. Preserve existing state ownership (e.g., `open={open}`, `onOpenChange={setOpen}`). `useDisclosure` should only be introduced where it actually simplifies things; do not blindly migrate every dialog to `useDisclosure`. Configure for centered placement and blurred backdrop.
  - Replace `Sheet` usages with HeroUI's `<Drawer>` (or `<Modal>` configured as an off-canvas drawer).
  - Replace `Popover` and `Tooltip` with direct HeroUI imports.
  - Delete the obsolete wrapper files in `shared/ui/`.
- **Test scenarios**:
  - Happy path: Modals open centered with a blurred backdrop; focus is trapped correctly; Escape key closes them.

### [ ] Unit 8: Complex Component Migration
- **Goal**: Migrate `DropdownMenu`, `Select`, `Tabs`, `Calendar`, and `AlertDialog`.
- **Files**: Feature components using these UI wrappers.
- **Approach**: 
  - Refactor complex Radix-style compositions into HeroUI's simplified APIs.
  - Map `AlertDialog` to `ConfirmDialog` or a configured HeroUI `<Modal>`.
  - Update `react-hook-form` integrations if the `Select` or `Input` APIs differ.
  - Delete the obsolete wrapper files in `shared/ui/`.
- **Test scenarios**:
  - Happy path: Dropdowns and selects open, display options, and handle selection correctly. Keyboard navigation functions smoothly.

### [ ] Unit 9: Feature/Page Migration & Visual Cleanup
- **Goal**: Ensure the entire application adheres to the new design system.
- **Files**: All feature directories (`client/src/features/*`).
- **Approach**: 
  - Perform a holistic review of all screens. Inspect each feature/page specifically for: spacing, typography, button variants, form layout, cards, empty states, loading states, tables, modal presentation, responsive behavior, dark mode, and inconsistent old Tailwind styles.
  - Clean up any residual non-HeroUI styling that clashes with the "simple and modern" aesthetic to avoid the "HeroUI components + 2024-era Tailwind styling" problem.
  - Ensure the subtle accent color is applied consistently to primary actions and active states.
- **Test expectation**: Visual consistency across the entire application without leftover legacy styles.

### [ ] Unit 10: Dependency Cleanup
- **Goal**: Remove all traces of Shadcn and unnecessary Radix dependencies.
- **Files**: `client/package.json`, `client/src/shared/ui/`
- **Approach**: 
  - Search the entire `client/src` tree for `"@/shared/ui/"`, `"components/ui"`, `"@radix-ui/"`, `"class-variance-authority"`, `"tailwind-merge"` (only if no longer needed), and Shadcn-generated utility patterns to prove there are zero consumers.
  - Verify that the `client/src/shared/ui/` directory is either empty or only contains genuine application-level patterns (and rename it to `shared/components` if appropriate).
  - Audit `package.json` for unused packages and remove dead imports.
- **Test expectation**: The application builds successfully without the removed dependencies and zero consumers exist for legacy styling tools.

### [ ] Unit 11: Final Verification
- **Goal**: Confirm the migration is complete and meets all requirements.
- **Approach**: Execute the Definition of Done checklist.

## Definition of Done

- [ ] Desktop layout renders with a persistent sidebar, header, and main content.
- [ ] Mobile layout renders with a header hamburger menu and an off-canvas drawer.
- [ ] Tables use HeroUI natively, featuring minimal styling, sorting, pagination, and robust custom empty states.
- [ ] Modals are centered with a subtle blurred backdrop, maintaining focus trap and accessibility.
- [ ] All basic forms, buttons, inputs, cards, selects, dropdowns, tabs, and popovers use direct HeroUI imports.
- [ ] The app uses a single subtle accent color for primary/active states; dark mode remains fully compatible.
- [ ] Keyboard navigation, focus states, and responsive behavior function correctly across the app.
- [ ] Existing routing, API behavior, and business logic are entirely unchanged.
- [ ] **No Shadcn UI wrapper components remain in the codebase.**
- [ ] **No unnecessary Radix or Shadcn dependencies remain in `package.json`.**
- [ ] TypeScript compilation, linting, and existing tests pass successfully.
