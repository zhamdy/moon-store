// vitest runs in plain node, where the real `server-only` package throws on import (it
// resolves cleanly only under the `react-server` condition). The guard is Next's job;
// tests alias the import to this empty module.
export {};
