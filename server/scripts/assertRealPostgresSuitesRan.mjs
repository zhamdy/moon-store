/**
 * CI guard: fail the build if the real-PostgreSQL suites were skipped.
 *
 * `describeWithPostgres` skips when TEST_DATABASE_URL is unset. That is correct locally
 * but catastrophic in CI, where a misconfigured service container would turn the entire
 * concurrency and idempotency proof into a green no-op. This asserts they actually ran.
 */
import fs from 'fs';
import path from 'path';

/**
 * Discovered rather than pattern-matched against a couple of directories: a guard that
 * only knows about `concurrency/` silently stops covering the next real-PostgreSQL suite
 * someone adds elsewhere, which is exactly the failure it exists to prevent.
 */
function findGuardedSuites(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findGuardedSuites(full, found);
    } else if (entry.name.endsWith('.test.ts')) {
      if (fs.readFileSync(full, 'utf8').includes('describeWithPostgres')) {
        found.push(path.resolve(full));
      }
    }
  }
  return found;
}

const reportPath = process.argv[2];

if (!reportPath || !fs.existsSync(reportPath)) {
  console.error(`[ci-guard] vitest JSON report not found at "${reportPath}".`);
  process.exit(1);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const expected = findGuardedSuites(path.resolve('tests'));
if (expected.length === 0) {
  console.error('[ci-guard] No describeWithPostgres suites found under tests/.');
  process.exit(1);
}

const reported = new Map((report.testResults ?? []).map((s) => [path.resolve(s.name), s]));
const missing = expected.filter((f) => !reported.has(f));
if (missing.length > 0) {
  console.error('[ci-guard] These real-PostgreSQL suites are absent from the vitest report:');
  for (const f of missing) {
    console.error(`  - ${path.relative(process.cwd(), f)}`);
  }
  process.exit(1);
}

const suites = expected.map((f) => reported.get(f));

let executed = 0;
const skipped = [];

for (const suite of suites) {
  for (const test of suite.assertionResults ?? []) {
    if (test.status === 'passed' || test.status === 'failed') {
      executed += 1;
    } else {
      skipped.push(`${suite.name} › ${test.fullName ?? test.title}`);
    }
  }
}

if (executed === 0) {
  console.error(
    '[ci-guard] Every real-PostgreSQL test was skipped. TEST_DATABASE_URL is almost certainly ' +
      'unset or the postgres service is unreachable.'
  );
  process.exit(1);
}

if (skipped.length > 0) {
  console.error(`[ci-guard] ${skipped.length} real-PostgreSQL test(s) were skipped:`);
  for (const name of skipped) {
    console.error(`  - ${name}`);
  }
  process.exit(1);
}

console.log(`[ci-guard] ${executed} real-PostgreSQL test(s) executed across ${suites.length} file(s).`);
