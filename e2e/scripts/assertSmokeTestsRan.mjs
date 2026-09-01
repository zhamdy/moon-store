/**
 * CI guard: fail the build if the `@smoke` subset matched nothing.
 *
 * `--grep @smoke` filters by title. A typo in a tag, a renamed describe block, or a spec
 * file that stops being collected turns the pull-request gate into a green no-op that
 * runs zero tests — the failure mode most likely to go unnoticed for months, because
 * every signal it produces looks like success.
 *
 * Same instinct as `server/scripts/assertRealPostgresSuitesRan.mjs`, applied to a tag
 * rather than to a `describe` wrapper.
 */
import fs from 'fs';

const reportPath = process.argv[2];
/** Raised deliberately when specs are added; lowered only with a reason. */
const MINIMUM_SMOKE_TESTS = Number(process.argv[3] ?? '5');
/** What this invocation is guarding, for the message. Defaults to the smoke tag. */
const LABEL = process.argv[4] ?? 'The @smoke subset';

if (!reportPath || !fs.existsSync(reportPath)) {
  console.error(`[e2e-guard] Playwright JSON report not found at "${reportPath}".`);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
} catch (err) {
  console.error(`[e2e-guard] Could not parse "${reportPath}": ${err.message}`);
  process.exit(1);
}

/** Playwright nests suites arbitrarily deep; collect every spec leaf. */
function collectSpecs(suites, found = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) found.push(spec);
    collectSpecs(suite.suites, found);
  }
  return found;
}

const specs = collectSpecs(report.suites);
const executed = specs.filter((spec) => (spec.tests ?? []).some((t) => t.status !== 'skipped'));

if (executed.length < MINIMUM_SMOKE_TESTS) {
  console.error(
    [
      `[e2e-guard] ${LABEL} ran ${executed.length} test(s); at least ` +
        `${MINIMUM_SMOKE_TESTS} were expected.`,
      '',
      'A green run of zero tests is not a passing gate. The usual causes are a renamed or',
      'mistyped @smoke tag, or a spec file that is no longer collected.',
    ].join('\n')
  );
  process.exit(1);
}

console.log(`[e2e-guard] ${LABEL} ran ${executed.length} test(s).`);
