---
title: feat: Full UI Refactor for Soft & Airy Dashboard
type: refactor
status: active
date: 2026-08-20
origin: docs/brainstorms/2026-08-20-full-ui-refactor-requirements.md
---

# feat: Full UI Refactor for Soft & Airy Dashboard

## Overview

The application will undergo a full visual and structural refactor to adopt a "Soft & Airy" aesthetic. This involves updating HeroUI/Tailwind configurations for softer colors, more generous border radii, and subtle shadows. Additionally, the app shell will be re-architected so that the Point of Sale (POS) screen gets a dedicated full-screen layout, while the rest of the application uses a modern dashboard layout with a collapsible sidebar.

## Problem Frame

The previous UI attempt at stark minimalism was unsatisfying. The new goal is to make the application feel approachable, clean, and highly functional (especially separating POS needs from management dashboard needs) using a "Soft & Airy" design language.

## Requirements Trace

- R1. Main app shell must follow a modern dashboard layout (sidebar + header).
- R2. POS screen must use a specialized, full-screen layout.
- R3. Visual language: "Soft & Airy" with whitespace, gentle rounded corners, and subtle drop shadows.
- R4. Color palette: Approachable, avoiding stark black/white (e.g., using soft slate/indigo as an accent, soft grays for surfaces).
- R5. Continue using HeroUI, heavily customizing its theme.

## Scope Boundaries

- Touch layout and styling (CSS, Tailwind config, structural React components).
- Do not alter underlying business logic.
- Focus on app shell, global theme, and POS structural layout.

## Context & Research

### Relevant Code and Patterns

- `client/src/app/Layout.tsx`: Currently wraps all authenticated routes. Needs to be split.
- `client/src/routes/_authenticated/_admin.tsx`: Currently just an Outlet, should probably use the DashboardLayout.
- `client/src/routes/_authenticated.tsx`: Should just provide auth context, not the visual shell.
- `client/tailwind.config.js` and `client/src/app/index.css`: Need theme updates.

## Key Technical Decisions

- **Layout Splitting:** `_authenticated.tsx` will no longer render the visual `Layout`. Instead, we will create `DashboardLayout` for management pages and `PosLayout` for the POS page. `_admin.tsx` will render `DashboardLayout`.
- **Soft & Airy Theme:** We will define custom subtle box shadows and use a soft primary color (e.g., a slate or soft blue) instead of stark black/white. Border radius will be increased to `0.75rem` (Tailwind `xl`).

## Implementation Units

- [ ] **Unit 1: Split Layout Components**

**Goal:** Separate the visual shell into Dashboard and POS layouts so POS can be full-screen.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Create: `client/src/app/DashboardLayout.tsx` (Move contents of `Layout.tsx` here)
- Create: `client/src/app/PosLayout.tsx` (A full-screen container without the sidebar)
- Modify: `client/src/app/Layout.tsx` (Remove it, or keep it as a generic wrapper without UI)
- Modify: `client/src/routes/_authenticated.tsx` (Render `<Outlet />` instead of `<Layout />`)
- Modify: `client/src/routes/_authenticated/_admin.tsx` (Render `<DashboardLayout><Outlet /></DashboardLayout>`)
- Modify: `client/src/routes/_authenticated/pos.tsx` (Wrap its content in `<PosLayout>`)
- Modify: `client/src/routes/_authenticated/register.tsx`, `client/src/routes/_authenticated/sales.tsx`, `client/src/routes/_authenticated/barcode.tsx`, `client/src/routes/_authenticated/shifts.tsx`, `client/src/routes/_authenticated/deliveries.tsx`, `client/src/routes/_authenticated/inventory.tsx`, `client/src/routes/_authenticated/layaway.tsx` (These are non-admin but authenticated. We should probably wrap them in DashboardLayout or move them under `_admin` visually, or just wrap them individually. Actually, it's easier if we export `DashboardLayout` and wrap them, or create a layout route).

**Approach:**
- `_authenticated.tsx` handles auth logic. It will return just `<Outlet />` (and `<StartupPrompt />`).
- `_admin.tsx` will wrap its children in `<DashboardLayout>`.
- Any other non-admin route that needs the dashboard (like `/inventory`, `/sales`) will either be wrapped in `<DashboardLayout>` inside their component, or we can move them under a layout route. For minimal disruption, we'll wrap the component returned by those specific routes in `<DashboardLayout>`, and wrap `/pos` in `<PosLayout>`.

**Test scenarios:**
Test expectation: none -- purely structural layout changes.

**Verification:**
- POS screen takes up the full screen without a sidebar.
- Admin and other management pages still show the sidebar and header.

- [ ] **Unit 2: Implement "Soft & Airy" Theme in Tailwind & HeroUI**

**Goal:** Update the global colors, border radii, and shadows to create a soft, clean aesthetic.

**Requirements:** R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `client/tailwind.config.js`
- Modify: `client/src/app/index.css`

**Approach:**
- Update `index.css`: change `--primary` to a soft slate or indigo (e.g., `220 14% 46%` / `#64748B`), and soften the `--surface` and `--background` variables.
- Update `tailwind.config.js`:
  - Set `layout.radius` in HeroUI config to `small: '0.375rem', medium: '0.5rem', large: '0.75rem'`.
  - Set `layout.boxShadow` in HeroUI to subtle values (e.g. `small: '0px 2px 8px 0px rgba(0,0,0,0.04)'`).
  - Update `themes.light.colors.primary` to the new soft color.
  - Remove stark black/white primary overrides from the previous plan.

**Test scenarios:**
Test expectation: none -- pure styling change.

**Verification:**
- Buttons and active states use the new soft primary color.
- Cards, Modals, and Dropdowns have gentle rounded corners (`0.75rem` for large) and soft drop shadows instead of flat borders.
- The overall vibe is airy and spacious.
