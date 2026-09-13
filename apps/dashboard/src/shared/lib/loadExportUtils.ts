// `exportUtils` pulls in `xlsx` (~95 KiB gzipped). Importing it statically put that on
// every route that offers an Export button, although nobody needs it until they press
// one (#184). This is the only sanctioned way to reach it: a dynamic `import()` the
// browser does not cross until an export runs, and a single seam tests can mock.
//
// `typeof import()` is a type position and is erased, so it keeps no static edge.
export type ExportUtils = typeof import('./exportUtils');

export const loadExportUtils = (): Promise<ExportUtils> => import('./exportUtils');
