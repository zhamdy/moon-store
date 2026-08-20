---
date: 2026-08-20
topic: architecture-refactor
---

# Architecture Refactor

## Problem Frame
The client codebase has outgrown its initial architecture. `App.tsx` has become bloated with manual routing configuration. Components suffer from state management sprawl (too many `useState` hooks). Furthermore, the team wants to migrate the UI foundation from Radix UI to HeroUI, and adopt TanStack Router for a more scalable routing architecture.

## Requirements

**Phase 1: Routing & Folder Structure**
- R1. Replace `react-router-dom` with `@tanstack/react-router`.
- R2. Implement TanStack's file-based routing inside `src/routes/`.
- R2a. Install `@tanstack/router-plugin` and configure it in `vite.config.ts`.
- R3. Remove manual route definitions from `src/app/App.tsx`.
- R4. Retain business logic, components, and domain boundaries within `src/features/`.

**Phase 2: UI Library Migration**
- R6. Remove all `@radix-ui` dependencies.
- R7. Install and configure `heroui` (formerly NextUI) and `framer-motion`.
- R8. Replace all Radix-based components (likely Shadcn UI) with their HeroUI equivalents.
- R9. Embrace HeroUI's default design system, allowing the application's visual style to update rather than strictly matching the old Radix design.

**Cross-Phase Requirements**
- R5. As files are touched, refactor bloated `useState` logic into `Zustand` (for global/complex local state) or `TanStack Query` (for server state).
- R10. Update `manualChunks` configuration in `vite.config.ts` to reflect the removal of Radix/React Router and the addition of HeroUI/TanStack Router.

## Success Criteria
- `react-router-dom` and `@radix-ui/*` are completely removed from `package.json`.
- `App.tsx` contains minimal setup and defers routing to TanStack Router.
- Application visual design fully utilizes HeroUI tokens and components.
- State management relies more heavily on Zustand and TanStack Query rather than scattered `useState` hooks.

## Scope Boundaries
- Do not rewrite backend APIs or data models.
- State refactoring is opportunistic (only done when touching files for UI/Router migrations); a separate massive state refactor is out of scope.

## Key Decisions
- **Phased Approach**: We will split the migration into two phases (Router first, then UI) to isolate risks.
- **File-based Routing**: We will adopt file-based routing but keep the feature folder pattern, preventing `src/routes/` from becoming a dumping ground for business logic.
- **Design System Transition**: We are not building a 1:1 clone of the old design; we are embracing HeroUI's defaults.

## Outstanding Questions

### Deferred to Planning
- [Technical] What is the precise TanStack Router file tree structure given the current routes in `App.tsx`?
- [Technical] Which specific Zustand stores need to be created to handle the state we're pulling out of components?
- [Technical] How should we handle the authentication checks (currently `ProtectedRoute`) in TanStack Router's `beforeLoad` or route context?

## Next Steps
`/dev:plan` for structured implementation planning.
