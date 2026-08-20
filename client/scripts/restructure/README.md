# restructure scripts

Temporary codemod scripts used during the client feature-slice architecture migration
(see `docs/plans/2026-08-20-001-refactor-client-feature-slice-architecture-plan.md`).

These scripts move and rewrite import paths as `client/src` is reorganized into
`app/`, `features/*`, and `shared/` slices, using `ts-morph` for type-aware
AST rewrites so import specifiers stay correct across the moves.

This directory, and the temporary `ts-morph` devDependency it depends on, are
deleted in Unit 12 once the migration is complete. Nothing here is meant to
outlive the migration — do not add long-lived tooling here.
