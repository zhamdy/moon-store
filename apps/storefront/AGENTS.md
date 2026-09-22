<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Learnings

- Silk Edit uses one 16:9 campaign source for both image slots. Its full-height mobile background needs height-based image sizes to keep the cover crop sharp, with the model at 82% horizontally. Keep the section `w-full` so the desktop aspect ratio and max-height cannot shrink its width. (2026-09-21)

- Product-card photo and overlay must both explicitly occupy column 1; setting only row-start allows CSS Grid to create an implicit second column and shrink the photo. (2026-09-21)
