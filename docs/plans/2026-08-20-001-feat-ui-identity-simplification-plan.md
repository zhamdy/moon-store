---
title: feat: Simplify UI identity to monochrome
type: feat
status: active
date: 2026-08-20
origin: docs/brainstorms/2026-08-20-ui-identity-simplification-requirements.md
---

# feat: Simplify UI identity to monochrome

## Overview

Update the styling and configuration of the `moon-store` application to adopt a minimalist, monochrome visual identity. The current gold-themed colors and drop shadows will be replaced with a clean black/white/gray scale, relying on subtle borders for surface separation.

## Problem Frame

The introduction of HeroUI caused some stylistic inconsistencies. The goal is to establish a flat, highly legible, and simple visual language using monochrome colors, slight border radii, and no drop shadows, satisfying the requirement for a clean, minimalist identity.

## Requirements Trace

- R1. Primary color palette must be monochrome/minimalist (black, white, and shades of gray).
- R2. Seamlessly support both Light and Dark modes.
- R3. Components must use slight border-radius (0.375rem / Tailwind's `rounded-md`).
- R4 & R5. Surface separation via subtle borders instead of drop shadows.

## Scope Boundaries

- No structural layout changes (routing, components structure).
- No new features.
- Purely CSS variable and Tailwind/HeroUI configuration updates.

## Context & Research

### Relevant Code and Patterns

- `client/src/app/index.css`: Defines the global CSS variables and color schemes.
- `client/tailwind.config.js`: Configures the Tailwind theme and the `@heroui/react` plugin.

## Key Technical Decisions

- **Monochrome Primary**: The primary brand color (currently gold) will be replaced with `#000000` (black) in light mode and `#FFFFFF` (white) in dark mode, or very dark/light grays respectively.
- **HeroUI Configuration**: We will override HeroUI's default shadow values in the plugin options to eliminate shadows globally across components like Modals, Cards, and Dropdowns.

## Implementation Units

- [x] **Unit 1: Update Global CSS Variables**

**Goal:** Remove gold-specific variables and switch the core application colors to monochrome.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `client/src/app/index.css`

**Approach:**
- Update `:root` and `.dark` variables to use grayscale for `--primary`, `--ring`, `--gold`, and `--gold-*` (keep the variable names if heavily used, or rename them and run a search-replace, but updating their HSL values to grayscale is safer).
- Update scrollbar thumb colors to shades of gray instead of gold.
- Remove or update `.gold-divider` and `.animate-pulse-gold` to use grayscale equivalents.

**Test scenarios:**
Test expectation: none -- pure styling change.

**Verification:**
- The application background, text, and custom styled scrollbars reflect the new grayscale theme in both light and dark modes.

- [x] **Unit 2: Configure Tailwind and HeroUI Plugin**

**Goal:** Apply the monochrome theme, enforce subtle borders, and remove shadows globally.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Unit 1

**Files:**
- Modify: `client/tailwind.config.js`

**Approach:**
- In the `heroui()` plugin configuration, update the `themes.light` and `themes.dark` to use monochrome colors for `primary` and `focus`.
- Set `layout: { radius: { small: '0.25rem', medium: '0.375rem', large: '0.5rem' }, boxShadow: { small: 'none', medium: 'none', large: 'none' } }` inside the HeroUI plugin options to remove shadows across all HeroUI components.
- In the Tailwind `theme.extend.boxShadow`, remove or nullify `glow` and `glow-strong` to prevent accidental shadow usage.

**Test scenarios:**
Test expectation: none -- pure styling change.

**Verification:**
- HeroUI buttons and inputs use black/white primary colors instead of gold.
- HeroUI Cards, Modals, and Popovers render without drop shadows and instead have subtle borders.
- The border radius of components remains clean and slight (around `0.375rem`).
